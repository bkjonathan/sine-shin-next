import { NextRequest, NextResponse } from "next/server";
import { orders } from "@/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { withAudit } from "@/lib/audit";

// Restore a deleted order
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAtLeast(session, "manager")) return forbidden();

  try {
    const { id } = await params;
    const [restored] = await withAudit(req, session, (tx) => tx
      .update(orders)
      .set({ deletedAt: null })
      .where(and(eq(orders.id, id), isNotNull(orders.deletedAt)))
      .returning());

    if (!restored) return NextResponse.json({ error: "Record not found in trash" }, { status: 404 });
    return NextResponse.json({ data: restored });
  } catch (err) {
    console.error("[PATCH /api/trash/orders/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Permanently delete an order
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!roleAtLeast(session, "owner")) return forbidden();

  try {
    const { id } = await params;
    // The log keeps the whole row, so a permanent delete stays traceable (AUDIT.md F-14).
    const [deleted] = await withAudit(req, session, (tx) => tx
      .delete(orders)
      .where(and(eq(orders.id, id), isNotNull(orders.deletedAt)))
      .returning());

    if (!deleted) return NextResponse.json({ error: "Record not found in trash" }, { status: 404 });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[DELETE /api/trash/orders/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
