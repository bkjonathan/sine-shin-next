import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { updateCustomerSchema } from "@/validations/customer.schema";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), isNull(customers.deletedAt))).limit(1);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ data: customer });
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
    const parsed = updateCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const [updated] = await db.update(customers)
      .set({ ...parsed.data })
      .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/customers/:id]", err);
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
  const [deleted] = await db.update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
