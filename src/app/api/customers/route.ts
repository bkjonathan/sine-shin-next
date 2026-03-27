import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { isNull, ilike, or, desc, asc, sql, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createCustomerSchema } from "@/validations/customer.schema";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const sort = searchParams.get("sort") ?? "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const whereClause = isNull(customers.deletedAt);
    const searchClause = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.customerId, `%${search}%`),
          ilike(customers.phone, `%${search}%`)
        )
      : undefined;

    const sortCol = sort === "name" ? customers.name : sort === "customerId" ? customers.customerId : customers.createdAt;
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

    // Get prefix from settings
    const { shopSettings } = await import("@/db/schema");
    const [settings] = await db
      .select({ customerIdPrefix: shopSettings.customerIdPrefix })
      .from(shopSettings)
      .where(eq(shopSettings.id, "singleton"))
      .limit(1);
    const prefix = settings?.customerIdPrefix ?? "SSC";

    // Derive next number from the max existing ID to avoid gaps from soft-deletes
    const [{ maxNum }] = await db
      .select({ maxNum: sql<number>`coalesce(max(cast(split_part(customer_id, '-', 2) as integer)), 0)` })
      .from(customers);
    const customerId = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;

    const [customer] = await db.insert(customers).values({
      id: nanoid(),
      customerId,
      ...parsed.data,
    }).returning();

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/customers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
