/**
 * Read-only migration state report for AUDIT.md finding F-20. Run it against a
 * database before running `npm run db:migrate` there.
 *
 * `drizzle-kit migrate` decides what to run from one value: the newest created_at
 * in drizzle.__drizzle_migrations (drizzle-orm pg-core/dialect.js migrate()).
 * Every journal entry dated later runs, all in one transaction. Migrations applied
 * by hand aren't recorded, and 0001/0002 are dated before 0000, so that table alone
 * doesn't say what a database has. For each migration in drizzle/ this shows:
 *   - recorded: a row with the same file hash exists (applied by drizzle-kit
 *     migrate from this exact file)
 *   - changes present: a schema check for what the migration creates or alters
 *   - migrate would run: what `drizzle-kit migrate` would run here now
 * A migration that would run although its changes are already present either
 * fails, rolling back the whole run, or repeats itself. Apply the missing ones by
 * hand instead. Recorded rows that match no file are listed too.
 *
 * It never writes: the session is made read-only before any query. It prints
 * table and column checks, migration names, dates and row ids only — no records.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/f20-migration-state-report.mjs
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";

const DRIZZLE_FOLDER = fileURLToPath(new URL("../drizzle/", import.meta.url));

// A check for what each migration creates or alters, in the current schema, using
// its last or most distinctive change. `col` is information_schema.columns for the
// current schema. A migration without a check is reported as "not checked".
const CHANGES = {
  "0000_burly_darkhawk": `to_regclass('users') is not null and to_regclass('orders') is not null and to_regclass('shop_settings') is not null`,
  "0001_service_fee_type_normalize": `exists(select 1 from col where t = 'orders' and c = 'service_fee_type' and nullable = 'NO' and dflt like '''percent''%')`,
  "0002_add_cargo_tables": `to_regclass('cargo_payments') is not null and exists(select 1 from col where t = 'shop_settings' and c = 'cargo_id_prefix')`,
  "0003_cargo_item_direct_customer": `exists(select 1 from col where t = 'cargo_items' and c = 'customer_id') and exists(select 1 from col where t = 'cargo_items' and c = 'order_id' and nullable = 'YES')`,
  "0004_cargo_item_bag_label": `exists(select 1 from col where t = 'cargo_items' and c = 'bag_label')`,
  "0005_cargo_expenses": `to_regclass('cargo_expenses') is not null`,
  "0006_widen_cargo_customer_id": `exists(select 1 from col where t = 'cargo_items' and c = 'customer_id' and data_type = 'text') and exists(select 1 from col where t = 'cargo_payments' and c = 'customer_id' and data_type = 'text')`,
  "0007_cargo_item_public_code": `exists(select 1 from col where t = 'cargo_items' and c = 'public_code' and nullable = 'NO')`,
  "0008_order_note": `exists(select 1 from col where t = 'orders' and c = 'note')`,
  "0009_user_session_version": `exists(select 1 from col where t = 'users' and c = 'session_version')`,
  "0010_shop_currency": `exists(select 1 from col where t = 'shop_settings' and c = 'default_exchange_rate')`,
  "0011_audit_log": `to_regclass('audit_log') is not null and exists(select 1 from pg_trigger g join pg_class k on k.oid = g.tgrelid where g.tgname = 'audit_log_record' and k.relname = 'users')`,
  "0012_idempotency_keys": `to_regclass('idempotency_keys') is not null`,
};

/** Builds the report using `sql`, which should be a read-only connection or transaction. */
export async function migrationStateReport(
  sql,
  { migrationsFolder = DRIZZLE_FOLDER, migrationsSchema = "drizzle", migrationsTable = "__drizzle_migrations" } = {}
) {
  const { entries } = JSON.parse(readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"));
  // The same hashes and dates drizzle-kit migrate uses, one per journal entry in order.
  const files = readMigrationFiles({ migrationsFolder });
  const list = entries.map((entry, i) => ({ tag: entry.tag, when: files[i].folderMillis, hash: files[i].hash }));

  const [{ exists: table }] = await sql`
    select to_regclass(format('%I.%I', ${migrationsSchema}::text, ${migrationsTable}::text)) is not null as exists`;
  const rows = table
    ? await sql`select id, hash, created_at from ${sql(migrationsSchema)}.${sql(migrationsTable)} order by created_at, id`
    : [];
  // The same query migrate uses to pick the row it compares against (NULLs sort first).
  const [newestRow] = table
    ? await sql`select id, hash, created_at from ${sql(migrationsSchema)}.${sql(migrationsTable)} order by created_at desc limit 1`
    : [];
  const newestAt = newestRow ? Number(newestRow.created_at) : null;

  const [present] = await sql.unsafe(`
    with col as (
      select table_name as t, column_name as c, is_nullable as nullable, data_type, column_default as dflt
      from information_schema.columns
      where table_schema = current_schema()
    )
    select ${list.map((m, i) => `${CHANGES[m.tag] ? `(${CHANGES[m.tag]})` : "null::boolean"} as c${i}`).join(", ")}`);

  const byHash = new Map(list.map((m) => [m.hash, m.tag]));
  const byDate = new Map(list.map((m) => [m.when, m.tag]));
  const recorded = new Set(rows.map((r) => r.hash));
  const migrations = list.map((m, i) => ({
    tag: m.tag,
    when: m.when,
    date: new Date(m.when).toISOString(),
    recorded: recorded.has(m.hash),
    present: present[`c${i}`],
    // migrate's rule: with nothing recorded everything runs, otherwise every entry dated later than the newest row.
    wouldRun: newestAt === null || newestAt < m.when,
  }));
  const tagsWhere = (keep) => migrations.filter(keep).map((m) => m.tag);

  return {
    version: (await sql`select current_setting('server_version') as v`)[0].v,
    table,
    rows: rows.length,
    newest: newestRow ? { id: newestRow.id, createdAt: newestAt, tag: byHash.get(newestRow.hash) ?? byDate.get(newestAt) ?? null } : null,
    migrations,
    unmatched: rows
      .filter((r) => !byHash.has(r.hash))
      .map((r) => ({ id: r.id, createdAt: Number(r.created_at), sameDateAs: byDate.get(Number(r.created_at)) ?? null })),
    wouldRun: tagsWhere((m) => m.wouldRun),
    conflicts: tagsWhere((m) => m.wouldRun && m.present === true),
    missing: tagsWhere((m) => m.present === false),
  };
}

/** A connection whose every transaction is read-only, as in the F-09 report. */
export async function openReadOnly(url) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`set session characteristics as transaction read only`;
  return sql;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the database to inspect.");
    process.exit(1);
  }
  const target = new URL(url);
  const sql = await openReadOnly(url);
  try {
    const report = await migrationStateReport(sql);
    console.log(`F-20 migration state — ${target.hostname}/${target.pathname.slice(1)} (PostgreSQL ${report.version}), ${new Date().toISOString()}`);
    console.log("Read-only. Compares drizzle/meta/_journal.json with drizzle.__drizzle_migrations and the schema.\n");
    if (report.newest) {
      const { createdAt, tag } = report.newest;
      console.log(`drizzle.__drizzle_migrations: ${report.rows} rows; newest created_at ${createdAt} (${new Date(createdAt).toISOString()})${tag ? `, from ${tag}` : ""}.`);
    } else if (report.table) {
      console.log("drizzle.__drizzle_migrations exists but is empty.");
    } else {
      console.log("No drizzle.__drizzle_migrations table: drizzle-kit migrate has never run here (built with db:push or by hand).");
    }
    console.table(
      report.migrations.map((m) => ({
        migration: m.tag,
        dated: m.date,
        recorded: m.recorded,
        "changes present": m.present ?? "not checked",
        "migrate would run": m.wouldRun,
      }))
    );
    if (report.unmatched.length > 0) {
      console.log("\nRecorded rows that match no migration file (a file edited after it was applied, or one not in this checkout):");
      console.table(report.unmatched.map((r) => ({ id: r.id, created_at: r.createdAt, "same date as": r.sameDateAs ?? "-" })));
    }
    console.log(`\n\`drizzle-kit migrate\` would run ${report.wouldRun.length} migration(s)${report.wouldRun.length ? `: ${report.wouldRun.join(", ")}` : ""}.`);
    if (report.conflicts.length > 0) {
      console.log(
        `WARNING: ${report.conflicts.length} of them already have their changes here (${report.conflicts.join(", ")}). ` +
          "Don't run db:migrate on this database: it would fail and roll back, or repeat them. " +
          "Apply only the missing ones by hand (AUDIT.md F-06 deploy note, F-33)."
      );
    }
    console.log(`Changes missing: ${report.missing.length ? report.missing.join(", ") : "none"}.`);
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
