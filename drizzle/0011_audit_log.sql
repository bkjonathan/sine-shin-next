-- Audit trail (AUDIT.md F-14). Every insert, update and delete on a business
-- table adds one row here, written by a trigger inside the same transaction as
-- the change: a change can't be saved without its row, and a change that rolls
-- back leaves none. Route handlers say who is acting by setting app.user_id,
-- app.user_role and app.client_ip for their transaction (src/lib/audit.ts). A
-- change made any other way (psql, a script) is still recorded, with db_user
-- and no app user.
--
-- Password hashes are never stored: they are removed from the row, and an update
-- that changed one adds "password_changed": true instead. An update that changed
-- nothing adds no row.
--
-- Append-only: triggers refuse UPDATE, DELETE and TRUNCATE on audit_log. The
-- table's owner could still drop those triggers; a hard guarantee needs the app
-- to connect as a database role that doesn't own the table.
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(21),
	"user_role" varchar(20),
	"client_ip" varchar(64),
	"db_user" text DEFAULT current_user NOT NULL,
	"action" varchar(10) NOT NULL,
	"entity" varchar(50) NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "audit_log_record"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' AND (old_row ->> 'password_hash') IS DISTINCT FROM (new_row ->> 'password_hash') THEN
    new_row := new_row || '{"password_changed": true}'::jsonb;
  END IF;
  IF TG_OP = 'UPDATE' AND (old_row ->> 'master_password_hash') IS DISTINCT FROM (new_row ->> 'master_password_hash') THEN
    new_row := new_row || '{"master_password_changed": true}'::jsonb;
  END IF;
  old_row := old_row - 'password_hash' - 'master_password_hash';
  new_row := new_row - 'password_hash' - 'master_password_hash';
  IF TG_OP = 'UPDATE' AND old_row = new_row THEN
    RETURN NULL;
  END IF;
  INSERT INTO audit_log (user_id, user_role, client_ip, action, entity, entity_id, before, after)
  VALUES (
    nullif(current_setting('app.user_id', true), ''),
    nullif(current_setting('app.user_role', true), ''),
    nullif(current_setting('app.client_ip', true), ''),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(new_row ->> 'id', old_row ->> 'id'),
    old_row,
    new_row
  );
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_no_change" ON "audit_log";--> statement-breakpoint
CREATE TRIGGER "audit_log_no_change" BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_no_truncate" ON "audit_log";--> statement-breakpoint
CREATE TRIGGER "audit_log_no_truncate" BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "users";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "users" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "customers";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "customers" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "orders";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "orders" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "order_items";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "order_items" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "expenses";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "expenses" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "shop_settings";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "shop_settings" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "cargo_categories";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "cargo_categories" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "cargo_shipments";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "cargo_shipments" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "cargo_items";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "cargo_items" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "cargo_payments";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "cargo_payments" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_record" ON "cargo_expenses";--> statement-breakpoint
CREATE TRIGGER "audit_log_record" AFTER INSERT OR UPDATE OR DELETE ON "cargo_expenses" FOR EACH ROW EXECUTE FUNCTION "audit_log_record"();
