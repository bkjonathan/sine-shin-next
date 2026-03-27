import type { Order, OrderItem, Expense } from "@/types";

// ── Dashboard Order ───────────────────────────────────────────────────────────
// Order enriched with joined/aggregated fields from DB queries

export type DashboardOrder = Order & {
  customerName: string | null;
  totalPrice: number | null;    // SUM(item.price * item.qty)
  totalQty: number | null;      // SUM(item.qty)
  totalWeight: number | null;   // SUM(item.weight)
  firstProductUrl: string | null;
};

// Re-export for convenience
export type { Order, OrderItem, Expense };

// ── Filter Params ─────────────────────────────────────────────────────────────

export type DashboardDateField = "order_date" | "created_at";

export interface DashboardFilterParams {
  date_from: string | null;
  date_to: string | null;
  date_field: DashboardDateField;
  status: string | null;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_revenue: number;        // sum of all order totalPrice
  total_profit: number;         // sum of all calculateOrderProfit()
  total_cargo_fee: number;      // sum of effective cargo fees
  paid_cargo_fee: number;       // cargo fees where cargoFeePaid === true
  unpaid_cargo_fee: number;     // cargo fees where cargoFeePaid !== true
  excluded_cargo_total: number; // raw cargoFee where excludeCargoFee === true
  total_orders: number;
  total_customers: number;      // unique customer count
  recent_orders: DashboardOrder[];
}

// ── Account Summary ───────────────────────────────────────────────────────────

export interface AccountSummary {
  total_income: number;
  total_expenses: number;
  net_balance: number;
  total_orders: number;
  total_expense_records: number;
  this_month_income: number;
  this_month_expenses: number;
  total_service_fee: number;
  total_product_discount: number;
  total_cargo_fee: number;
}

// ── Detail Records (drilldown) ────────────────────────────────────────────────

export type DashboardRecordType =
  | "profit"
  | "cargo"
  | "paid_cargo"
  | "unpaid_cargo"
  | "excluded_cargo";

export interface DashboardDetailRecord {
  order_id: string | null;
  customer_name: string | null;
  amount: number;
  order_date: string | null;
}
