import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, customers, orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateOrderSchema, serviceFeeWithinLimit, SERVICE_FEE_PERCENT_LIMIT } from "@/validations/order.schema";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { withAudit } from "@/lib/audit";

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

    return await withAudit(req, session, async (tx) => {
      // The order page saves the service fee and its type separately, so check a
      // percentage against the stored value the edit doesn't change (AUDIT.md F-15).
      if (orderData.serviceFee !== undefined || orderData.serviceFeeType !== undefined) {
        const [stored] = await tx
          .select({ serviceFee: orders.serviceFee, serviceFeeType: orders.serviceFeeType })
          .from(orders)
          .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
          .for("update");
        if (stored && !serviceFeeWithinLimit(orderData.serviceFee ?? stored.serviceFee, orderData.serviceFeeType ?? stored.serviceFeeType)) {
          return NextResponse.json({ error: SERVICE_FEE_PERCENT_LIMIT }, { status: 400 });
        }
      }

      // updatedAt was never set on this edit (AUDIT.md F-14).
      const [updated] = await tx.update(orders)
        .set({ ...orderData, updatedAt: new Date() })
        .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
        .returning();

      if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      return NextResponse.json({ data: updated });
    });
  } catch (err) {
    console.error("[PATCH /api/orders/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAtLeast(session, "manager")) return forbidden();

  const { id } = await params;
  const [deleted] = await withAudit(req, session, (tx) => tx.update(orders)
    .set({ deletedAt: new Date() })
    .where(and(eq(orders.id, id), isNull(orders.deletedAt)))
    .returning());

  if (!deleted) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
