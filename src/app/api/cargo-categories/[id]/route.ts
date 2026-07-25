import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoCategories } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateCargoCategorySchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateCargoCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [updated] = await db.update(cargoCategories)
      .set({ ...parsed.data })
      .where(and(eq(cargoCategories.id, id), isNull(cargoCategories.deletedAt)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/cargo-categories/:id]", err);
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
  const [deleted] = await db.update(cargoCategories)
    .set({ deletedAt: new Date() })
    .where(and(eq(cargoCategories.id, id), isNull(cargoCategories.deletedAt)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
