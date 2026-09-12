import { NextRequest, NextResponse } from "next/server";
import { cargoItems } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cargoItemSchema, updateCargoItemSchema, deleteCargoItemSchema } from "@/validations/cargo.schema";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { createOnce } from "@/lib/idempotency";
import { missingRecord } from "@/lib/parents";

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

    // Saved once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      // The shipment, and everything the item points at, must exist and not be in the trash (AUDIT.md F-25).
      const missing = await missingRecord(tx, [
        ["shipment", cargoShipmentId],
        ["order", parsed.data.orderId],
        ["orderItem", parsed.data.orderItemId],
        ["customer", parsed.data.customerId],
        ["category", parsed.data.categoryId],
      ]);
      if (missing) return missing;

      const [item] = await tx.insert(cargoItems).values({
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
      return item;
    });
  } catch (err) {
    console.error("[POST /api/cargo-items/:cargoShipmentId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH edits cargo items. Three modes, matched in this order:
//   { itemId, weightKg, ...fields } → edit one item's packing/pricing fields
//   { itemId, bagLabel }            → move a single item to a bag (null clears)
//   { fromBagLabel, toBagLabel }    → rename a whole bag across the shipment
// The full edit is checked first because it also carries a bagLabel, which
// would otherwise be swallowed by the bag-move branch.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  try {
    // A body that isn't a JSON object is refused (AUDIT.md F-24).
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }
    const norm = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : null);

    if (typeof body.itemId === "string" && "weightKg" in body) {
      const parsed = updateCargoItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }

      const result = await withAudit(req, session, async (tx) => {
        // A new category must exist and not be in the trash (AUDIT.md F-25).
        const missing = await missingRecord(tx, [["category", parsed.data.categoryId]]);
        if (missing) return missing;

        const [item] = await tx.update(cargoItems)
          .set({
            categoryId: parsed.data.categoryId || null,
            bagLabel: norm(parsed.data.bagLabel),
            weightKg: parsed.data.weightKg,
            carrierRatePerKg: parsed.data.carrierRatePerKg,
            receiverRatePerKg: parsed.data.receiverRatePerKg,
            note: parsed.data.note?.trim() || null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(cargoItems.id, body.itemId),
            eq(cargoItems.cargoShipmentId, cargoShipmentId),
            isNull(cargoItems.deletedAt)
          ))
          .returning();
        return item;
      });

      if (result instanceof Response) return result;
      if (!result) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      return NextResponse.json({ data: result });
    }

    // Moving an item and renaming a bag leave trashed items alone, and say so when nothing matched (AUDIT.md F-24).
    if (typeof body.itemId === "string" && "bagLabel" in body) {
      const [moved] = await withAudit(req, session, (tx) => tx.update(cargoItems)
        .set({ bagLabel: norm(body.bagLabel), updatedAt: new Date() })
        .where(and(eq(cargoItems.id, body.itemId), eq(cargoItems.cargoShipmentId, cargoShipmentId), isNull(cargoItems.deletedAt)))
        .returning({ id: cargoItems.id }));
      if (!moved) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      return NextResponse.json({ data: { success: true } });
    }

    if ("fromBagLabel" in body && "toBagLabel" in body) {
      const from = norm(body.fromBagLabel);
      const to = norm(body.toBagLabel);
      if (!from) return NextResponse.json({ error: "fromBagLabel required" }, { status: 400 });
      const renamed = await withAudit(req, session, (tx) => tx.update(cargoItems)
        .set({ bagLabel: to, updatedAt: new Date() })
        .where(and(eq(cargoItems.cargoShipmentId, cargoShipmentId), eq(cargoItems.bagLabel, from), isNull(cargoItems.deletedAt)))
        .returning({ id: cargoItems.id }));
      if (renamed.length === 0) return NextResponse.json({ error: "Bag not found" }, { status: 404 });
      return NextResponse.json({ data: { success: true } });
    }

    return NextResponse.json(
      { error: "itemId+weightKg, itemId+bagLabel, or fromBagLabel+toBagLabel required" },
      { status: 400 }
    );
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
  if (!roleAtLeast(session, "manager")) return forbidden();

  const { cargoShipmentId } = await params;
  try {
    // A body that isn't a JSON object naming the item is refused (AUDIT.md F-24).
    const parsed = deleteCargoItemSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [deleted] = await withAudit(req, session, (tx) => tx.update(cargoItems)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(cargoItems.id, parsed.data.itemId),
        eq(cargoItems.cargoShipmentId, cargoShipmentId),
        isNull(cargoItems.deletedAt)
      ))
      .returning({ id: cargoItems.id }));

    if (!deleted) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[DELETE /api/cargo-items/:cargoShipmentId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
