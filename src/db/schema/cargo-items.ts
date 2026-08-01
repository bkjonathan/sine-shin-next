import { pgTable, varchar, timestamp, doublePrecision, text } from "drizzle-orm/pg-core";
import { cargoShipments } from "./cargo-shipments";
import { orders } from "./orders";
import { orderItems } from "./order-items";
import { cargoCategories } from "./cargo-categories";
import { customers } from "./customers";

// A cargo item is tied to EITHER an order (goods we forwarded from a purchase)
// OR directly to a customer (goods the customer sent us to ship, with no order).
export const cargoItems = pgTable("cargo_items", {
  id: varchar("id", { length: 21 }).primaryKey(),
  cargoShipmentId: varchar("cargo_shipment_id", { length: 21 }).notNull().references(() => cargoShipments.id),
  orderId: varchar("order_id", { length: 21 }).references(() => orders.id),
  customerId: varchar("customer_id", { length: 21 }).references(() => customers.id),
  orderItemId: varchar("order_item_id", { length: 21 }).references(() => orderItems.id),
  categoryId: varchar("category_id", { length: 21 }).references(() => cargoCategories.id),
  // Free-text label for the physical bag/parcel this item was packed into
  // (e.g. "Brown bag", "30kg bag") so items can be found during shipment.
  bagLabel: varchar("bag_label", { length: 100 }),
  weightKg: doublePrecision("weight_kg").notNull(),
  carrierRatePerKg: doublePrecision("carrier_rate_per_kg").notNull(),
  receiverRatePerKg: doublePrecision("receiver_rate_per_kg").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
