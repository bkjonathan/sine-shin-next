CREATE TABLE "customers" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"customer_id" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"city" varchar(100),
	"platform" varchar(50),
	"social_media_url" varchar(500),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "customers_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"amount" double precision NOT NULL,
	"description" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"order_id" varchar(21),
	"product_url" text,
	"product_qty" integer,
	"price" double precision,
	"product_weight" double precision,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"synced" integer
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"order_id" varchar(50) NOT NULL,
	"customer_id" varchar(21),
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"order_from" text,
	"exchange_rate" double precision DEFAULT 1 NOT NULL,
	"shipping_fee" double precision DEFAULT 0 NOT NULL,
	"delivery_fee" double precision DEFAULT 0 NOT NULL,
	"cargo_fee" double precision DEFAULT 0 NOT NULL,
	"service_fee" double precision DEFAULT 0 NOT NULL,
	"product_discount" double precision,
	"service_fee_type" text,
	"shipping_fee_paid" boolean,
	"delivery_fee_paid" boolean,
	"cargo_fee_paid" boolean,
	"service_fee_paid" boolean,
	"shipping_fee_by_shop" boolean,
	"delivery_fee_by_shop" boolean,
	"cargo_fee_by_shop" boolean,
	"exclude_cargo_fee" boolean,
	"order_date" date,
	"arrived_date" date,
	"shipment_date" date,
	"user_withdraw_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"synced" integer,
	CONSTRAINT "orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" varchar(21) PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"shop_name" varchar(255) DEFAULT 'My Shop' NOT NULL,
	"phone" varchar(50),
	"address" text,
	"logo_cloud_url" varchar(500),
	"customer_id_prefix" varchar(20) DEFAULT 'CUST' NOT NULL,
	"order_id_prefix" varchar(20) DEFAULT 'ORD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"master_password_hash" varchar(255),
	CONSTRAINT "users_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;