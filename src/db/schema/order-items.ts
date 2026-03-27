import { pgTable, varchar, text, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const orderItems = pgTable("order_items", {
  id: varchar("id", { length: 21 }).primaryKey(),
  orderId: varchar("order_id", { length: 21 }).references(() => orders.id),
  productUrl: text("product_url"),
  productQty: integer("product_qty"),
  price: doublePrecision("price"),
  productWeight: doublePrecision("product_weight"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  synced: integer("synced"),
});
