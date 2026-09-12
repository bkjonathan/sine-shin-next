import { getTableName, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Tx } from "@/lib/audit";

/**
 * The next display number, such as ORD-00042: one more than the highest number
 * already stored (AUDIT.md F-13). Call it inside the transaction that inserts
 * the record. The advisory lock makes another create of the same kind wait here
 * until this transaction commits or rolls back, so it then sees this record and
 * takes the number after it instead of the same one.
 *
 * "prefix" counts only IDs with this prefix (orders, shipments), so a new prefix
 * starts at 00001; "all" counts every ID whatever its prefix (customers,
 * expenses). Only PREFIX-digits IDs count, so one malformed stored ID can't make
 * every later create fail. The number of a permanently deleted top record is
 * given out again (owner's decision, 2026-09-12).
 */
export async function nextDisplayNumber(
  tx: Tx,
  table: PgTable,
  column: PgColumn,
  prefix: string,
  count: "prefix" | "all",
): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`display-number:${getTableName(table)}`}))`);
  const digits = count === "prefix"
    ? sql`substring(
        case when left(${column}, length(${prefix}::text) + 1) = ${prefix}::text || '-'
             then substr(${column}, length(${prefix}::text) + 2) end
        from '^[0-9]{1,18}$')`
    : sql`substring(${column} from '^[^-]+-([0-9]{1,18})$')`;
  const [{ next }] = await tx.execute<{ next: string }>(sql`
    select (coalesce(max((${digits})::bigint), 0) + 1)::text as next from ${table}`);
  return `${prefix}-${next.padStart(5, "0")}`;
}
