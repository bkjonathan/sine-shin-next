-- Free-text note on an order. Internal only — it is never rendered on the
-- invoice, receipt or any customer-facing template, so it is safe to keep
-- shop-side remarks (payment arrangements, follow-ups) here.
ALTER TABLE "orders" ADD COLUMN "note" text;
