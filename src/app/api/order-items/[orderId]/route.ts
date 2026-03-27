import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orderItems } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { orderItemSchema } from "@/validations/order.schema";
import { auth } from "@/lib/auth";

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

    const [item] = await db.insert(orderItems).values({
      id: nanoid(),
      orderId,
      productUrl: parsed.data.productUrl,
      productQty: parsed.data.productQty,
      price: parsed.data.price,
      productWeight: parsed.data.productWeight,
    }).returning();

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/order-items/:orderId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  const { itemId } = await req.json();

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  await db.update(orderItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));

  return NextResponse.json({ data: { success: true } });
}
