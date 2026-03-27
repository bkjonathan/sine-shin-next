import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, orders, expenses } from "@/db/schema";
import { isNull, sql, and, eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

// All date column names (from hardcoded map — never from user input directly)
const DATE_COL_SQL = {
  createdAt:    sql`orders.created_at`,
  orderDate:    sql`orders.order_date`,
  arrivedDate:  sql`orders.arrived_date`,
  shipmentDate: sql`orders.shipment_date`,
} as const;

type DateField = keyof typeof DATE_COL_SQL;

function buildDateCondition(field: DateField, from: string, to: string) {
  const col = DATE_COL_SQL[field] ?? DATE_COL_SQL.createdAt;
  // Cast the string param to the right PG type so the comparison operator resolves
  const castType = field === "createdAt" ? "timestamptz" : "date";

  return [
    sql`${col} >= ${from}::${sql.raw(castType)}`,
    sql`${col} <= ${to}::${sql.raw(castType)}`,
  ];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dateFrom  = searchParams.get("dateFrom");
  const dateTo    = searchParams.get("dateTo");
  const rawField  = searchParams.get("dateField") ?? "createdAt";
  const status    = searchParams.get("status");

  const dateField: DateField = rawField in DATE_COL_SQL ? (rawField as DateField) : "createdAt";

  try {
    // ── Build WHERE conditions ────────────────────────────────────────
    const conds = [isNull(orders.deletedAt)] as ReturnType<typeof sql>[];

    if (status) conds.push(eq(orders.status, status));

    if (dateFrom && dateTo) {
      const toValue = dateField === "createdAt" ? dateTo + "T23:59:59" : dateTo;
      conds.push(...buildDateCondition(dateField, dateFrom, toValue));
    } else if (dateFrom) {
      const col = DATE_COL_SQL[dateField];
      const cast = dateField === "createdAt" ? "timestamptz" : "date";
      conds.push(sql`${col} >= ${dateFrom}::${sql.raw(cast)}`);
    } else if (dateTo) {
      const col = DATE_COL_SQL[dateField];
      const cast = dateField === "createdAt" ? "timestamptz" : "date";
      const toValue = dateField === "createdAt" ? dateTo + "T23:59:59" : dateTo;
      conds.push(sql`${col} <= ${toValue}::${sql.raw(cast)}`);
    }

    const where = and(...conds);

    // ── Run queries in parallel ──────────────────────────────────────
    const [
      [financial],
      [cargo],
      [{ totalOrders }],
      [{ totalCustomers }],
      [{ totalExpenses }],
      recentActivity,
    ] = await Promise.all([
      // Financial overview
      db.select({
        totalRevenue: sql<number>`COALESCE(SUM(COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) + COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)), 0)`,
        netRevenue:   sql<number>`COALESCE(SUM(COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) + COALESCE(${orders.serviceFee},0)), 0)`,
        orderCount:   sql<number>`COUNT(*)::int`,
      }).from(orders).where(where),

      // Cargo breakdown
      db.select({
        totalCargo:    sql<number>`COALESCE(SUM(CASE WHEN exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        paidCargo:     sql<number>`COALESCE(SUM(CASE WHEN cargo_fee_paid = TRUE AND exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        unpaidCargo:   sql<number>`COALESCE(SUM(CASE WHEN cargo_fee_paid IS NOT TRUE AND exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        excludedCargo: sql<number>`COALESCE(SUM(CASE WHEN exclude_cargo_fee = TRUE THEN cargo_fee ELSE 0 END), 0)`,
      }).from(orders).where(where),

      // Counts
      db.select({ totalOrders:    sql<number>`COUNT(*)::int` }).from(orders).where(where),
      db.select({ totalCustomers: sql<number>`COUNT(*)::int` }).from(customers).where(isNull(customers.deletedAt)),
      db.select({ totalExpenses:  sql<number>`COALESCE(SUM(amount), 0)` }).from(expenses).where(isNull(expenses.deletedAt)),

      // Recent activity — orders + customer names
      db.select({
        id:                orders.id,
        orderId:           orders.orderId,
        status:            orders.status,
        createdAt:         orders.createdAt,
        customerName:      customers.name,
        customerDisplayId: customers.customerId,
        total: sql<number>`(
          COALESCE(${orders.shippingFee}, 0) + COALESCE(${orders.deliveryFee}, 0) +
          COALESCE(${orders.cargoFee}, 0)    + COALESCE(${orders.serviceFee}, 0)
        )`,
      })
        .from(orders)
        .leftJoin(customers, eq(orders.customerId, customers.id))
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(10),
    ]);

    // ── Shape response ───────────────────────────────────────────────
    const totalRevenue  = Number(financial?.totalRevenue ?? 0);
    const netRevenue    = Number(financial?.netRevenue   ?? 0);
    const orderCount    = Number(financial?.orderCount   ?? 0);
    const totalExp      = Number(totalExpenses            ?? 0);

    const totalCargo    = Number(cargo?.totalCargo    ?? 0);
    const paidCargo     = Number(cargo?.paidCargo     ?? 0);
    const unpaidCargo   = Number(cargo?.unpaidCargo   ?? 0);
    const excludedCargo = Number(cargo?.excludedCargo ?? 0);

    return NextResponse.json({
      data: {
        financial: {
          totalRevenue,
          netRevenue,
          totalProfit:    totalRevenue - totalExp,
          avgOrderValue:  orderCount > 0 ? totalRevenue / orderCount : 0,
        },
        operations: {
          totalOrders,
          totalCustomers,
          totalCargoFee:    totalCargo,
          paidCargoFee:     paidCargo,
          unpaidCargoFee:   unpaidCargo,
          excludedCargoFee: excludedCargo,
          cargoCollectionRate: totalCargo > 0 ? Math.round((paidCargo / totalCargo) * 100) : 0,
        },
        recentActivity: recentActivity.map((r) => ({
          id:                r.id,
          orderId:           r.orderId,
          status:            r.status,
          total:             Number(r.total ?? 0),
          createdAt:         r.createdAt,
          customerName:      r.customerName  ?? null,
          customerDisplayId: r.customerDisplayId ?? null,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cause   = err instanceof Error && (err as Error & { cause?: unknown }).cause
      ? String((err as Error & { cause?: unknown }).cause)
      : undefined;
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json(
      { error: "Internal server error", message, cause },
      { status: 500 }
    );
  }
}
