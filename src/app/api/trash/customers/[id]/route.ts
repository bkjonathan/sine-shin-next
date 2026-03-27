import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Restore a deleted customer
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const [restored] = await db
      .update(customers)
      .set({ deletedAt: null })
      .where(and(eq(customers.id, id), isNotNull(customers.deletedAt)))
      .returning();

    if (!restored) return NextResponse.json({ error: "Record not found in trash" }, { status: 404 });
    return NextResponse.json({ data: restored });
  } catch (err) {
    console.error("[PATCH /api/trash/customers/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Permanently delete a customer
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(customers)
      .where(and(eq(customers.id, id), isNotNull(customers.deletedAt)))
      .returning();

    if (!deleted) return NextResponse.json({ error: "Record not found in trash" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[DELETE /api/trash/customers/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
