import { notFound } from "next/navigation";
import { db } from "@/db";
import { cargoShipments, cargoItems, cargoPayments, cargoCategories, orders, orderItems, customers, shopSettings } from "@/db/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
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

  const [items, payments, shop] = await Promise.all([
    db
      .select({
        id: cargoItems.id,
        cargoShipmentId: cargoItems.cargoShipmentId,
        orderId: cargoItems.orderId,
        orderItemId: cargoItems.orderItemId,
        categoryId: cargoItems.categoryId,
        weightKg: cargoItems.weightKg,
        carrierRatePerKg: cargoItems.carrierRatePerKg,
        receiverRatePerKg: cargoItems.receiverRatePerKg,
        note: cargoItems.note,
        createdAt: cargoItems.createdAt,
        updatedAt: cargoItems.updatedAt,
        deletedAt: cargoItems.deletedAt,
        orderDisplayId: orders.orderId,
        customerName: customers.name,
        customerPhone: customers.phone,
        customerAddress: customers.address,
        customerCity: customers.city,
        customerDisplayId: customers.customerId,
        categoryName: cargoCategories.name,
        productUrl: orderItems.productUrl,
      })
      .from(cargoItems)
      .leftJoin(orders, eq(cargoItems.orderId, orders.id))
      .leftJoin(customers, eq(orders.customerId, customers.id))
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
    db.select().from(shopSettings).limit(1).then((r) => r[0] ?? null),
  ]);

  return (
    <CargoDetailClient
      shipment={{
        ...shipment,
        items,
        payments: payments.map((p) => ({ ...p, partyType: p.partyType as "carrier" | "receiver" })),
      }}
      shop={shop}
    />
  );
}
