import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoExpenses } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cargoExpenseSchema, deleteCargoExpenseSchema } from "@/validations/cargo.schema";
import { missingRecord } from "@/lib/parents";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { createOnce } from "@/lib/idempotency";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  const expenses = await db
    .select()
    .from(cargoExpenses)
    .where(and(eq(cargoExpenses.cargoShipmentId, cargoShipmentId), isNull(cargoExpenses.deletedAt)))
    .orderBy(desc(cargoExpenses.incurredAt));

  return NextResponse.json({ data: expenses });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  try {
    const body = await req.json();
    const parsed = cargoExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Saved once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      // The shipment must exist and not be in the trash (AUDIT.md F-25).
      const missing = await missingRecord(tx, [["shipment", cargoShipmentId]]);
      if (missing) return missing;

      const [expense] = await tx.insert(cargoExpenses).values({
        id: nanoid(),
        cargoShipmentId,
        category: parsed.data.category,
        description: parsed.data.description,
        amount: parsed.data.amount,
        incurredAt: parsed.data.incurredAt,
        note: parsed.data.note,
      }).returning();
      return expense;
    });
  } catch (err) {
    console.error("[POST /api/cargo-expenses/:cargoShipmentId]", err);
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
    // A body that isn't a JSON object naming the expense is refused (AUDIT.md F-24).
    const parsed = deleteCargoExpenseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [deleted] = await withAudit(req, session, (tx) => tx.update(cargoExpenses)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(cargoExpenses.id, parsed.data.expenseId),
        eq(cargoExpenses.cargoShipmentId, cargoShipmentId),
        isNull(cargoExpenses.deletedAt)
      ))
      .returning({ id: cargoExpenses.id }));

    if (!deleted) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[DELETE /api/cargo-expenses/:cargoShipmentId]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
