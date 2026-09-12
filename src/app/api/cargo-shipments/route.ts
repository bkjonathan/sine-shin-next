import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoShipments, cargoItems, shopSettings } from "@/db/schema";
import { isNull, desc, asc, sql, eq, and, or, ilike } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createCargoShipmentSchema } from "@/validations/cargo.schema";
import { auth } from "@/lib/auth";
import { createOnce } from "@/lib/idempotency";
import { nextDisplayNumber } from "@/lib/display-number";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "";
    const sort = searchParams.get("sort") ?? "createdAt";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";
    const offset = (page - 1) * limit;

    const baseConditions = [isNull(cargoShipments.deletedAt)];
    if (status) baseConditions.push(eq(cargoShipments.status, status));
    if (search) {
      baseConditions.push(
        or(
          ilike(cargoShipments.cargoNo, `%${search}%`),
          ilike(cargoShipments.carrierName, `%${search}%`)
        )!
      );
    }
    const whereClause = and(...baseConditions);

    const sortCol =
      sort === "status" ? cargoShipments.status :
      sort === "cargoNo" ? cargoShipments.cargoNo :
      cargoShipments.createdAt;
    const orderFn = order === "asc" ? asc : desc;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: cargoShipments.id,
          cargoNo: cargoShipments.cargoNo,
          carrierName: cargoShipments.carrierName,
          status: cargoShipments.status,
          exchangeRate: cargoShipments.exchangeRate,
          createdAt: cargoShipments.createdAt,
          deletedAt: cargoShipments.deletedAt,
          totalWeight: sql<number>`(SELECT COALESCE(SUM(ci.weight_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`,
          itemCount: sql<number>`(SELECT COUNT(*)::int FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`,
          carrierOwed: sql<number>`(SELECT COALESCE(SUM(ci.weight_kg * ci.carrier_rate_per_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`,
          receiverOwed: sql<number>`(SELECT COALESCE(SUM(ci.weight_kg * ci.receiver_rate_per_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`,
        })
        .from(cargoShipments)
        .where(whereClause)
        .orderBy(orderFn(sortCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(cargoShipments)
        .where(whereClause),
    ]);

    return NextResponse.json({
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error("[GET /api/cargo-shipments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCargoShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    const { items, ...shipmentData } = parsed.data;

    const shipmentId = nanoid();
    // The number, the shipment and its items are saved, and recorded, together,
    // once per submission (AUDIT.md F-13, F-14).
    return await createOnce(req, session, parsed.data, async (tx) => {
      const [settings] = await tx
        .select({ cargoIdPrefix: shopSettings.cargoIdPrefix })
        .from(shopSettings)
        .limit(1);
      const prefix = (settings?.cargoIdPrefix ?? "CG").replace(/-+$/, "");
      const cargoNo = await nextDisplayNumber(tx, cargoShipments, cargoShipments.cargoNo, prefix, "prefix");

      const [created] = await tx.insert(cargoShipments).values({
        id: shipmentId,
        cargoNo,
        ...shipmentData,
      }).returning();

      if (items && items.length > 0) {
        await tx.insert(cargoItems).values(
          items.map((item) => ({
            id: nanoid(),
            cargoShipmentId: shipmentId,
            orderId: item.orderId ?? null,
            customerId: item.customerId ?? null,
            orderItemId: item.orderItemId,
            categoryId: item.categoryId,
            weightKg: item.weightKg,
            carrierRatePerKg: item.carrierRatePerKg,
            receiverRatePerKg: item.receiverRatePerKg,
          }))
        );
      }
      return created;
    });
  } catch (err) {
    console.error("[POST /api/cargo-shipments]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
