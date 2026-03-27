import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateOrderSchema } from "@/validations/order.schema";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, id), isNull(orderItems.deletedAt)));

  const [customer] = order.customerId
    ? await db.select({ id: customers.id, name: customers.name, customerId: customers.customerId })
        .from(customers).where(eq(customers.id, order.customerId)).limit(1)
    : [null];

  return NextResponse.json({ data: { ...order, items, customer } });
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
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { items, ...orderData } = parsed.data;

    const [updated] = await db.update(orders)
      .set({ ...orderData })
      .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/orders/:id]", err);
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
  const [deleted] = await db.update(orders)
    .set({ deletedAt: new Date() })
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
