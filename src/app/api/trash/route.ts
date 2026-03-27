import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, expenses } from "@/db/schema";
import { isNotNull, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") ?? "all"; // all | customers | orders | expenses

    const [deletedCustomers, deletedOrders, deletedExpenses] = await Promise.all([
      type === "all" || type === "customers"
        ? db.select().from(customers).where(isNotNull(customers.deletedAt)).orderBy(desc(customers.deletedAt))
        : Promise.resolve([]),
      type === "all" || type === "orders"
        ? db.select().from(orders).where(isNotNull(orders.deletedAt)).orderBy(desc(orders.deletedAt))
        : Promise.resolve([]),
      type === "all" || type === "expenses"
        ? db.select().from(expenses).where(isNotNull(expenses.deletedAt)).orderBy(desc(expenses.deletedAt))
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      data: {
        customers: deletedCustomers,
        orders: deletedOrders,
        expenses: deletedExpenses,
      },
      meta: {
        total: deletedCustomers.length + deletedOrders.length + deletedExpenses.length,
        counts: {
          customers: deletedCustomers.length,
          orders: deletedOrders.length,
          expenses: deletedExpenses.length,
        },
      },
    });
  } catch (err) {
    console.error("[GET /api/trash]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
