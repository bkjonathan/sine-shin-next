/**
 * Refuses a Drizzle migration journal that `drizzle-kit migrate` would apply
 * wrongly (AUDIT.md F-20). npm runs it before `build` and `db:migrate`.
 *
 * drizzle-orm's migrator (pg-core/dialect.js migrate()) looks only at the newest
 * created_at recorded in drizzle.__drizzle_migrations and runs every journal
 * entry with a larger `when`. An entry dated no later than one before it is
 * therefore skipped, without an error, on any database that recorded that one.
 * `drizzle-kit generate` dates a new entry with the current time; a hand-written
 * entry must do the same (Date.now()).
 *
 * It also refuses entries without a .sql file, which migrate fails on, and .sql
 * files without an entry, which migrate never runs.
 *
 * Usage: node scripts/check-migration-journal.mjs [migrations folder, default drizzle/]
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Written with 2025 for 2026 (their files were committed on 2026-03-31 and
// 2026-07-26), so they are dated before 0000. They keep those dates: to migrate, a
// database that recorded only 0000 looks the same as one that recorded 0000–0002,
// and re-dating them would make migrate re-run 0002 on the second kind. Allowed at
// exactly these values only; every later entry must still be later than all of them.
const LEGACY_OUT_OF_ORDER = new Map([
  ["0001_service_fee_type_normalize", 1743379200000],
  ["0002_add_cargo_tables", 1753420800000],
]);

const iso = (ms) => new Date(ms).toISOString();

/** Problems with a parsed meta/_journal.json, given the .sql file names beside it. Empty when it's fine. */
export function journalProblems(journal, sqlFiles) {
  const problems = [];
  const seen = new Set();
  let newest = null;

  (journal?.entries ?? []).forEach((entry, i) => {
    if (entry.idx !== i) problems.push(`${entry.tag} has idx ${entry.idx}; entries must be numbered 0, 1, 2, … in order (expected ${i})`);
    if (seen.has(entry.tag)) problems.push(`${entry.tag} appears more than once`);
    seen.add(entry.tag);
    if (!sqlFiles.includes(`${entry.tag}.sql`)) problems.push(`${entry.tag} has no ${entry.tag}.sql file`);

    if (!Number.isSafeInteger(entry.when)) {
      problems.push(`${entry.tag} has when ${JSON.stringify(entry.when)}; it must be milliseconds since 1970, e.g. Date.now()`);
      return;
    }
    if (newest && entry.when <= newest.when && LEGACY_OUT_OF_ORDER.get(entry.tag) !== entry.when) {
      problems.push(
        `${entry.tag} is dated ${iso(entry.when)}, not later than ${newest.tag} (${iso(newest.when)}), ` +
          `so drizzle-kit migrate would skip it on any database that recorded ${newest.tag}; date it with Date.now()`
      );
    }
    if (!newest || entry.when > newest.when) newest = { tag: entry.tag, when: entry.when };
  });

  for (const file of sqlFiles) {
    if (!seen.has(file.replace(/\.sql$/, ""))) problems.push(`${file} has no journal entry, so drizzle-kit migrate never runs it`);
  }
  return problems;
}

function main() {
  const folder = process.argv[2] ?? fileURLToPath(new URL("../drizzle/", import.meta.url));
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const problems = journalProblems(journal, readdirSync(folder).filter((f) => f.endsWith(".sql")));
  if (problems.length > 0) {
    console.error(`Migration journal check failed (AUDIT.md F-20): ${journalPath}`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(`Migration journal OK: ${journal.entries.length} entries, each dated after the ones before it.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
