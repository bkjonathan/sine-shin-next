import type { DashboardOrder, DashboardStats, AccountSummary, DashboardRecordType, DashboardDetailRecord } from "@/types/dashboard";
import type { OrderItem, Expense } from "@/types";
import { getThisMonthBounds } from "./dateUtils";
import { itemsSubtotal, orderMoney, summarizeOrders } from "@/lib/order-money";

// Money figures follow the shop-wide definitions in src/lib/order-money.ts
// (AUDIT.md F-10); `totalPrice` on a DashboardOrder is its items subtotal.

// ── 1. Order item total ───────────────────────────────────────────────────────

export function calculateOrderTotalPrice(items: OrderItem[]): number {
  return itemsSubtotal(items);
}

// ── 2. Service fee ────────────────────────────────────────────────────────────

export function calculateServiceFee(order: DashboardOrder): number {
  return orderMoney(order, order.totalPrice ?? 0).serviceFeeAmount;
}

// ── 3. Effective cargo fee ────────────────────────────────────────────────────

export function calculateEffectiveCargofee(order: DashboardOrder): number {
  if (order.excludeCargoFee === true) return 0;
  return order.cargoFee ?? 0;
}

// ── 4. Order profit (the shop's income from one order, before expenses) ───────

export function calculateOrderProfit(order: DashboardOrder): number {
  return orderMoney(order, order.totalPrice ?? 0).shopIncome;
}

// ── 5. Dashboard stats ────────────────────────────────────────────────────────

/** `periodExpenses`: expenses dated in the same period as `orders`. */
export function calculateDashboardStats(
  orders: DashboardOrder[],
  periodExpenses = 0
): DashboardStats {
  const active = orders.filter((o) => !o.deletedAt);

  const { revenue: total_revenue, profit: total_profit } = summarizeOrders(
    active.map((o) => orderMoney(o, o.totalPrice ?? 0)),
    periodExpenses
  );
  let total_cargo_fee       = 0;
  let paid_cargo_fee        = 0;
  let unpaid_cargo_fee      = 0;
  let excluded_cargo_total  = 0;
  const customerIds         = new Set<string>();

  for (const order of active) {
    const cargo = calculateEffectiveCargofee(order);
    total_cargo_fee += cargo;

    if (order.cargoFeePaid === true) {
      paid_cargo_fee += cargo;
    } else {
      unpaid_cargo_fee += cargo;
    }

    if (order.excludeCargoFee === true) {
      excluded_cargo_total += order.cargoFee ?? 0;
    }

    if (order.customerId) customerIds.add(order.customerId);
  }

  const sorted = [...active].sort((a, b) => {
    const da = a.orderDate ?? a.createdAt ?? "";
    const db_ = b.orderDate ?? b.createdAt ?? "";
    return db_ > da ? 1 : db_ < da ? -1 : 0;
  });

  return {
    total_revenue,
    total_profit,
    total_cargo_fee,
    paid_cargo_fee,
    unpaid_cargo_fee,
    excluded_cargo_total,
    total_orders: active.length,
    total_customers: customerIds.size,
    recent_orders: sorted.slice(0, 5),
  };
}

// ── 6. Account summary ────────────────────────────────────────────────────────

export function calculateAccountSummary(
  orders: DashboardOrder[],
  expenses: Expense[]
): AccountSummary {
  const activeOrders   = orders.filter((o) => !o.deletedAt);
  const activeExpenses = expenses.filter((e) => !e.deletedAt);

  const { start, end } = getThisMonthBounds();

  let total_income           = 0;
  let total_service_fee      = 0;
  let total_product_discount = 0;
  let total_cargo_fee        = 0;
  let this_month_income      = 0;

  for (const order of activeOrders) {
    const profit = calculateOrderProfit(order);
    total_income      += profit;
    total_service_fee += calculateServiceFee(order);
    total_product_discount += order.productDiscount ?? 0;
    total_cargo_fee   += calculateEffectiveCargofee(order);

    const d = order.orderDate ?? order.createdAt;
    if (d && d >= start && d <= end) {
      this_month_income += profit;
    }
  }

  let total_expenses      = 0;
  let this_month_expenses = 0;

  for (const exp of activeExpenses) {
    total_expenses += exp.amount;
    const d = exp.date;
    if (d && d >= start && d <= end) {
      this_month_expenses += exp.amount;
    }
  }

  return {
    total_income,
    total_expenses,
    net_balance: total_income - total_expenses,
    total_orders: activeOrders.length,
    total_expense_records: activeExpenses.length,
    this_month_income,
    this_month_expenses,
    total_service_fee,
    total_product_discount,
    total_cargo_fee,
  };
}

// ── 7. Detail records (drilldown) ─────────────────────────────────────────────

export function calculateDetailRecord(
  order: DashboardOrder,
  type: DashboardRecordType
): number | null {
  switch (type) {
    case "profit":
      return calculateOrderProfit(order);
    case "cargo":
      return calculateEffectiveCargofee(order);
    case "paid_cargo":
      return order.cargoFeePaid === true ? calculateEffectiveCargofee(order) : null;
    case "unpaid_cargo":
      return order.cargoFeePaid !== true ? calculateEffectiveCargofee(order) : null;
    case "excluded_cargo":
      return order.excludeCargoFee === true ? (order.cargoFee ?? 0) : null;
  }
}

export function buildDetailRecords(
  orders: DashboardOrder[],
  type: DashboardRecordType
): DashboardDetailRecord[] {
  const active = orders.filter((o) => !o.deletedAt);
  const records: DashboardDetailRecord[] = [];

  for (const order of active) {
    const amount = calculateDetailRecord(order, type);
    if (amount !== null && amount > 0) {
      records.push({
        order_id:      order.orderId,
        customer_name: order.customerName,
        amount,
        order_date:    order.orderDate,
      });
    }
  }

  return records.sort((a, b) => {
    const da = a.order_date ?? "";
    const db_ = b.order_date ?? "";
    return db_ > da ? 1 : db_ < da ? -1 : 0;
  });
}
