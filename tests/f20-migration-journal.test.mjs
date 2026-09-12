// Demonstration + guard for AUDIT.md finding F-20.
//
// F-20: `drizzle-kit migrate` (drizzle-orm pg-core/dialect.js migrate()) reads only
// the newest created_at recorded in drizzle.__drizzle_migrations and runs every
// journal entry with a larger `when`. An entry dated earlier than one before it is
// skipped on any database that already recorded the later one, and nothing reports
// it. Entries 0001 and 0002 were written with 2025 for 2026, and nothing checked.
//
// Fix under test:
//   - scripts/check-migration-journal.mjs refuses a journal whose dates don't move
//     forward, or whose entries and .sql files don't match; npm runs it before
//     `build` and `db:migrate`. 0001 and 0002 keep their dates (re-dating them
//     would change what migrate runs on some databases) and are the only exceptions.
//   - scripts/f20-migration-state-report.mjs reports, read-only, what a database
//     recorded, what `drizzle-kit migrate` would run there, and whether each
//     migration's changes are already present.
//
// The first three tests need nothing. The report tests need a THROWAWAY database
// with every migration applied (no app server):
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f20-migration-journal.test.mjs
// They create a migrations table in a schema of their own, inside a transaction
// that is rolled back.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { DB_URL, auditDb } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8"));
const tags = journal.entries.map((e) => e.tag);
const migrations = readMigrationFiles({ migrationsFolder: join(root, "drizzle") });
const skip = DB_URL ? false : "set AUDIT_DATABASE_URL (a throwaway database with every migration applied) to run";
class Rollback extends Error {}

/**
 * The migrations drizzle-orm's own migrate() runs on a database whose newest
 * recorded created_at is `newest` (undefined: nothing recorded). A stand-in
 * session records what it would insert into the migrations table.
 */
async function plan(list, newest) {
  const dialect = new PgDialect();
  const ran = [];
  const tx = {
    execute: async (query) => {
      const { sql, params } = dialect.sqlToQuery(query);
      if (/^insert into "drizzle"\."__drizzle_migrations"/.test(sql)) ran.push(params[0]);
    },
  };
  const session = {
    execute: async () => {},
    all: async () => (newest === undefined ? [] : [{ id: 1, hash: "recorded", created_at: String(newest) }]),
    transaction: async (fn) => fn(tx),
  };
  await dialect.migrate(list, session, {});
  return ran.map((hash) => tags[migrations.findIndex((m) => m.hash === hash)] ?? hash);
}

test("F-20: the journal check refuses entries drizzle would skip or never see", async () => {
  const { journalProblems } = await import("../scripts/check-migration-journal.mjs");
  const files = tags.map((t) => `${t}.sql`);
  const last = journal.entries.at(-1);
  const withEntry = (extra) => ({
    ...journal,
    entries: [...journal.entries, { idx: journal.entries.length, version: "7", breakpoints: true, ...extra }],
  });

  assert.deepEqual(journalProblems(journal, files), [], "this repository's journal passes");
  assert.deepEqual(journalProblems(withEntry({ tag: "0013_x", when: Date.now() }), [...files, "0013_x.sql"]), []);

  const early = journalProblems(withEntry({ tag: "0013_x", when: last.when - 1 }), [...files, "0013_x.sql"]);
  assert.equal(early.length, 1, early.join("\n"));
  assert.match(early[0], new RegExp(`0013_x .*not later than ${last.tag}`));
  assert.equal(journalProblems(withEntry({ tag: "0013_x", when: last.when }), [...files, "0013_x.sql"]).length, 1, "the same time is not later");
  // The exceptions are only for 0001 and 0002 at their existing dates.
  assert.match(
    journalProblems(withEntry({ tag: "0013_x", when: 1753420800000 }), [...files, "0013_x.sql"]).join("\n"),
    /0013_x .*not later than/,
    "a new entry with a legacy date is refused"
  );
  const edited = structuredClone(journal);
  edited.entries[1].when += 1;
  assert.match(journalProblems(edited, files).join("\n"), /0001_service_fee_type_normalize .*not later than 0000_burly_darkhawk/);

  assert.match(journalProblems(withEntry({ tag: "0013_x", when: Date.now() }), files).join("\n"), /0013_x has no 0013_x\.sql/);
  assert.match(journalProblems(journal, [...files, "0013_x.sql"]).join("\n"), /0013_x\.sql has no journal entry/);
  assert.match(journalProblems(withEntry({ idx: 99, tag: "0013_x", when: Date.now() }), [...files, "0013_x.sql"]).join("\n"), /idx 99/);
  assert.match(journalProblems(withEntry({ tag: "0013_x", when: String(Date.now()) }), [...files, "0013_x.sql"]).join("\n"), /milliseconds/);
  assert.match(journalProblems(withEntry({ tag: "0012_idempotency_keys", when: Date.now() }), files).join("\n"), /more than once/);
});

test("F-20: npm checks the journal before build and db:migrate, and this journal passes", () => {
  const { scripts } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const hook of ["prebuild", "predb:migrate"]) {
    assert.match(scripts[hook] ?? "", /node scripts\/check-migration-journal\.mjs/, `package.json has no ${hook} check`);
  }
  const r = spawnSync(process.execPath, ["scripts/check-migration-journal.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`Migration journal OK: ${tags.length} entries`));
  // drizzle-kit generate dates a new entry with the current time; an entry dated
  // after that would make the next generated migration look already applied.
  const newest = Math.max(...journal.entries.map((e) => e.when));
  assert.ok(newest <= Date.now(), `a journal entry is dated in the future: ${new Date(newest).toISOString()}`);
});

test("F-20: drizzle's migrator skips, without an error, an entry dated before the newest recorded one", async () => {
  const newest = migrations.at(-1).folderMillis;
  const example = { sql: ["select 1"], bps: true, hash: "f20-example" };
  assert.deepEqual(await plan([...migrations, { ...example, folderMillis: newest + 1 }], newest), ["f20-example"]);
  assert.deepEqual(await plan([...migrations, { ...example, folderMillis: newest - 1 }], newest), [], "dated one millisecond too early: skipped");

  // What each database that ran migrate after entry k existed has recorded, and
  // what migrate would run there now. A database that stopped at 0000 or 0001
  // would skip up to 0002; its run then fails at 0003, which alters a 0002 table.
  assert.deepEqual(await plan(migrations), tags, "an empty database runs everything in order");
  for (let k = 0; k < migrations.length; k++) {
    const newestRecorded = Math.max(...migrations.slice(0, k + 1).map((m) => m.folderMillis));
    assert.deepEqual(await plan(migrations, newestRecorded), tags.slice(Math.max(k + 1, 3)), `recorded ${tags[0]} to ${tags[k]}`);
  }
});

test("F-20 report: shows what a database recorded and what drizzle-kit migrate would run there", { skip }, async () => {
  const { migrationStateReport } = await import("../scripts/f20-migration-state-report.mjs");
  const sql = auditDb();
  const schema = `f20_${randomBytes(4).toString("hex")}`;
  const options = { migrationsFolder: join(root, "drizzle"), migrationsSchema: schema };
  try {
    await sql.begin(async (tx) => {
      // No migrations table, as on a database built with db:push or by hand.
      const none = await migrationStateReport(tx, options);
      assert.equal(none.table, false);
      assert.equal(none.newest, null);
      assert.deepEqual(none.wouldRun, tags);
      assert.deepEqual(none.missing, [], "the throwaway database has every migration's changes");
      assert.deepEqual(none.conflicts, tags, "so running any of them here would clash");

      // As production was found on 2026-08-12: 0000–0004 recorded, later ones applied by hand.
      await tx`create schema ${tx(schema)}`;
      await tx`create table ${tx(schema)}.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
      for (const m of migrations.slice(0, 5)) {
        await tx`insert into ${tx(schema)}.__drizzle_migrations (hash, created_at) values (${m.hash}, ${m.folderMillis})`;
      }
      // A row whose file was edited after it was applied: its date matches 0003, its hash doesn't.
      await tx`insert into ${tx(schema)}.__drizzle_migrations (hash, created_at) values ('f20-edited', ${migrations[3].folderMillis})`;

      const report = await migrationStateReport(tx, options);
      assert.equal(report.table, true);
      assert.deepEqual(report.migrations.filter((m) => m.recorded).map((m) => m.tag), tags.slice(0, 5));
      assert.equal(report.newest.tag, tags[4]);
      assert.deepEqual(report.wouldRun, tags.slice(5));
      assert.deepEqual(report.wouldRun, await plan(migrations, report.newest.createdAt), "the report agrees with drizzle's own migrator");
      assert.deepEqual(report.conflicts, tags.slice(5));
      assert.deepEqual(report.unmatched.map((r) => r.sameDateAs), [tags[3]]);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  } finally {
    await sql.end();
  }
});

test("F-20 report: its connection refuses writes", { skip }, async () => {
  const { openReadOnly } = await import("../scripts/f20-migration-state-report.mjs");
  await auditDb().end(); // validates the URL is a local audit* database first
  const ro = await openReadOnly(DB_URL);
  try {
    await assert.rejects(ro`create schema f20_must_not_exist`, /read-only transaction/);
  } finally {
    await ro.end();
  }
});

test("F-20 report: the script runs end to end without printing credentials", { skip }, async () => {
  await auditDb().end();
  const r = spawnSync(process.execPath, ["scripts/f20-migration-state-report.mjs"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: DB_URL },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 0, `report failed:\n${r.stderr}`);
  assert.match(r.stdout, /F-20 migration state/);
  assert.match(r.stdout, /0012_idempotency_keys/);
  assert.ok(!r.stdout.includes(new URL(DB_URL).password), "the database password must not be printed");
});
