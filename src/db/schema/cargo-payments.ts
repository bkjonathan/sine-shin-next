import { pgTable, varchar, text, timestamp, doublePrecision, date } from "drizzle-orm/pg-core";
// customers.id is text (mix of 21-char nanoids and 36-char UUIDs), so the
// customer_id FK column must be text too — not varchar(21).
import { cargoShipments } from "./cargo-shipments";
import { customers } from "./customers";

export const cargoPayments = pgTable("cargo_payments", {
  id: varchar("id", { length: 21 }).primaryKey(),
  cargoShipmentId: varchar("cargo_shipment_id", { length: 21 }).notNull().references(() => cargoShipments.id),
  partyType: varchar("party_type", { length: 20 }).notNull(),
  customerId: text("customer_id").references(() => customers.id),
  amount: doublePrecision("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  exchangeRate: doublePrecision("exchange_rate"),
  paidAt: date("paid_at").notNull(),
  method: varchar("method", { length: 50 }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
