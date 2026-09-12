import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoPayments, customers, shopSettings } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { cargoPaymentSchema } from "@/validations/cargo.schema";
import { auth, roleAtLeast, forbidden } from "@/lib/auth";
import { paymentCurrencyError, shopCurrency } from "@/lib/currency";
import { withAudit } from "@/lib/audit";
import { createOnce } from "@/lib/idempotency";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cargoShipmentId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cargoShipmentId } = await params;
  const payments = await db
    .select({
      id: cargoPayments.id,
      cargoShipmentId: cargoPayments.cargoShipmentId,
      partyType: cargoPayments.partyType,
      customerId: cargoPayments.customerId,
      amount: cargoPayments.amount,
      currency: cargoPayments.currency,
      exchangeRate: cargoPayments.exchangeRate,
      paidAt: cargoPayments.paidAt,
      method: cargoPayments.method,
      note: cargoPayments.note,
      createdAt: cargoPayments.createdAt,
      deletedAt: cargoPayments.deletedAt,
      customerName: customers.name,
    })
    .from(cargoPayments)
    .leftJoin(customers, eq(cargoPayments.customerId, customers.id))
    .where(and(eq(cargoPayments.cargoShipmentId, cargoShipmentId), isNull(cargoPayments.deletedAt)))
    .orderBy(desc(cargoPayments.paidAt));

  return NextResponse.json({ data: payments });
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
    const parsed = cargoPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Saved once per submission (AUDIT.md F-13).
    return await createOnce(req, session, parsed.data, async (tx) => {
      // Balances convert only non-base receiver payments and count carrier payments
      // at face value, so accept only currencies that math handles (AUDIT.md F-11).
      // The settings row is share-locked so a currency change can't commit between
      // this check and the insert.
      const [shop] = await tx.select().from(shopSettings).limit(1).for("share");
      const currencyError = paymentCurrencyError(parsed.data.partyType, parsed.data.currency, shopCurrency(shop));
      if (currencyError) return NextResponse.json({ error: currencyError }, { status: 400 });

      const [payment] = await tx.insert(cargoPayments).values({
        id: nanoid(),
        cargoShipmentId,
        partyType: parsed.data.partyType,
        customerId: parsed.data.partyType === "receiver" ? parsed.data.customerId : null,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        exchangeRate: parsed.data.exchangeRate,
        paidAt: parsed.data.paidAt,
        method: parsed.data.method,
        note: parsed.data.note,
      }).returning();
      return payment;
    });
  } catch (err) {
    console.error("[POST /api/cargo-payments/:cargoShipmentId]", err);
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
  const { paymentId } = await req.json();

  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  await withAudit(req, session, (tx) => tx.update(cargoPayments)
    .set({ deletedAt: new Date() })
    .where(and(eq(cargoPayments.id, paymentId), eq(cargoPayments.cargoShipmentId, cargoShipmentId))));

  return NextResponse.json({ data: { success: true } });
}
