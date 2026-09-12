import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cargoCategories, cargoShipments, customers, orderItems, orders } from "@/db/schema";
import type { Tx } from "@/lib/audit";

const RECORDS = {
  order: [orders, "Order"],
  orderItem: [orderItems, "Order item"],
  customer: [customers, "Customer"],
  shipment: [cargoShipments, "Cargo shipment"],
  category: [cargoCategories, "Cargo category"],
} as const;

export type RecordKind = keyof typeof RECORDS;

/**
 * Checks, inside a write's transaction, that every record a new or changed row
 * points at exists and isn't in the trash (AUDIT.md F-25). Each record found is
 * share-locked, so it can't be moved to the trash or deleted until the
 * transaction ends. Returns a 404 naming the first record that's missing, or
 * null when all are there. Empty ids are skipped, and each id is checked once.
 */
export async function missingRecord(
  tx: Tx,
  refs: ReadonlyArray<readonly [RecordKind, string | null | undefined]>
): Promise<NextResponse | null> {
  const checked = new Set<string>();
  for (const [kind, id] of refs) {
    if (!id || checked.has(`${kind}:${id}`)) continue;
    checked.add(`${kind}:${id}`);
    const [table, label] = RECORDS[kind];
    const found = await tx.execute(sql`select 1 from ${table} where ${table.id} = ${id} and ${table.deletedAt} is null for share`);
    if (found.length === 0) return NextResponse.json({ error: `${label} not found` }, { status: 404 });
  }
  return null;
}
