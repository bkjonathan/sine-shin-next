import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { isNull, desc, asc, sql, ilike, eq, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createExpenseSchema } from "@/validations/expense.schema";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    const sort = searchParams.get("sort") ?? "date";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const base = isNull(expenses.deletedAt);
    const whereClause = and(
      base,
      search ? ilike(expenses.description, `%${search}%`) : undefined,
      category ? eq(expenses.category, category) : undefined,
      dateFrom ? gte(expenses.date, dateFrom) : undefined,
      dateTo ? lte(expenses.date, dateTo) : undefined,
    );
    const sortCol = sort === "amount" ? expenses.amount : sort === "category" ? expenses.category : expenses.date;
    const orderFn = order === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(expenses).where(whereClause).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(expenses).where(whereClause),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [expense] = await db.insert(expenses).values({ id: nanoid(), ...parsed.data }).returning();
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
