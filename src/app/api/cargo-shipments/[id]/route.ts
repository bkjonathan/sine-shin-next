import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoShipments, cargoItems, cargoPayments, cargoCategories, orders, orderItems, customers } from "@/db/schema";
import { eq, isNull, and, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateCargoShipmentSchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [shipment] = await db
    .select()
    .from(cargoShipments)
    .where(and(eq(cargoShipments.id, id), isNull(cargoShipments.deletedAt)))
    .limit(1);

  if (!shipment) return NextResponse.json({ error: "Cargo shipment not found" }, { status: 404 });

  // Customer data comes from the order for order-based items, or straight from
  // the item's own customerId for direct shipments — coalesce across both.
  const directCustomers = alias(customers, "direct_customers");
  const items = await db
    .select({
      id: cargoItems.id,
      cargoShipmentId: cargoItems.cargoShipmentId,
      orderId: cargoItems.orderId,
      customerId: cargoItems.customerId,
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
      customerName: sql<string | null>`coalesce(${customers.name}, ${directCustomers.name})`,
      customerPhone: sql<string | null>`coalesce(${customers.phone}, ${directCustomers.phone})`,
      customerAddress: sql<string | null>`coalesce(${customers.address}, ${directCustomers.address})`,
      customerCity: sql<string | null>`coalesce(${customers.city}, ${directCustomers.city})`,
      customerDisplayId: sql<string | null>`coalesce(${customers.customerId}, ${directCustomers.customerId})`,
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
    .orderBy(desc(cargoItems.createdAt));

  const payments = await db
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
    .orderBy(desc(cargoPayments.paidAt));

  return NextResponse.json({ data: { ...shipment, items, payments } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateCargoShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { items, ...shipmentData } = parsed.data;

    const [updated] = await db.update(cargoShipments)
      .set({ ...shipmentData, updatedAt: new Date() })
      .where(and(eq(cargoShipments.id, id), isNull(cargoShipments.deletedAt)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Cargo shipment not found" }, { status: 404 });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/cargo-shipments/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db.update(cargoShipments)
    .set({ deletedAt: new Date() })
    .where(and(eq(cargoShipments.id, id), isNull(cargoShipments.deletedAt)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Cargo shipment not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
