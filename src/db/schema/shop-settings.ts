import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const shopSettings = pgTable("shop_settings", {
  id: varchar("id", { length: 21 }).primaryKey().default("singleton"),
  shopName: varchar("shop_name", { length: 255 }).notNull().default("My Shop"),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  logoUrl: varchar("logo_cloud_url", { length: 500 }),
  customerIdPrefix: varchar("customer_id_prefix", { length: 20 }).notNull().default("CUST"),
  orderIdPrefix: varchar("order_id_prefix", { length: 20 }).notNull().default("ORD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
