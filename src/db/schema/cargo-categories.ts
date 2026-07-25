import { pgTable, varchar, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";

export const cargoCategories = pgTable("cargo_categories", {
  id: varchar("id", { length: 21 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  carrierRatePerKg: doublePrecision("carrier_rate_per_kg").notNull(),
  receiverRatePerKg: doublePrecision("receiver_rate_per_kg").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
