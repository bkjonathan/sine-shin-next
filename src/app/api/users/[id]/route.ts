import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, ilike, and, ne } from "drizzle-orm";
import { hash } from "bcryptjs";
import { updateUserSchema } from "@/validations/user.schema";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ data: user });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Safety: prevent owner from changing own role
    if (parsed.data.role && session.user?.id === id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    // Check username uniqueness if updating
    if (parsed.data.username) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            ilike(users.username, parsed.data.username),
            ne(users.id, id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ error: "Username already exists" }, { status: 409 });
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (parsed.data.username) updateData.username = parsed.data.username;
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.password && parsed.data.password.length > 0) {
      updateData.passwordHash = await hash(parsed.data.password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[PATCH /api/users/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Prevent self-deletion
  if (session.user?.id === id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

  if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ data: { success: true } });
}
