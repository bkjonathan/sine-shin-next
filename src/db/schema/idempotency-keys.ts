import { pgTable, varchar, text, jsonb, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// One row per create sent with an Idempotency-Key, saved in the same transaction
// as the record it created, so a retry gets `response` back instead of creating a
// second record (AUDIT.md F-13, src/lib/idempotency.ts). Kept for 24 hours.
// Bookkeeping, not shop data: no audit trigger.
export const idempotencyKeys = pgTable("idempotency_keys", {
  userId: varchar("user_id", { length: 21 }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  // Method and path, e.g. "POST /api/orders".
  request: text("request").notNull(),
  // SHA-256 of the validated request body.
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  // The reply body, set in the same transaction once the record is created.
  response: jsonb("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.key] }),
  index("idempotency_keys_created_at_idx").on(t.createdAt),
]);
