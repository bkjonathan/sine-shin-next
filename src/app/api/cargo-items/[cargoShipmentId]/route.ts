import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cargoItemSchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  try {
    const body = await req.json();
    const parsed = cargoItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [item] = await db.insert(cargoItems).values({
      id: nanoid(),
      cargoShipmentId,
      orderId: parsed.data.orderId,
      orderItemId: parsed.data.orderItemId,
      categoryId: parsed.data.categoryId,
      weightKg: parsed.data.weightKg,
      carrierRatePerKg: parsed.data.carrierRatePerKg,
      receiverRatePerKg: parsed.data.receiverRatePerKg,
      note: parsed.data.note ?? null,
    }).returning();

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cargo-items/:cargoShipmentId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  const { itemId } = await req.json();

  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  await db.update(cargoItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(cargoItems.id, itemId), eq(cargoItems.cargoShipmentId, cargoShipmentId)));

  return NextResponse.json({ data: { success: true } });
}
