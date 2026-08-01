import { pgTable, varchar, timestamp, doublePrecision, text } from "drizzle-orm/pg-core";
import { cargoShipments } from "./cargo-shipments";
import { orders } from "./orders";
import { orderItems } from "./order-items";
import { cargoCategories } from "./cargo-categories";

export const cargoItems = pgTable("cargo_items", {
  id: varchar("id", { length: 21 }).primaryKey(),
  cargoShipmentId: varchar("cargo_shipment_id", { length: 21 }).notNull().references(() => cargoShipments.id),
  orderId: varchar("order_id", { length: 21 }).notNull().references(() => orders.id),
  orderItemId: varchar("order_item_id", { length: 21 }).references(() => orderItems.id),
  categoryId: varchar("category_id", { length: 21 }).references(() => cargoCategories.id),
  weightKg: doublePrecision("weight_kg").notNull(),
  carrierRatePerKg: doublePrecision("carrier_rate_per_kg").notNull(),
  receiverRatePerKg: doublePrecision("receiver_rate_per_kg").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
