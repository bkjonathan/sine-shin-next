import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: varchar("id", { length: 21 }).primaryKey(),
  customerId: varchar("customer_id", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }),
  platform: varchar("platform", { length: 50 }),
  socialMediaUrl: varchar("social_media_url", { length: 500 }),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
