-- Public tracking code for a cargo item. Printed as a QR on the 35×25 mm item
-- label; scanning it opens the unauthenticated page at /t/<code>, so the value
-- is the only thing gating that page and has to be unguessable — never derived
-- from the row id.
ALTER TABLE "cargo_items" ADD COLUMN "public_code" varchar(24);--> statement-breakpoint

-- Backfill rows that predate the column. New rows get a nanoid from the app;
-- this only has to be equally unguessable, hence random() + clock_timestamp()
-- rather than anything derived from the row itself.
UPDATE "cargo_items"
SET "public_code" = upper(substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 16))
WHERE "public_code" IS NULL;--> statement-breakpoint

ALTER TABLE "cargo_items" ALTER COLUMN "public_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_public_code_unique" UNIQUE("public_code");
