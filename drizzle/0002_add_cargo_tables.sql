CREATE TABLE "cargo_categories" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"carrier_rate_per_kg" double precision NOT NULL,
	"receiver_rate_per_kg" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cargo_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cargo_shipments" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"cargo_no" varchar(50) NOT NULL,
	"carrier_name" varchar(255),
	"carrier_phone" varchar(50),
	"flight_number" varchar(50),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"departure_date" date,
	"arrival_date" date,
	"exchange_rate" double precision DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cargo_shipments_cargo_no_unique" UNIQUE("cargo_no")
);
--> statement-breakpoint
CREATE TABLE "cargo_items" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"cargo_shipment_id" varchar(21) NOT NULL,
	"order_id" varchar(21) NOT NULL,
	"order_item_id" varchar(21),
	"category_id" varchar(21),
	"weight_kg" double precision NOT NULL,
	"carrier_rate_per_kg" double precision NOT NULL,
	"receiver_rate_per_kg" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cargo_payments" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"cargo_shipment_id" varchar(21) NOT NULL,
	"party_type" varchar(20) NOT NULL,
	"customer_id" varchar(21),
	"amount" double precision NOT NULL,
	"currency" varchar(10) NOT NULL,
	"exchange_rate" double precision,
	"paid_at" date NOT NULL,
	"method" varchar(50),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "cargo_id_prefix" varchar(20) DEFAULT 'CG' NOT NULL;
--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_cargo_shipment_id_cargo_shipments_id_fk" FOREIGN KEY ("cargo_shipment_id") REFERENCES "public"."cargo_shipments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_items" ADD CONSTRAINT "cargo_items_category_id_cargo_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cargo_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_payments" ADD CONSTRAINT "cargo_payments_cargo_shipment_id_cargo_shipments_id_fk" FOREIGN KEY ("cargo_shipment_id") REFERENCES "public"."cargo_shipments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cargo_payments" ADD CONSTRAINT "cargo_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
