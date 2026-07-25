import { pgTable, varchar, text, timestamp, doublePrecision, date } from "drizzle-orm/pg-core";

export const cargoShipments = pgTable("cargo_shipments", {
  id: varchar("id", { length: 21 }).primaryKey(),
  cargoNo: varchar("cargo_no", { length: 50 }).notNull().unique(),
  carrierName: varchar("carrier_name", { length: 255 }),
  carrierPhone: varchar("carrier_phone", { length: 50 }),
  flightNumber: varchar("flight_number", { length: 50 }),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  departureDate: date("departure_date"),
  arrivalDate: date("arrival_date"),
  exchangeRate: doublePrecision("exchange_rate").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
