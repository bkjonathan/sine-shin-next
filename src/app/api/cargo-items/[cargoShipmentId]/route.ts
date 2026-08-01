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
      orderId: parsed.data.orderId ?? null,
      customerId: parsed.data.customerId ?? null,
      orderItemId: parsed.data.orderItemId ?? null,
      categoryId: parsed.data.categoryId,
      bagLabel: parsed.data.bagLabel?.trim() || null,
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

// PATCH updates the bag a cargo item is packed into. Two modes:
//   { itemId, bagLabel }            → move a single item to a bag (null clears)
//   { fromBagLabel, toBagLabel }    → rename a whole bag across the shipment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  try {
    const body = await req.json();
    const norm = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : null);

    if (typeof body.itemId === "string" && "bagLabel" in body) {
      await db.update(cargoItems)
        .set({ bagLabel: norm(body.bagLabel), updatedAt: new Date() })
        .where(and(eq(cargoItems.id, body.itemId), eq(cargoItems.cargoShipmentId, cargoShipmentId)));
      return NextResponse.json({ data: { success: true } });
    }

    if ("fromBagLabel" in body && "toBagLabel" in body) {
      const from = norm(body.fromBagLabel);
      const to = norm(body.toBagLabel);
      if (!from) return NextResponse.json({ error: "fromBagLabel required" }, { status: 400 });
      await db.update(cargoItems)
        .set({ bagLabel: to, updatedAt: new Date() })
        .where(and(eq(cargoItems.cargoShipmentId, cargoShipmentId), eq(cargoItems.bagLabel, from)));
      return NextResponse.json({ data: { success: true } });
    }

    return NextResponse.json({ error: "itemId+bagLabel or fromBagLabel+toBagLabel required" }, { status: 400 });
  } catch (err) {
    console.error("[PATCH /api/cargo-items/:cargoShipmentId]", err);
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
