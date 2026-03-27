import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, orderItems } from "@/db/schema";
import { isNull, sql, and, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { DashboardOrder } from "@/types/dashboard";

// Whitelist of date column SQL — never interpolate user input directly
const DATE_COL_SQL = {
  order_date:  sql`orders.order_date`,
  created_at:  sql`orders.created_at`,
} as const;

type DateField = keyof typeof DATE_COL_SQL;

function buildDateConditions(field: DateField, from: string, to: string) {
  const col      = DATE_COL_SQL[field] ?? DATE_COL_SQL.order_date;
  const castType = field === "created_at" ? "timestamptz" : "date";
  const toValue  = field === "created_at" ? to + "T23:59:59" : to;

  return [
    sql`${col} >= ${from}::${sql.raw(castType)}`,
    sql`${col} <= ${toValue}::${sql.raw(castType)}`,
  ];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo   = searchParams.get("dateTo");
  const rawField = searchParams.get("dateField") ?? "order_date";
  const status   = searchParams.get("status");

  const dateField: DateField = rawField in DATE_COL_SQL ? (rawField as DateField) : "order_date";

  try {
    const conds = [isNull(orders.deletedAt)] as ReturnType<typeof sql>[];

    if (status) conds.push(eq(orders.status, status));

    if (dateFrom && dateTo) {
      conds.push(...buildDateConditions(dateField, dateFrom, dateTo));
    } else if (dateFrom) {
      const col  = DATE_COL_SQL[dateField];
      const cast = dateField === "created_at" ? "timestamptz" : "date";
      conds.push(sql`${col} >= ${dateFrom}::${sql.raw(cast)}`);
    } else if (dateTo) {
      const col      = DATE_COL_SQL[dateField];
      const cast     = dateField === "created_at" ? "timestamptz" : "date";
      const toValue  = dateField === "created_at" ? dateTo + "T23:59:59" : dateTo;
      conds.push(sql`${col} <= ${toValue}::${sql.raw(cast)}`);
    }

    const where = and(...conds);

    // Fetch orders joined with customer name + aggregated item totals
    const rows = await db
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
        // Joined/computed
        customerName:       customers.name,
        totalPrice: sql<number>`COALESCE((
          SELECT SUM(COALESCE(oi.price, 0) * COALESCE(oi.product_qty, 0))
          FROM order_items oi
          WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL
        ), 0)`,
        totalQty: sql<number>`COALESCE((
          SELECT SUM(COALESCE(oi.product_qty, 0))
          FROM order_items oi
          WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL
        ), 0)`,
        totalWeight: sql<number>`COALESCE((
          SELECT SUM(COALESCE(oi.product_weight, 0))
          FROM order_items oi
          WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL
        ), 0)`,
        firstProductUrl: sql<string | null>`(
          SELECT oi.product_url
          FROM order_items oi
          WHERE oi.order_id = ${orders.id} AND oi.deleted_at IS NULL
          ORDER BY oi.created_at ASC
          LIMIT 1
        )`,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(where)
      .orderBy(desc(orders.orderDate), desc(orders.createdAt));

    const data: DashboardOrder[] = rows.map((r) => ({
      ...r,
      totalPrice:      Number(r.totalPrice ?? 0),
      totalQty:        Number(r.totalQty ?? 0),
      totalWeight:     Number(r.totalWeight ?? 0),
      firstProductUrl: r.firstProductUrl ?? null,
      customerName:    r.customerName ?? null,
      // orderItems field is not on DashboardOrder; exclude
      synced:          null,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/dashboard/orders]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}
