import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, customers, expenses } from "@/db/schema";
import { isNull, sql, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { ReportsData } from "@/types/reports";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only owner/manager can access reports
  const role = (session.user as { role?: string })?.role;
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  try {
    // Build base order conditions
    const orderConds = [isNull(orders.deletedAt)] as ReturnType<typeof sql>[];
    if (dateFrom) orderConds.push(sql`orders.order_date >= ${dateFrom}::date`);
    if (dateTo) orderConds.push(sql`orders.order_date <= ${dateTo}::date`);
    const orderWhere = and(...orderConds);

    // Build base expense conditions
    const expenseConds = [isNull(expenses.deletedAt)] as ReturnType<typeof sql>[];
    if (dateFrom) expenseConds.push(sql`expenses.expense_date >= ${dateFrom}::date`);
    if (dateTo) expenseConds.push(sql`expenses.expense_date <= ${dateTo}::date`);
    const expenseWhere = and(...expenseConds);

    const [
      kpiRows,
      expenseKpiRows,
      monthlyRevenueRows,
      monthlyExpenseRows,
      statusRows,
      platformRows,
      topCustomerRows,
      customerGrowthRows,
      expenseCategoryRows,
      monthlyCargoRows,
      customerCountRows,
    ] = await Promise.all([
      // KPI: order-based metrics
      db.select({
        totalRevenue: sql<number>`COALESCE(SUM(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ), 0)`,
        totalOrders: sql<number>`COUNT(*)::int`,
        avgOrderValue: sql<number>`COALESCE(AVG(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ), 0)`,
        totalCargo: sql<number>`COALESCE(SUM(CASE WHEN exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        paidCargo: sql<number>`COALESCE(SUM(CASE WHEN cargo_fee_paid = TRUE AND exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
      }).from(orders).where(orderWhere),

      // KPI: expense-based metrics
      db.select({
        totalExpenses: sql<number>`COALESCE(SUM(amount), 0)`,
      }).from(expenses).where(expenseWhere),

      // Monthly revenue (from orders)
      db.select({
        month: sql<string>`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`,
        revenue: sql<number>`COALESCE(SUM(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ), 0)`,
        profit: sql<number>`COALESCE(SUM(
          CASE WHEN ${orders.serviceFeeType} = 'percent'
            THEN COALESCE(
              (SELECT SUM(COALESCE(oi.price,0)*COALESCE(oi.product_qty,0)) FROM order_items oi WHERE oi.order_id = orders.id AND oi.deleted_at IS NULL),
              0
            ) * (COALESCE(${orders.serviceFee},0) / 100.0)
            ELSE COALESCE(${orders.serviceFee},0)
          END
          + COALESCE(${orders.productDiscount},0)
          + CASE WHEN ${orders.shippingFeeByShop} = TRUE THEN COALESCE(${orders.shippingFee},0) ELSE 0 END
          + CASE WHEN ${orders.deliveryFeeByShop} = TRUE THEN COALESCE(${orders.deliveryFee},0) ELSE 0 END
          + CASE WHEN ${orders.cargoFeeByShop} = TRUE AND ${orders.excludeCargoFee} IS NOT TRUE THEN COALESCE(${orders.cargoFee},0) ELSE 0 END
        ), 0)`,
        orderCount: sql<number>`COUNT(*)::int`,
      }).from(orders)
        .where(orderWhere)
        .groupBy(sql`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`),

      // Monthly expenses
      db.select({
        month: sql<string>`TO_CHAR(expenses.expense_date::date, 'YYYY-MM')`,
        amount: sql<number>`COALESCE(SUM(amount), 0)`,
      }).from(expenses)
        .where(expenseWhere)
        .groupBy(sql`TO_CHAR(expenses.expense_date::date, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(expenses.expense_date::date, 'YYYY-MM')`),

      // Orders by status
      db.select({
        status: orders.status,
        count: sql<number>`COUNT(*)::int`,
      }).from(orders).where(orderWhere).groupBy(orders.status),

      // Orders by platform
      db.select({
        platform: sql<string>`COALESCE(${orders.orderFrom}, 'Unknown')`,
        count: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ), 0)`,
      }).from(orders)
        .where(orderWhere)
        .groupBy(sql`COALESCE(${orders.orderFrom}, 'Unknown')`)
        .orderBy(sql`COUNT(*) DESC`),

      // Top 10 customers by revenue
      db.select({
        customerId: customers.customerId,
        customerName: customers.name,
        orderCount: sql<number>`COUNT(orders.id)::int`,
        totalRevenue: sql<number>`COALESCE(SUM(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ), 0)`,
      }).from(orders)
        .innerJoin(customers, sql`orders.customer_id = customers.id`)
        .where(orderWhere)
        .groupBy(customers.customerId, customers.name)
        .orderBy(sql`SUM(
          COALESCE(${orders.shippingFee},0) + COALESCE(${orders.deliveryFee},0) +
          COALESCE(${orders.cargoFee},0) + COALESCE(${orders.serviceFee},0)
        ) DESC`)
        .limit(10),

      // Customer growth — by first order month
      db.select({
        month: sql<string>`TO_CHAR(MIN(COALESCE(orders.order_date::date, orders.created_at::date)), 'YYYY-MM')`,
        count: sql<number>`1`,
      }).from(orders)
        .innerJoin(customers, sql`orders.customer_id = customers.id`)
        .where(isNull(orders.deletedAt))
        .groupBy(orders.customerId)
        .orderBy(sql`MIN(COALESCE(orders.order_date::date, orders.created_at::date))`),

      // Expenses by category
      db.select({
        category: expenses.category,
        amount: sql<number>`COALESCE(SUM(amount), 0)`,
      }).from(expenses).where(expenseWhere).groupBy(expenses.category),

      // Monthly cargo breakdown
      db.select({
        month: sql<string>`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`,
        paid: sql<number>`COALESCE(SUM(CASE WHEN cargo_fee_paid = TRUE AND exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        unpaid: sql<number>`COALESCE(SUM(CASE WHEN cargo_fee_paid IS NOT TRUE AND exclude_cargo_fee IS NOT TRUE THEN cargo_fee ELSE 0 END), 0)`,
        excluded: sql<number>`COALESCE(SUM(CASE WHEN exclude_cargo_fee = TRUE THEN cargo_fee ELSE 0 END), 0)`,
      }).from(orders)
        .where(orderWhere)
        .groupBy(sql`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(COALESCE(orders.order_date::date, orders.created_at::date), 'YYYY-MM')`),

      // Total unique customers
      db.select({
        count: sql<number>`COUNT(*)::int`,
      }).from(customers).where(isNull(customers.deletedAt)),
    ]);

    // ── Shape KPI ─────────────────────────────────────────────────────
    const totalRevenue = Number(kpiRows[0]?.totalRevenue ?? 0);
    const totalExpenses = Number(expenseKpiRows[0]?.totalExpenses ?? 0);
    const totalOrders = Number(kpiRows[0]?.totalOrders ?? 0);
    const totalCargo = Number(kpiRows[0]?.totalCargo ?? 0);
    const paidCargo = Number(kpiRows[0]?.paidCargo ?? 0);

    // Calculate total profit from monthly data for accuracy
    const totalProfit = monthlyRevenueRows.reduce((sum, r) => sum + Number(r.profit ?? 0), 0);

    const kpi = {
      totalRevenue,
      totalProfit,
      profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
      avgOrderValue: Number(kpiRows[0]?.avgOrderValue ?? 0),
      totalOrders,
      totalCustomers: Number(customerCountRows[0]?.count ?? 0),
      totalExpenses,
      cargoCollectionRate: totalCargo > 0 ? Math.round((paidCargo / totalCargo) * 100) : 0,
    };

    // ── Shape Monthly Revenue ─────────────────────────────────────────
    const expenseMap = new Map(monthlyExpenseRows.map(r => [r.month, Number(r.amount)]));
    const monthlyRevenue = monthlyRevenueRows.map(r => {
      const month = r.month;
      const revenue = Number(r.revenue);
      const orderCount = Number(r.orderCount);
      return {
        month,
        label: formatMonthLabel(month),
        revenue,
        profit: Number(r.profit),
        expenses: expenseMap.get(month) ?? 0,
        orderCount,
        avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      };
    });

    // ── Shape Orders by Status ────────────────────────────────────────
    const totalStatusCount = statusRows.reduce((s, r) => s + Number(r.count), 0);
    const ordersByStatus = statusRows.map(r => ({
      status: r.status,
      count: Number(r.count),
      percentage: totalStatusCount > 0 ? Math.round((Number(r.count) / totalStatusCount) * 100) : 0,
    }));

    // ── Shape Orders by Platform ──────────────────────────────────────
    const ordersByPlatform = platformRows.map(r => ({
      platform: String(r.platform),
      count: Number(r.count),
      revenue: Number(r.revenue),
    }));

    // ── Shape Top Customers ───────────────────────────────────────────
    const topCustomers = topCustomerRows.map(r => ({
      customerId: r.customerId,
      customerName: r.customerName,
      orderCount: Number(r.orderCount),
      totalRevenue: Number(r.totalRevenue),
    }));

    // ── Shape Customer Growth ─────────────────────────────────────────
    // Aggregate first-order months and compute cumulative
    const growthMap = new Map<string, number>();
    for (const row of customerGrowthRows) {
      const m = row.month;
      growthMap.set(m, (growthMap.get(m) ?? 0) + 1);
    }
    const sortedMonths = [...growthMap.keys()].sort();
    let cumulative = 0;
    const customerGrowth = sortedMonths
      .filter(m => {
        if (dateFrom && m < dateFrom.slice(0, 7)) return false;
        if (dateTo && m > dateTo.slice(0, 7)) return false;
        return true;
      })
      .map(m => {
        const newCount = growthMap.get(m) ?? 0;
        cumulative += newCount;
        return {
          month: m,
          label: formatMonthLabel(m),
          newCustomers: newCount,
          cumulativeCustomers: cumulative,
        };
      });

    // ── Shape Expenses by Category ────────────────────────────────────
    const totalExpAmt = expenseCategoryRows.reduce((s, r) => s + Number(r.amount), 0);
    const expensesByCategory = expenseCategoryRows.map(r => ({
      category: r.category,
      amount: Number(r.amount),
      percentage: totalExpAmt > 0 ? Math.round((Number(r.amount) / totalExpAmt) * 100) : 0,
    }));

    // ── Shape Monthly Cargo ───────────────────────────────────────────
    const monthlyCargo = monthlyCargoRows.map(r => ({
      month: r.month,
      label: formatMonthLabel(r.month),
      paid: Number(r.paid),
      unpaid: Number(r.unpaid),
      excluded: Number(r.excluded),
    }));

    const data: ReportsData = {
      kpi,
      monthlyRevenue,
      ordersByStatus,
      ordersByPlatform,
      topCustomers,
      customerGrowth,
      expensesByCategory,
      monthlyCargo,
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/reports]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}

function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}
