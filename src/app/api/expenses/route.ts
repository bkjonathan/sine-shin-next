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
    const searchField = searchParams.get("searchField") ?? "title";
    const category = searchParams.get("category") ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    const sort = searchParams.get("sort") ?? "date";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const searchWhere = search
      ? searchField === "expenseId"
        ? ilike(expenses.expenseId, `%${search}%`)
        : ilike(expenses.description, `%${search}%`)
      : undefined;

    const whereClause = and(
      isNull(expenses.deletedAt),
      searchWhere,
      category ? eq(expenses.category, category) : undefined,
      dateFrom ? gte(expenses.date, dateFrom) : undefined,
      dateTo ? lte(expenses.date, dateTo) : undefined,
    );

    const sortCol =
      sort === "amount" ? expenses.amount :
      sort === "title" ? expenses.description :
      sort === "expenseId" ? expenses.expenseId :
      expenses.date;
    const orderFn = order === "asc" ? asc : desc;

    const globalBase = isNull(expenses.deletedAt);
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonthStart = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01-01`
      : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    const [rows, [{ count }], [globalStats]] = await Promise.all([
      db.select().from(expenses).where(whereClause).orderBy(orderFn(sortCol)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(expenses).where(whereClause),
      db.select({
        globalCount: sql<number>`count(*)::int`,
        globalTotal: sql<number>`COALESCE(SUM(amount), 0)`,
        thisMonthTotal: sql<number>`COALESCE(SUM(CASE WHEN expense_date >= ${monthStart} AND expense_date < ${nextMonthStart} THEN amount ELSE 0 END), 0)`,
      }).from(expenses).where(globalBase),
    ]);

    const avgAmount = globalStats.globalCount > 0
      ? globalStats.globalTotal / globalStats.globalCount
      : 0;

    return NextResponse.json({
      data: rows,
      meta: {
        page, limit, total: count, totalPages: Math.ceil(count / limit),
        stats: {
          records: globalStats.globalCount,
          totalAmount: globalStats.globalTotal,
          thisMonthAmount: globalStats.thisMonthTotal,
          avgAmount,
        },
      },
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

    const [{ maxNum }] = await db.select({
      maxNum: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(expense_id, '-', 2) AS INTEGER)), 0)`,
    }).from(expenses);
    const expenseId = `EXP-${String(maxNum + 1).padStart(5, "0")}`;

    const [expense] = await db.insert(expenses).values({
      id: nanoid(),
      expenseId,
      ...parsed.data,
    }).returning();
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
