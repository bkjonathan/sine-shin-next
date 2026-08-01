import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoExpenses } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cargoExpenseSchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";

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

    const [expense] = await db.insert(cargoExpenses).values({
      id: nanoid(),
      cargoShipmentId,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      incurredAt: parsed.data.incurredAt,
      note: parsed.data.note,
    }).returning();

    return NextResponse.json({ data: expense }, { status: 201 });
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

  const { cargoShipmentId } = await params;
  const { expenseId } = await req.json();

  if (!expenseId) return NextResponse.json({ error: "expenseId required" }, { status: 400 });

  await db.update(cargoExpenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(cargoExpenses.id, expenseId), eq(cargoExpenses.cargoShipmentId, cargoShipmentId)));

  return NextResponse.json({ data: { success: true } });
}
