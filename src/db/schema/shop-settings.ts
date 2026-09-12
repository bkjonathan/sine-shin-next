import { pgTable, varchar, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const shopSettings = pgTable("shop_settings", {
  id: varchar("id", { length: 21 }).primaryKey().default("singleton"),
  shopName: varchar("shop_name", { length: 255 }).notNull().default("My Shop"),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  logoUrl: varchar("logo_cloud_url", { length: 500 }),
  customerIdPrefix: varchar("customer_id_prefix", { length: 20 }).notNull().default("CUST"),
  orderIdPrefix: varchar("order_id_prefix", { length: 20 }).notNull().default("ORD"),
  cargoIdPrefix: varchar("cargo_id_prefix", { length: 20 }).notNull().default("CG"),
  // Shop-wide currency (AUDIT.md F-11). Every amount column in the database is in
  // currencyCode; only cargo_payments stores a currency of its own. The code can't
  // change once money is recorded (PATCH /api/settings).
  currencyCode: varchar("currency_code", { length: 10 }).notNull().default("THB"),
  currencySymbol: varchar("currency_symbol", { length: 10 }).notNull().default("฿"),
  exchangeCurrencyCode: varchar("exchange_currency_code", { length: 10 }).notNull().default("MMK"),
  exchangeCurrencySymbol: varchar("exchange_currency_symbol", { length: 10 }).notNull().default("Ks"),
  // Only pre-fills new orders, shipments and payments; each record stores its own rate.
  defaultExchangeRate: numeric("default_exchange_rate", { precision: 18, scale: 6, mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
