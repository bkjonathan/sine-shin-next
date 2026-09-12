-- Retry protection for creates (AUDIT.md F-13). A create sent with an
-- Idempotency-Key header adds a row here in the same transaction as the record it
-- creates, with the reply. A retry with the same key (after a browser timeout,
-- say) waits for the first attempt to finish, then gets that reply back instead
-- of creating a second record; if the first attempt rolled back, its row is gone
-- and the retry creates the record. Keys are per user and are deleted after 24
-- hours (src/lib/idempotency.ts).
--
-- Bookkeeping, not shop data: no audit trigger (0011), and emptying the table
-- loses nothing but protection for retries already in flight.
--
-- A new table only, with IF NOT EXISTS, so it is safe to run by hand before
-- deploying. The new browser code sends a key with every create, so until this
-- table exists every order, item, shipment, payment, expense and customer create
-- fails.
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"user_id" varchar(21) NOT NULL,
	"key" varchar(100) NOT NULL,
	"request" text NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idempotency_keys_created_at_idx" ON "idempotency_keys" USING btree ("created_at");
