/**
 * Read-only precision report for AUDIT.md finding F-09 (money and rates stored
 * as double precision). Run it against a database before choosing the numeric
 * types and rounding rule for the migration.
 *
 * It never writes: the session is made read-only before any query, and every
 * query runs inside a READ ONLY transaction. It prints aggregates only — no
 * individual records.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/f09-money-precision-report.mjs
 *
 * Per double-precision column it reports rows, nulls, NaN/±Infinity (which a
 * numeric column can't hold — fix those first), negatives, the largest absolute
 * value and the digits it needs before the decimal point, the most decimals
 * used, how many values have more decimals than the proposed scale, the biggest
 * change rounding would make, and the column total as stored vs after rounding.
 * It also counts orders by service_fee_type, which F-10 depends on.
 *
 * Values are compared through float8 -> numeric, which keeps 15 significant
 * digits — the same conversion a `USING round(col::numeric, n)` migration would
 * use — so binary noise like 0.30000000000000004 reads as a clean 0.3.
 * Soft-deleted rows are included, because a type change converts them too.
 */

import postgres from "postgres";
import { pathToFileURL } from "node:url";

// Proposed scale per kind (decimal places): money 2, rates 6, weights 3.
const COLUMNS = [
  ["orders", "shipping_fee", "money", 2],
  ["orders", "delivery_fee", "money", 2],
  ["orders", "cargo_fee", "money", 2],
  ["orders", "service_fee", "money or %", 2],
  ["orders", "product_discount", "money", 2],
  ["order_items", "price", "money", 2],
  ["expenses", "amount", "money", 2],
  ["cargo_payments", "amount", "money", 2],
  ["cargo_expenses", "amount", "money", 2],
  ["orders", "exchange_rate", "rate", 6],
  ["cargo_shipments", "exchange_rate", "rate", 6],
  ["cargo_payments", "exchange_rate", "rate", 6],
  ["cargo_items", "carrier_rate_per_kg", "rate", 6],
  ["cargo_items", "receiver_rate_per_kg", "rate", 6],
  ["cargo_categories", "carrier_rate_per_kg", "rate", 6],
  ["cargo_categories", "receiver_rate_per_kg", "rate", 6],
  ["order_items", "product_weight", "weight", 3],
  ["cargo_items", "weight_kg", "weight", 3],
];

const integerDigits = (maxAbs) => (maxAbs === null || Number(maxAbs) < 1 ? 1 : Math.floor(Math.log10(Number(maxAbs))) + 1);

/** Builds the report using `sql`, which should be a read-only transaction. */
export async function precisionReport(sql) {
  const present = new Map(
    (
      await sql`
        select table_name || '.' || column_name as col, data_type
        from information_schema.columns
        where table_schema = current_schema()`
    ).map((r) => [r.col, r.data_type])
  );

  const columns = [];
  for (const [table, column, kind, dp] of COLUMNS) {
    const name = `${table}.${column}`;
    const dataType = present.get(name);
    if (!dataType) {
      columns.push({ column: name, type: "(missing)" });
      continue;
    }
    const [r] = await sql`
      with v as (
        select x, case when x in ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8) then null else x::numeric end as n
        from (select ${sql(column)}::float8 as x from ${sql(table)}) raw
      )
      select
        count(*)::int as rows,
        count(*) filter (where x is null)::int as nulls,
        count(*) filter (where x is not null and n is null)::int as non_finite,
        count(*) filter (where n < 0)::int as negatives,
        max(abs(n))::text as max_abs,
        coalesce(max(scale(n)), 0)::int as max_decimals,
        count(*) filter (where scale(n) > ${dp})::int as over_scale,
        coalesce(max(abs(n - round(n, ${dp}))), 0)::text as max_round_change,
        coalesce(sum(x) filter (where n is not null), 0)::text as total_as_stored,
        coalesce(sum(round(n, ${dp})), 0)::text as total_rounded
      from v`;
    columns.push({
      column: name,
      type: dataType,
      kind: `${kind} (${dp}dp)`,
      rows: r.rows,
      nulls: r.nulls,
      nonFinite: r.non_finite,
      negatives: r.negatives,
      maxAbs: r.max_abs,
      intDigits: integerDigits(r.max_abs),
      maxDecimals: r.max_decimals,
      overScale: r.over_scale,
      maxRoundChange: r.max_round_change,
      totalAsStored: r.total_as_stored,
      totalRounded: r.total_rounded,
    });
  }

  let serviceFeeTypes = [];
  if (present.has("orders.service_fee_type") && present.has("orders.service_fee")) {
    serviceFeeTypes = await sql`
      select service_fee_type as type, count(*)::int as orders,
             count(*) filter (where service_fee <> 0)::int as nonzero,
             max(service_fee)::text as max_value
      from orders group by service_fee_type order by service_fee_type`;
  }

  return { columns, serviceFeeTypes: serviceFeeTypes.map((r) => ({ ...r })) };
}

/** A single-connection client whose session refuses writes. */
export async function openReadOnly(url) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`set session characteristics as transaction read only`;
  return sql;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the database to inspect. Nothing is written.");
    process.exit(1);
  }
  const target = new URL(url);
  const sql = await openReadOnly(url);
  try {
    const report = await sql.begin("read only", async (tx) => {
      await tx`set local statement_timeout = '60s'`;
      const [{ version }] = await tx`select current_setting('server_version') as version`;
      return { version, ...(await precisionReport(tx)) };
    });

    console.log(`F-09 precision report — ${target.hostname}/${target.pathname.slice(1)} (PostgreSQL ${report.version}), ${new Date().toISOString()}`);
    console.log("Read-only. Aggregates over all rows, soft-deleted included.\n");
    console.table(report.columns);
    if (report.serviceFeeTypes.length) {
      console.log("\nOrders by service_fee_type (for F-10):");
      console.table(report.serviceFeeTypes);
    }
    console.log(
      [
        "",
        "How to read it:",
        "  nonFinite > 0      NaN/Infinity values must be corrected before any numeric migration.",
        "  intDigits          digits needed before the decimal point: pick precision ≥ intDigits + scale (+ headroom).",
        "  overScale          rows whose value would change when rounded to the proposed scale.",
        "  maxRoundChange     the largest single change that rounding would make.",
        "  totalAsStored vs totalRounded   the reconciliation difference for that column.",
        "  service_fee_type   a 'percent' row with max_value > 100 suggests a mislabelled fixed fee.",
      ].join("\n")
    );
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Report failed:", err.message);
    process.exit(1);
  });
}
