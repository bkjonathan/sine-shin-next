import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { cargoItems, cargoShipments, cargoCategories, orders, customers, shopSettings } from "@/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { PublicTrackingView } from "@/components/cargo/public-tracking-view";
import { PublicTrackingClosed } from "@/components/cargo/public-tracking-closed";
import { isTrackingClosed } from "@/components/cargo/public-tracking-status";
import type { CargoStatus, PublicCargoTrackingClosed, PublicCargoTrackingOpen } from "@/types";

interface Props {
  params: Promise<{ code: string }>;
}

// Carrier-facing and unauthenticated: always read through to the database so a
// status change is visible on the next scan, and never let a CDN hold a page
// that carries a consignee's phone number and address.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipment Label",
  // The code is a capability — keep these pages out of search results.
  robots: { index: false, follow: false },
};

export default async function PublicTrackingPage({ params }: Props) {
  const { code } = await params;

  // Customer data comes from the order for order-based items, or straight from
  // the item's own customerId for direct shipments — coalesce across both,
  // matching how the dashboard resolves it.
  const directCustomers = alias(customers, "direct_customers");
  const [row] = await db
    .select({
      publicCode: cargoItems.publicCode,
      weightKg: cargoItems.weightKg,
      bagLabel: cargoItems.bagLabel,
      note: cargoItems.note,
      cargoNo: cargoShipments.cargoNo,
      status: cargoShipments.status,
      carrierName: cargoShipments.carrierName,
      flightNumber: cargoShipments.flightNumber,
      departureDate: cargoShipments.departureDate,
      arrivalDate: cargoShipments.arrivalDate,
      orderDisplayId: orders.orderId,
      categoryName: cargoCategories.name,
      customerName: sql<string | null>`coalesce(${customers.name}, ${directCustomers.name})`,
      customerPhone: sql<string | null>`coalesce(${customers.phone}, ${directCustomers.phone})`,
      customerAddress: sql<string | null>`coalesce(${customers.address}, ${directCustomers.address})`,
      customerCity: sql<string | null>`coalesce(${customers.city}, ${directCustomers.city})`,
      customerDisplayId: sql<string | null>`coalesce(${customers.customerId}, ${directCustomers.customerId})`,
    })
    .from(cargoItems)
    .innerJoin(cargoShipments, eq(cargoItems.cargoShipmentId, cargoShipments.id))
    .leftJoin(orders, eq(cargoItems.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(directCustomers, eq(cargoItems.customerId, directCustomers.id))
    .leftJoin(cargoCategories, eq(cargoItems.categoryId, cargoCategories.id))
    .where(
      and(
        eq(cargoItems.publicCode, code),
        isNull(cargoItems.deletedAt),
        isNull(cargoShipments.deletedAt)
      )
    )
    .limit(1);

  if (!row) notFound();

  const [shop] = await db.select().from(shopSettings).limit(1);
  const status = row.status as CargoStatus;

  // Once delivered the page closes. The gate is here rather than in the view so
  // the consignee and carrier fields are never serialised into the RSC payload
  // — hiding them in the markup would still ship them to the browser.
  if (isTrackingClosed(status)) {
    const closed: PublicCargoTrackingClosed = {
      state: "closed",
      publicCode: row.publicCode,
      cargoNo: row.cargoNo,
      status,
      arrivalDate: row.arrivalDate,
    };
    return <PublicTrackingClosed tracking={closed} shop={shop ?? null} />;
  }

  const tracking: PublicCargoTrackingOpen = {
    state: "open",
    publicCode: row.publicCode,
    cargoNo: row.cargoNo,
    status,
    carrierName: row.carrierName,
    flightNumber: row.flightNumber,
    departureDate: row.departureDate,
    arrivalDate: row.arrivalDate,
    orderDisplayId: row.orderDisplayId,
    categoryName: row.categoryName,
    bagLabel: row.bagLabel,
    weightKg: row.weightKg,
    note: row.note,
    customer: {
      name: row.customerName,
      customerId: row.customerDisplayId,
      phone: row.customerPhone,
      address: row.customerAddress,
      city: row.customerCity,
    },
  };

  return <PublicTrackingView tracking={tracking} shop={shop ?? null} />;
}
