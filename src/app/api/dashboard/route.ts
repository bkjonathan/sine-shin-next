import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, expenses } from "@/db/schema";
import { isNull, sql, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      [{ totalCustomers }],
      [{ activeOrders }],
      [{ monthlyRevenue }],
      [{ totalExpenses }],
      recentOrders,
    ] = await Promise.all([
      db.select({ totalCustomers: sql<number>`count(*)::int` }).from(customers).where(isNull(customers.deletedAt)),
      db.select({ activeOrders: sql<number>`count(*)::int` }).from(orders).where(sql`deleted_at IS NULL AND status NOT IN ('completed')`),
      db.select({ monthlyRevenue: sql<number>`coalesce(sum(shipping_fee + delivery_fee + cargo_fee + service_fee), 0)` }).from(orders).where(sql`deleted_at IS NULL AND status = 'completed' AND created_at >= ${monthStart}`),
      db.select({ totalExpenses: sql<number>`coalesce(sum(amount), 0)` }).from(expenses).where(isNull(expenses.deletedAt)),
      db.select({ id: orders.id, orderId: orders.orderId, status: orders.status, createdAt: orders.createdAt, customerId: orders.customerId })
        .from(orders)
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.createdAt))
        .limit(10),
    ]);

    return NextResponse.json({
      data: {
        stats: { totalCustomers, activeOrders, monthlyRevenue, totalExpenses },
        recentOrders,
      },
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
