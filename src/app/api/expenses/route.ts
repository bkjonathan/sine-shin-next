import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { isNull, desc, asc, sql, ilike, eq, and, gte, lte } from "drizzle-orm";
import { containsPattern, intParam } from "@/lib/query";
import { nanoid } from "nanoid";
import { createExpenseSchema } from "@/validations/expense.schema";
import { auth, roleAtLeast } from "@/lib/auth";
import { FINANCIAL_SUMMARY_ROLE } from "@/lib/roles";
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
    const searchField = searchParams.get("searchField") ?? "title";
    const category = searchParams.get("category") ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    const sort = searchParams.get("sort") ?? "date";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const searchWhere = search
      ? searchField === "expenseId"
        ? ilike(expenses.expenseId, containsPattern(search))
        : ilike(expenses.description, containsPattern(search))
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
        // Expense totals are money summaries for managers and the owner; staff
        // keep the expense records they record and edit (AUDIT.md F-12).
        stats: roleAtLeast(session, FINANCIAL_SUMMARY_ROLE)
          ? {
              records: globalStats.globalCount,
              totalAmount: globalStats.globalTotal,
              thisMonthAmount: globalStats.thisMonthTotal,
              avgAmount,
            }
          : undefined,
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

    // The number and the expense are saved together, once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      const expenseId = await nextDisplayNumber(tx, expenses, expenses.expenseId, "EXP", "all");
      const [expense] = await tx.insert(expenses).values({
        id: nanoid(),
        expenseId,
        ...parsed.data,
      }).returning();
      return expense;
    });
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
