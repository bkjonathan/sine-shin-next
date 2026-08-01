-- Widen cargo customer_id FK columns to match customers.id (text).
-- customers.id holds both 21-char nanoids and 36-char UUIDs (legacy rows),
-- but these FK columns were varchar(21), so inserting a payment/item for a
-- UUID-id customer failed with "value too long for type character varying(21)".
ALTER TABLE "cargo_payments" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cargo_items" ALTER COLUMN "customer_id" SET DATA TYPE text;
