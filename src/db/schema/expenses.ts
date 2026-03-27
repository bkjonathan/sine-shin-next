import { pgTable, text, timestamp, doublePrecision, date, varchar } from "drizzle-orm/pg-core";

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  expenseId: varchar("expense_id", { length: 50 }),
  category: text("category").notNull().default("other"),
  amount: doublePrecision("amount").notNull(),
  description: text("title").notNull(),
  date: date("expense_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
