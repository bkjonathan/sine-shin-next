import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateExpenseSchema } from "@/validations/expense.schema";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), isNull(expenses.deletedAt))).limit(1);
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  return NextResponse.json({ data: expense });
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
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [updated] = await db.update(expenses)
      .set({ ...parsed.data })
      .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/expenses/:id]", err);
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
  const [deleted] = await db.update(expenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
