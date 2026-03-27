import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shopSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateSettingsSchema, changePasswordSchema } from "@/validations/settings.schema";
import { auth } from "@/lib/auth";
import { compare, hash } from "bcryptjs";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings] = await db.select().from(shopSettings).where(eq(shopSettings.id, "singleton")).limit(1);

  if (!settings) {
    // Return defaults if no settings row exists yet
    return NextResponse.json({
      data: {
        id: "singleton",
        shopName: "My Shop",
        phone: null,
        address: null,
        logoUrl: null,
        customerIdPrefix: "CUST",
        orderIdPrefix: "ORD",
      },
    });
  }

  return NextResponse.json({ data: settings });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    // Handle password change separately
    if (body.currentPassword !== undefined) {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
      }

      const userId = session.user?.id;
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const match = await compare(parsed.data.currentPassword, user.passwordHash);
      if (!match) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

      const passwordHash = await hash(parsed.data.newPassword, 12);
      await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

      return NextResponse.json({ data: { success: true } });
    }

    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Upsert settings
    const existing = await db.select().from(shopSettings).where(eq(shopSettings.id, "singleton")).limit(1);

    if (existing.length === 0) {
      const [created] = await db.insert(shopSettings).values({ id: "singleton", ...parsed.data }).returning();
      return NextResponse.json({ data: created });
    } else {
      const [updated] = await db.update(shopSettings)
        .set({ ...parsed.data })
        .where(eq(shopSettings.id, "singleton"))
        .returning();
      return NextResponse.json({ data: updated });
    }
  } catch (err) {
    console.error("[PATCH /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
