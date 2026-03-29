import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  customers,
  orders,
  orderItems,
  expenses,
  shopSettings,
} from "@/db/schema";
import type { ORDER_STATUSES } from "@/validations/order.schema";
import type { EXPENSE_CATEGORIES } from "@/validations/expense.schema";

// ── Drizzle inferred types ────────────────────────────────────────────────────

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;

export type ShopSettings = InferSelectModel<typeof shopSettings>;

// ── Enums ─────────────────────────────────────────────────────────────────────

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type UserRole = "owner" | "manager" | "staff";

// ── API response envelope ─────────────────────────────────────────────────────

export interface ExpenseStats {
  records: number;
  totalAmount: number;
  thisMonthAmount: number;
  avgAmount: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stats?: ExpenseStats;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  error: string;
  details?: { path: (string | number)[]; message: string }[];
}

// ── Extended/joined types ─────────────────────────────────────────────────────

export type OrderWithCustomer = Order & {
  customer: Pick<Customer, "id" | "name" | "customerId"> | null;
};

export type OrderListItem = Pick<Order, "id" | "orderId" | "customerId" | "status" | "shippingFee" | "deliveryFee" | "cargoFee" | "serviceFee" | "exchangeRate" | "createdAt" | "deletedAt"> & {
  customerName: string | null;
  customerDisplayId: string | null;
  totalQty: number;
  totalWeight: number;
};

export type OrderWithItems = Order & {
  items: OrderItem[];
  customer: Pick<Customer, "id" | "name" | "customerId"> | null;
};

// ── List filter params ────────────────────────────────────────────────────────

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  searchField?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ExpenseListParams extends ListParams {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}
