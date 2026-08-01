CREATE TABLE "cargo_expenses" (
	"id" varchar(21) PRIMARY KEY NOT NULL,
	"cargo_shipment_id" varchar(21) NOT NULL,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"description" varchar(255),
	"amount" double precision NOT NULL,
	"incurred_at" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cargo_expenses" ADD CONSTRAINT "cargo_expenses_cargo_shipment_id_cargo_shipments_id_fk" FOREIGN KEY ("cargo_shipment_id") REFERENCES "public"."cargo_shipments"("id") ON DELETE no action ON UPDATE no action;
