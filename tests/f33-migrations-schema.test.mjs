// Demonstration + guard for AUDIT.md finding F-33.
//
// F-33: a database built only from drizzle/*.sql lacked columns the code uses.
// Migration 0000 named expenses.title and expenses.expense_date `description` and
// `date`, and no migration created expenses.expense_id or cargo_items.note. The
// databases in use got them through `db:push`, so rebuilding from migrations (a
// new environment, disaster recovery) gave an app whose expenses, trash and public
// tracking pages failed.
//
// Fix under test: migration 0013_expenses_cargo_note_columns renames and adds the
// missing columns only where they are missing, so it changes nothing on a
// database that already has them.
//
// The first test builds the schema from every migration file, in journal order,
// in a schema of its own inside a transaction that is rolled back, and compares
// its columns with every column the code's Drizzle schema declares (listed by
// tests/helpers/schema-columns.ts). A schema change without a migration fails it.
//
// Needs a THROWAWAY database (no app server):
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f33-migrations-schema.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DB_URL, auditDb } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const skip = DB_URL ? false : "set AUDIT_DATABASE_URL (a throwaway database) to run";
const NEW_MIGRATION = "0013_expenses_cargo_note_columns";
class Rollback extends Error {}

/** Each migration's statements, split the way drizzle-kit migrate splits them, in journal order. */
function migrations() {
  const { entries } = JSON.parse(read("drizzle/meta/_journal.json"));
  return entries.map(({ tag }) => ({
    tag,
    statements: read(`drizzle/${tag}.sql`).split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean),
  }));
}

/** Runs `fn` in a transaction that is always rolled back. */
async function inRolledBackTransaction(fn) {
  const sql = auditDb();
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  } finally {
    await sql.end();
  }
}

test("F-33: a database built only from the migrations has every column the code uses", { skip }, async () => {
  const listing = spawnSync(join(root, "node_modules/.bin/tsx"), ["tests/helpers/schema-columns.ts"], { cwd: root, encoding: "utf8", timeout: 60_000 });
  assert.equal(listing.status, 0, `listing the schema's columns failed:\n${listing.stderr}`);
  const expected = JSON.parse(listing.stdout.trim().split("\n").at(-1));
  assert.ok(expected.includes("users.name") && expected.length > 50, `unexpected column list: ${expected.length} columns`);

  const schema = `f33_${randomBytes(4).toString("hex")}`;
  let missing;
  await inRolledBackTransaction(async (tx) => {
    await tx`create schema ${tx(schema)}`;
    await tx.unsafe(`set local search_path to "${schema}"`);
    for (const { tag, statements } of migrations()) {
      for (const statement of statements) {
        await tx.unsafe(statement).catch((err) => {
          throw new Error(`${tag} failed on a fresh schema: ${err.message}`);
        });
      }
    }
    const built = new Set(
      (await tx`select table_name || '.' || column_name as col from information_schema.columns where table_schema = ${schema}`).map((r) => r.col)
    );
    missing = expected.filter((column) => !built.has(column));
  });
  assert.deepEqual(missing, [], "columns the code uses that the migrations never create");
});

test("F-33: the new migration changes nothing on a database that already has the columns", { skip }, async () => {
  const migration = migrations().find((m) => m.tag === NEW_MIGRATION);
  assert.ok(migration, `drizzle/${NEW_MIGRATION}.sql is missing from the journal`);

  // The throwaway database got these columns the way db:push would have (tests/helpers/audit-session.mjs).
  await inRolledBackTransaction(async (tx) => {
    const columns = async () =>
      (await tx`
        select table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable as col
        from information_schema.columns
        where table_schema = current_schema() and table_name in ('expenses', 'cargo_items')
        order by 1`).map((r) => r.col);
    const before = await columns();
    for (let pass = 1; pass <= 2; pass++) {
      for (const statement of migration.statements) await tx.unsafe(statement);
    }
    assert.deepEqual(await columns(), before, "running the migration changed a database that already had the columns");
  });
});
