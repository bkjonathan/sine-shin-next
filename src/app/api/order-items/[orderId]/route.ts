import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orderItemSchema, deleteOrderItemSchema } from "@/validations/order.schema";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { createOnce } from "@/lib/idempotency";
import { missingRecord } from "@/lib/parents";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const items = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNull(orderItems.deletedAt)));

  return NextResponse.json({ data: items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  try {
    const body = await req.json();
    const parsed = orderItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Saved once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      // The order must exist and not be in the trash (AUDIT.md F-25).
      const missing = await missingRecord(tx, [["order", orderId]]);
      if (missing) return missing;

      const [item] = await tx.insert(orderItems).values({
        id: nanoid(),
        orderId,
        productUrl: parsed.data.productUrl,
        productQty: parsed.data.productQty,
        price: parsed.data.price,
        productWeight: parsed.data.productWeight,
      }).returning();
      return item;
    });
  } catch (err) {
    console.error("[POST /api/order-items/:orderId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  try {
    const { itemId, ...rest } = await req.json();
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

    const parsed = orderItemSchema.omit({ id: true }).safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Only write the keys the client actually sent, so a partial edit never
    // blanks a column it did not touch.
    const values: Partial<typeof orderItems.$inferInsert> = { updatedAt: new Date() };
    if ("productUrl" in rest) values.productUrl = parsed.data.productUrl;
    if ("productQty" in rest) values.productQty = parsed.data.productQty;
    if ("price" in rest) values.price = parsed.data.price;
    if ("productWeight" in rest) values.productWeight = parsed.data.productWeight;

    const [item] = await withAudit(req, session, (tx) => tx
      .update(orderItems)
      .set(values)
      .where(
        and(
          eq(orderItems.id, itemId),
          eq(orderItems.orderId, orderId),
          isNull(orderItems.deletedAt)
        )
      )
      .returning());

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    return NextResponse.json({ data: item });
  } catch (err) {
    console.error("[PATCH /api/order-items/:orderId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAtLeast(session, "manager")) return forbidden();

  const { orderId } = await params;
  try {
    // A body that isn't a JSON object naming the item is refused (AUDIT.md F-24).
    const parsed = deleteOrderItemSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [deleted] = await withAudit(req, session, (tx) => tx.update(orderItems)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(orderItems.id, parsed.data.itemId),
        eq(orderItems.orderId, orderId),
        isNull(orderItems.deletedAt)
      ))
      .returning({ id: orderItems.id }));

    if (!deleted) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[DELETE /api/order-items/:orderId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
