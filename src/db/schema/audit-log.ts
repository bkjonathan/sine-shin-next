import { pgTable, bigserial, timestamp, varchar, text, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Change history (AUDIT.md F-14). Rows are written only by the audit_log_record
// trigger on each business table (drizzle/0011_audit_log.sql), in the same
// transaction as the change; the app reads them and never writes here. Other
// triggers refuse UPDATE, DELETE and TRUNCATE on this table.
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    // Who acted, as set by withAudit() (src/lib/audit.ts); null for changes made outside the app.
    userId: varchar("user_id", { length: 21 }),
    userRole: varchar("user_role", { length: 20 }),
    clientIp: varchar("client_ip", { length: 64 }),
    dbUser: text("db_user").notNull().default(sql`current_user`),
    action: varchar("action", { length: 10 }).notNull(), // insert | update | delete
    entity: varchar("entity", { length: 50 }).notNull(), // table name
    entityId: text("entity_id"),
    // The whole row before and after the change, without password hashes.
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entity, t.entityId, t.at),
    index("audit_log_at_idx").on(t.at),
  ]
);
