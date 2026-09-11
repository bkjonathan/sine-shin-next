import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 21 }).primaryKey(),
  username: varchar("name", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  masterPasswordHash: varchar("master_password_hash", { length: 255 }),
  // Bumped on role/password change to revoke every existing session (F-06).
  sessionVersion: integer("session_version").notNull().default(0),
});
