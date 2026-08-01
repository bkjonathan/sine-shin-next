ALTER TABLE "cargo_items" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cargo_items" ADD COLUMN "customer_id" varchar(21);--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
