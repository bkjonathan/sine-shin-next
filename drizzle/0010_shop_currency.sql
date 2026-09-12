-- Shop-wide currency (AUDIT.md F-11). Cargo balances used to compare each
-- payment's currency with a code kept in the viewer's localStorage, so two
-- people could see different balances for the same shipment. The settings now
-- live here and every page and the payments API read them.
--
-- Rule: every amount column (orders, order items, expenses, cargo rates, cargo
-- expenses) is in currency_code. Only cargo_payments stores a currency of its
-- own, and it must be currency_code, or exchange_currency_code for receivers.
-- Defaults are the owner's answer of 2026-09-12: THB base, MMK exchange.
-- default_exchange_rate only pre-fills new records.
--
-- Additive with constant defaults, so on Postgres 11+ this is a metadata-only
-- change (no table rewrite). IF NOT EXISTS so it is safe to run by hand before
-- deploying the code that reads it.
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "currency_code" varchar(10) DEFAULT 'THB' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "currency_symbol" varchar(10) DEFAULT '฿' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "exchange_currency_code" varchar(10) DEFAULT 'MMK' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "exchange_currency_symbol" varchar(10) DEFAULT 'Ks' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN IF NOT EXISTS "default_exchange_rate" numeric(18, 6) DEFAULT '1' NOT NULL;
