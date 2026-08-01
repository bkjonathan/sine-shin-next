import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cargoShipments } from "@/db/schema";
import { isNull, sql, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { CargoShipmentListItem } from "@/types";
import type { DashboardCargoStats, DashboardCargoData } from "@/types/dashboard";

// Item-derived measures via correlated subqueries (mirrors /api/cargo-shipments)
const weightSql    = sql<number>`(SELECT COALESCE(SUM(ci.weight_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`;
const itemCountSql = sql<number>`(SELECT COUNT(*)::int FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`;
const carrierSql   = sql<number>`(SELECT COALESCE(SUM(ci.weight_kg * ci.carrier_rate_per_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`;
const receiverSql  = sql<number>`(SELECT COALESCE(SUM(ci.weight_kg * ci.receiver_rate_per_kg), 0) FROM cargo_items ci WHERE ci.cargo_shipment_id = cargo_shipments.id AND ci.deleted_at IS NULL)`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo   = searchParams.get("dateTo");

  try {
    const conds = [isNull(cargoShipments.deletedAt)] as ReturnType<typeof sql>[];
    if (dateFrom) conds.push(sql`${cargoShipments.createdAt} >= ${dateFrom}::timestamptz`);
    if (dateTo)   conds.push(sql`${cargoShipments.createdAt} <= ${dateTo + "T23:59:59"}::timestamptz`);
    const where = and(...conds);

    const rows = await db
      .select({
        id:           cargoShipments.id,
        cargoNo:      cargoShipments.cargoNo,
        carrierName:  cargoShipments.carrierName,
        status:       cargoShipments.status,
        exchangeRate: cargoShipments.exchangeRate,
        createdAt:    cargoShipments.createdAt,
        deletedAt:    cargoShipments.deletedAt,
        totalWeight:  weightSql,
        itemCount:    itemCountSql,
        carrierOwed:  carrierSql,
        receiverOwed: receiverSql,
      })
      .from(cargoShipments)
      .where(where)
      .orderBy(desc(cargoShipments.createdAt));

    const stats: DashboardCargoStats = {
      total_shipments: rows.length,
      pending: 0,
      in_transit: 0,
      arrived: 0,
      delivered: 0,
      cancelled: 0,
      total_weight: 0,
      carrier_owed: 0,
      receiver_owed: 0,
    };

    for (const r of rows) {
      stats.total_weight  += Number(r.totalWeight ?? 0);
      stats.carrier_owed  += Number(r.carrierOwed ?? 0);
      stats.receiver_owed += Number(r.receiverOwed ?? 0);
      if (r.status === "pending")    stats.pending += 1;
      else if (r.status === "in_transit") stats.in_transit += 1;
      else if (r.status === "arrived")    stats.arrived += 1;
      else if (r.status === "delivered")  stats.delivered += 1;
      else if (r.status === "cancelled")  stats.cancelled += 1;
    }

    const recent: CargoShipmentListItem[] = rows.slice(0, 5).map((r) => ({
      ...r,
      totalWeight:  Number(r.totalWeight ?? 0),
      itemCount:    Number(r.itemCount ?? 0),
      carrierOwed:  Number(r.carrierOwed ?? 0),
      receiverOwed: Number(r.receiverOwed ?? 0),
    }));

    const data: DashboardCargoData = { stats, recent };
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/dashboard/cargo]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", message }, { status: 500 });
  }
}
