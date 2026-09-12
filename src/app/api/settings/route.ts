import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { shopSettings, users, orders, expenses, cargoShipments, cargoPayments, cargoExpenses, cargoCategories } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { updateSettingsSchema, changePasswordSchema } from "@/validations/settings.schema";
import { auth, roleAtLeast, forbidden, verifyOwnPassword } from "@/lib/auth";
import { CURRENCY_DEFAULTS, shopCurrency } from "@/lib/currency";
import { withAudit, type Tx } from "@/lib/audit";
import { hash } from "bcryptjs";

/** True once any record holding a base-currency amount exists. Soft-deleted rows count: they can be restored. */
async function hasMoneyRecords(tx: Tx) {
  // Waits for money records still being saved, and holds back new ones until the
  // caller's transaction ends, so the answer can't change before it commits (AUDIT.md F-13).
  await tx.execute(sql`lock table ${orders}, ${expenses}, ${cargoShipments}, ${cargoPayments}, ${cargoExpenses}, ${cargoCategories} in share mode`);
  const [row] = await tx.execute<{ found: boolean }>(sql`
    select exists(select 1 from ${orders}) or exists(select 1 from ${expenses})
        or exists(select 1 from ${cargoShipments}) or exists(select 1 from ${cargoPayments})
        or exists(select 1 from ${cargoExpenses}) or exists(select 1 from ${cargoCategories}) as found`);
  return Boolean(row?.found);
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings] = await db.select().from(shopSettings).limit(1);

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
        cargoIdPrefix: "CG",
        currencyCode: CURRENCY_DEFAULTS.currencyCode,
        currencySymbol: CURRENCY_DEFAULTS.currencySymbol,
        exchangeCurrencyCode: CURRENCY_DEFAULTS.exchangeCurrencyCode,
        exchangeCurrencySymbol: CURRENCY_DEFAULTS.exchangeCurrencySymbol,
        defaultExchangeRate: CURRENCY_DEFAULTS.exchangeRate,
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

      // Wrong entries count toward the same per-account limit as confirmations on the Users page (AUDIT.md F-18).
      const refused = await verifyOwnPassword(session, parsed.data.currentPassword);
      if (refused) return refused;

      const passwordHash = await hash(parsed.data.newPassword, 12);
      // Ends every session this user has, including the current one (F-06).
      await withAudit(req, session, (tx) => tx
        .update(users)
        .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
        .where(eq(users.id, userId)));

      return NextResponse.json({ data: { success: true } });
    }

    // Shop-settings update (identity + ID prefixes) is owner-only; the password
    // change above stays available to any signed-in user (AUDIT.md F-04).
    if (!roleAtLeast(session, "owner")) return forbidden();

    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Upsert settings. The checks and the save are one transaction, and the
    // settings row stays locked until it ends, so concurrent saves, and payments
    // checking their currency, wait for this one (AUDIT.md F-13).
    return await withAudit(req, session, async (tx) => {
      const existing = await tx.select().from(shopSettings).limit(1).for("update");

      // Currency rules that depend on what is stored (AUDIT.md F-11).
      const current = shopCurrency(existing[0]);
      const currencyCode = parsed.data.currencyCode ?? current.currencyCode;
      if (currencyCode === (parsed.data.exchangeCurrencyCode ?? current.exchangeCurrencyCode)) {
        return NextResponse.json({ error: "Base and exchange currency must be different" }, { status: 400 });
      }
      // Stored amounts carry no currency of their own, so a new base code would
      // relabel every one of them without converting anything.
      if (currencyCode !== current.currencyCode && (await hasMoneyRecords(tx))) {
        return NextResponse.json(
          { error: `The base currency is ${current.currencyCode} and can't be changed once orders, expenses or cargo records exist` },
          { status: 409 }
        );
      }

      if (existing.length === 0) {
        // Two first saves can both find no row; the later one updates the row the first created.
        const [created] = await tx.insert(shopSettings).values({ id: "singleton", ...parsed.data })
          .onConflictDoUpdate({ target: shopSettings.id, set: parsed.data })
          .returning();
        return NextResponse.json({ data: created });
      } else {
        const [updated] = await tx.update(shopSettings)
          .set({ ...parsed.data })
          .where(eq(shopSettings.id, existing[0].id))
          .returning();
        return NextResponse.json({ data: updated });
      }
    });
  } catch (err) {
    console.error("[PATCH /api/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
