-- Normalize service_fee_type: update legacy "%" and NULL values, then add NOT NULL default
UPDATE "orders" SET "service_fee_type" = 'percent' WHERE "service_fee_type" = '%' OR "service_fee_type" IS NULL;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "service_fee_type" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "service_fee_type" SET DEFAULT 'percent';
