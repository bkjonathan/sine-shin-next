import { notFound } from "next/navigation";
import { db } from "@/db";
import { cargoShipments, cargoItems, cargoPayments, cargoExpenses, cargoCategories, orders, orderItems, customers, shopSettings } from "@/db/schema";
import { eq, isNull, and, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CargoDetailClient } from "@/components/cargo/cargo-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CargoDetailPage({ params }: Props) {
  const { id } = await params;

  const [shipment] = await db
    .select()
    .from(cargoShipments)
    .where(and(eq(cargoShipments.id, id), isNull(cargoShipments.deletedAt)))
    .limit(1);

  if (!shipment) notFound();

  // Customer data comes from the order for order-based items, or straight from
  // the item's own customerId for direct shipments — coalesce across both.
  const directCustomers = alias(customers, "direct_customers");
  const [items, payments, expenses, shop] = await Promise.all([
    db
      .select({
        id: cargoItems.id,
        cargoShipmentId: cargoItems.cargoShipmentId,
        orderId: cargoItems.orderId,
        customerId: cargoItems.customerId,
        orderItemId: cargoItems.orderItemId,
        categoryId: cargoItems.categoryId,
        bagLabel: cargoItems.bagLabel,
        weightKg: cargoItems.weightKg,
        carrierRatePerKg: cargoItems.carrierRatePerKg,
        receiverRatePerKg: cargoItems.receiverRatePerKg,
        note: cargoItems.note,
        createdAt: cargoItems.createdAt,
        updatedAt: cargoItems.updatedAt,
        deletedAt: cargoItems.deletedAt,
        orderDisplayId: orders.orderId,
        customerName: sql<string | null>`coalesce(${customers.name}, ${directCustomers.name})`,
        customerPhone: sql<string | null>`coalesce(${customers.phone}, ${directCustomers.phone})`,
        customerAddress: sql<string | null>`coalesce(${customers.address}, ${directCustomers.address})`,
        customerCity: sql<string | null>`coalesce(${customers.city}, ${directCustomers.city})`,
        customerDisplayId: sql<string | null>`coalesce(${customers.customerId}, ${directCustomers.customerId})`,
        // Resolved customer id (order's customer, else direct customer) — links an
        // item to the receiver payments recorded against that same customer.
        receiverCustomerId: sql<string | null>`coalesce(${orders.customerId}, ${cargoItems.customerId})`,
        categoryName: cargoCategories.name,
        productUrl: orderItems.productUrl,
      })
      .from(cargoItems)
      .leftJoin(orders, eq(cargoItems.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .leftJoin(directCustomers, eq(cargoItems.customerId, directCustomers.id))
      .leftJoin(cargoCategories, eq(cargoItems.categoryId, cargoCategories.id))
      .leftJoin(orderItems, eq(cargoItems.orderItemId, orderItems.id))
      .where(and(eq(cargoItems.cargoShipmentId, id), isNull(cargoItems.deletedAt)))
      .orderBy(desc(cargoItems.createdAt)),
    db
      .select({
        id: cargoPayments.id,
        cargoShipmentId: cargoPayments.cargoShipmentId,
        partyType: cargoPayments.partyType,
        customerId: cargoPayments.customerId,
        amount: cargoPayments.amount,
        currency: cargoPayments.currency,
        exchangeRate: cargoPayments.exchangeRate,
        paidAt: cargoPayments.paidAt,
        method: cargoPayments.method,
        note: cargoPayments.note,
        createdAt: cargoPayments.createdAt,
        deletedAt: cargoPayments.deletedAt,
        customerName: customers.name,
      })
      .from(cargoPayments)
      .leftJoin(customers, eq(cargoPayments.customerId, customers.id))
      .where(and(eq(cargoPayments.cargoShipmentId, id), isNull(cargoPayments.deletedAt)))
      .orderBy(desc(cargoPayments.paidAt)),
    db
      .select()
      .from(cargoExpenses)
      .where(and(eq(cargoExpenses.cargoShipmentId, id), isNull(cargoExpenses.deletedAt)))
      .orderBy(desc(cargoExpenses.incurredAt)),
    db.select().from(shopSettings).limit(1).then((r) => r[0] ?? null),
  ]);

  return (
    <CargoDetailClient
      shipment={{
        ...shipment,
        items,
        payments: payments.map((p) => ({ ...p, partyType: p.partyType as "carrier" | "receiver" })),
        expenses,
      }}
      shop={shop}
    />
  );
}
