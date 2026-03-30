// ── Report Types ──────────────────────────────────────────────────────────────

export interface ReportFilterParams {
  dateFrom: string | null;
  dateTo: string | null;
}

// ── Monthly Trend Data ────────────────────────────────────────────────────────

export interface MonthlyRevenue {
  month: string;          // "2026-01"
  label: string;          // "Jan 2026"
  revenue: number;
  profit: number;
  expenses: number;
  orderCount: number;
  avgOrderValue: number;
}

// ── Order Analytics ───────────────────────────────────────────────────────────

export interface OrderStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface OrderByPlatform {
  platform: string;
  count: number;
  revenue: number;
}

// ── Customer Analytics ────────────────────────────────────────────────────────

export interface TopCustomer {
  customerId: string;
  customerName: string;
  orderCount: number;
  totalRevenue: number;
}

export interface CustomerGrowthPoint {
  month: string;
  label: string;
  newCustomers: number;
  cumulativeCustomers: number;
}

// ── Expense Analytics ─────────────────────────────────────────────────────────

export interface ExpenseByCategory {
  category: string;
  amount: number;
  percentage: number;
}

// ── Cargo Analytics ───────────────────────────────────────────────────────────

export interface MonthlyCargo {
  month: string;
  label: string;
  paid: number;
  unpaid: number;
  excluded: number;
}

// ── KPI Summary ───────────────────────────────────────────────────────────────

export interface KPISummary {
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  avgOrderValue: number;
  totalOrders: number;
  totalCustomers: number;
  totalExpenses: number;
  cargoCollectionRate: number;
}

// ── Full Report Response ──────────────────────────────────────────────────────

export interface ReportsData {
  kpi: KPISummary;
  monthlyRevenue: MonthlyRevenue[];
  ordersByStatus: OrderStatusBreakdown[];
  ordersByPlatform: OrderByPlatform[];
  topCustomers: TopCustomer[];
  customerGrowth: CustomerGrowthPoint[];
  expensesByCategory: ExpenseByCategory[];
  monthlyCargo: MonthlyCargo[];
}
