import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  customers,
  orders,
  orderItems,
  expenses,
  shopSettings,
  cargoCategories,
  cargoShipments,
  cargoItems,
  cargoPayments,
  cargoExpenses,
} from "@/db/schema";
import type { ORDER_STATUSES } from "@/validations/order.schema";
import type { EXPENSE_CATEGORIES } from "@/validations/expense.schema";
import type { CARGO_STATUSES, CargoPartyType } from "@/validations/cargo.schema";

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

export type CargoCategory = InferSelectModel<typeof cargoCategories>;
export type NewCargoCategory = InferInsertModel<typeof cargoCategories>;

export type CargoShipment = InferSelectModel<typeof cargoShipments>;
export type NewCargoShipment = InferInsertModel<typeof cargoShipments>;

export type CargoItem = InferSelectModel<typeof cargoItems>;
export type NewCargoItem = InferInsertModel<typeof cargoItems>;

export type CargoPayment = InferSelectModel<typeof cargoPayments>;
export type NewCargoPayment = InferInsertModel<typeof cargoPayments>;

export type CargoExpense = InferSelectModel<typeof cargoExpenses>;
export type NewCargoExpense = InferInsertModel<typeof cargoExpenses>;

// ── Enums ─────────────────────────────────────────────────────────────────────

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type UserRole = "owner" | "manager" | "staff";
export type CargoStatus = (typeof CARGO_STATUSES)[number];

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

export type CargoShipmentListItem = Pick<CargoShipment, "id" | "cargoNo" | "carrierName" | "status" | "exchangeRate" | "createdAt" | "deletedAt"> & {
  totalWeight: number;
  itemCount: number;
  carrierOwed: number;
  receiverOwed: number;
};

export type CargoItemWithLabels = CargoItem & {
  orderDisplayId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerDisplayId: string | null;
  categoryName: string | null;
  productUrl: string | null;
};

export type CargoPaymentWithCustomer = Omit<CargoPayment, "partyType"> & {
  partyType: CargoPartyType;
  customerName: string | null;
};

export type CargoShipmentWithDetails = CargoShipment & {
  items: CargoItemWithLabels[];
  payments: CargoPaymentWithCustomer[];
  expenses: CargoExpense[];
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
