-- Brings a database built from migrations alone in line with the schema the app
-- uses (AUDIT.md F-33). Migration 0000 created expenses.title and
-- expenses.expense_date as "description" and "date", and no migration created
-- expenses.expense_id or cargo_items.note; the databases in use got them through
-- db:push. Every statement checks first, so a database that already has these
-- columns is left unchanged.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'expenses' AND column_name = 'description')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'expenses' AND column_name = 'title') THEN
    ALTER TABLE "expenses" RENAME COLUMN "description" TO "title";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'expenses' AND column_name = 'date')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'expenses' AND column_name = 'expense_date') THEN
    ALTER TABLE "expenses" RENAME COLUMN "date" TO "expense_date";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "expense_id" varchar(50);--> statement-breakpoint
ALTER TABLE "cargo_items" ADD COLUMN IF NOT EXISTS "note" text;
