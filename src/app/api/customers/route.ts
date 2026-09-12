import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { isNull, ilike, desc, asc, sql, eq } from "drizzle-orm";
import { containsPattern, intParam } from "@/lib/query";
import { nanoid } from "nanoid";
import { createCustomerSchema } from "@/validations/customer.schema";
import { auth } from "@/lib/auth";
import { createOnce } from "@/lib/idempotency";
import { nextDisplayNumber } from "@/lib/display-number";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const page = intParam(searchParams.get("page"), 1, 1, 1_000_000);
    const limit = intParam(searchParams.get("limit"), 20, 1, 100);
    const search = searchParams.get("search") ?? "";
    const searchField = searchParams.get("searchField") ?? "name";
    const sort = searchParams.get("sort") ?? "customerId";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const whereClause = isNull(customers.deletedAt);
    const searchClause = search
      ? searchField === "customerId"
        ? ilike(customers.customerId, containsPattern(search))
        : searchField === "phone"
        ? ilike(customers.phone, containsPattern(search))
        : searchField === "all"
        ? sql`(${ilike(customers.name, containsPattern(search))} OR ${ilike(customers.customerId, containsPattern(search))})`
        : ilike(customers.name, containsPattern(search))
      : undefined;

    const sortCol = sort === "name" ? customers.name : sort === "createdAt" ? customers.createdAt : customers.customerId;
    const orderFn = order === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(customers)
        .where(searchClause ? sql`${whereClause} AND ${searchClause}` : whereClause)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(customers)
        .where(searchClause ? sql`${whereClause} AND ${searchClause}` : whereClause),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/customers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { shopSettings } = await import("@/db/schema");
    // The number and the customer are saved together, once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      // Get prefix from settings
      const [settings] = await tx
        .select({ customerIdPrefix: shopSettings.customerIdPrefix })
        .from(shopSettings)
        .where(eq(shopSettings.id, "singleton"))
        .limit(1);
      const prefix = (settings?.customerIdPrefix ?? "SSC").replace(/-+$/, "");

      // Derive next number from the max existing ID, whatever its prefix, to avoid gaps from soft-deletes
      const customerId = await nextDisplayNumber(tx, customers, customers.customerId, prefix, "all");

      const [customer] = await tx.insert(customers).values({
        id: nanoid(),
        customerId,
        ...parsed.data,
      }).returning();
      return customer;
    });
  } catch (err) {
    console.error("[POST /api/customers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
