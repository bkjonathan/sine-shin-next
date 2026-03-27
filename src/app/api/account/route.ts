import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, orderItems, expenses } from "@/db/schema";
import { isNull, sql, and, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { DashboardOrder } from "@/types/dashboard";
import type { Expense } from "@/types";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [orderRows, expenseRows] = await Promise.all([
      // All non-deleted orders with item totals
      db
        .select({
          id:               orders.id,
          orderId:          orders.orderId,
          customerId:       orders.customerId,
          status:           orders.status,
          orderFrom:        orders.orderFrom,
          exchangeRate:     orders.exchangeRate,
          shippingFee:      orders.shippingFee,
          deliveryFee:      orders.deliveryFee,
          cargoFee:         orders.cargoFee,
          serviceFee:       orders.serviceFee,
          serviceFeeType:   orders.serviceFeeType,
          productDiscount:  orders.productDiscount,
          shippingFeeByShop:  orders.shippingFeeByShop,
          deliveryFeeByShop:  orders.deliveryFeeByShop,
          cargoFeeByShop:     orders.cargoFeeByShop,
          excludeCargoFee:    orders.excludeCargoFee,
          shippingFeePaid:    orders.shippingFeePaid,
          deliveryFeePaid:    orders.deliveryFeePaid,
          cargoFeePaid:       orders.cargoFeePaid,
          serviceFeePaid:     orders.serviceFeePaid,
          orderDate:          orders.orderDate,
          arrivedDate:        orders.arrivedDate,
          shipmentDate:       orders.shipmentDate,
          userWithdrawDate:   orders.userWithdrawDate,
          createdAt:          orders.createdAt,
          updatedAt:          orders.updatedAt,
          deletedAt:          orders.deletedAt,
          customerName:       customers.name,
          totalPrice: sql<number>`COALESCE((
            SELECT SUM(COALESCE(oi.price, 0) * COALESCE(oi.product_qty, 0))
            FROM order_items oi
            WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL
          ), 0)`,
          totalQty:     sql<number>`0`,
          totalWeight:  sql<number>`0`,
          firstProductUrl: sql<string | null>`NULL`,
        })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(isNull(orders.deletedAt))
        .orderBy(desc(orders.orderDate), desc(orders.createdAt)),

      // All non-deleted expenses
      db
        .select()
        .from(expenses)
        .where(isNull(expenses.deletedAt))
        .orderBy(desc(expenses.date)),
    ]);

    const ordersData: DashboardOrder[] = orderRows.map((r) => ({
      ...r,
      totalPrice:      Number(r.totalPrice ?? 0),
      totalQty:        0,
      totalWeight:     0,
      firstProductUrl: null,
      customerName:    r.customerName ?? null,
      synced:          null,
    }));

    return NextResponse.json({
      data: {
        orders:   ordersData,
        expenses: expenseRows as Expense[],
      },
    });
  } catch (err) {
    console.error("[GET /api/account]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}
