import { pgTable, varchar, text, timestamp, doublePrecision, date } from "drizzle-orm/pg-core";
import { cargoShipments } from "./cargo-shipments";

// Costs a shipment incurs beyond the carrier freight — customs, handling,
// packaging, local transport, etc. Amounts are recorded in the shop's base
// currency and subtracted from the freight margin to get the shipment's
// net profit.
export const cargoExpenses = pgTable("cargo_expenses", {
  id: varchar("id", { length: 21 }).primaryKey(),
  cargoShipmentId: varchar("cargo_shipment_id", { length: 21 }).notNull().references(() => cargoShipments.id),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  description: varchar("description", { length: 255 }),
  amount: doublePrecision("amount").notNull(),
  incurredAt: date("incurred_at").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
