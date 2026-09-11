// Demonstration + guard for AUDIT.md finding F-08.
//
// F-08: the seed script creates an owner account `admin` with a hard-coded
// password, prints it, and a tracked setup doc repeats it — so any database
// seeded from this repo has a publicly known owner login.
//
// Fix under test: the seed takes the owner password from SEED_OWNER_PASSWORD
// (rejecting anything under 8 characters) or generates a random one and
// prints it once; no tracked file carries the old default.
//
// The first test needs only git. The live test runs the real seed script
// against a THROWAWAY database and signs in through a server using it:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f08-seed-owner-password.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DB_URL, liveReady, skipReason, auditDb, signIn } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_DEFAULT = ["admin", "123"].join(""); // built here so this file doesn't match its own search

test("F-08: no tracked file carries the old default owner password", () => {
  const r = spawnSync("git", ["grep", "-n", "-i", "-F", OLD_DEFAULT, "--", ".", ":!AUDIT.md"], { cwd: root, encoding: "utf8" });
  // git grep exits 1 when nothing matches.
  assert.equal(r.status, 1, `default password still present:\n${r.stdout}${r.stderr}`);
});

function runSeed(ownerPassword) {
  const env = { ...process.env, DATABASE_URL: DB_URL };
  delete env.SEED_OWNER_PASSWORD;
  if (ownerPassword !== undefined) env.SEED_OWNER_PASSWORD = ownerPassword;
  const r = spawnSync("npx", ["tsx", "src/db/seed.ts"], { cwd: root, env, encoding: "utf8", timeout: 60_000 });
  return { status: r.status, output: `${r.stdout}${r.stderr}` };
}

test("F-08: the seed never creates a known owner password", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb(); // also refuses anything but a local audit* database before the seed touches it
  t.after(() => sql.end());
  const [a, b] = randomBytes(2);
  let n = 0;
  const ip = () => `10.${a}.${b}.${++n}`;
  const dropAdmin = () => sql`delete from users where name = ${"admin"}`;

  await t.test("without SEED_OWNER_PASSWORD it generates one, prints it once, and it works", async () => {
    await dropAdmin();
    const r = runSeed(undefined);
    assert.equal(r.status, 0, `seed failed:\n${r.output}`);
    const generated = r.output.match(/Generated password[^:]*:\s*(\S+)/)?.[1];
    assert.ok(generated, `no generated password in output:\n${r.output}`);
    assert.ok(generated.length >= 16 && generated !== OLD_DEFAULT, `weak generated password: ${generated}`);
    assert.ok((await signIn("admin", generated, { ip: ip() })).cookie, "generated password must sign in");
    assert.equal((await signIn("admin", OLD_DEFAULT, { ip: ip() })).cookie, null, "the old default must not sign in");
  });

  await t.test("a SEED_OWNER_PASSWORD under 8 characters is refused", async () => {
    await dropAdmin();
    const r = runSeed("short");
    assert.notEqual(r.status, 0, `seed accepted a 5-character password:\n${r.output}`);
    assert.match(r.output, /SEED_OWNER_PASSWORD must be at least 8 characters/, `refused for the wrong reason:\n${r.output}`);
    const [row] = await sql`select count(*)::int as n from users where name = ${"admin"}`;
    assert.equal(row.n, 0, "no owner account may be created with a refused password");
  });

  await t.test("a provided SEED_OWNER_PASSWORD is used and not echoed", async () => {
    await dropAdmin();
    const chosen = `chosen-${randomBytes(6).toString("hex")}`;
    const r = runSeed(chosen);
    assert.equal(r.status, 0, `seed failed:\n${r.output}`);
    assert.ok(!r.output.includes(chosen), "the provided password must not be printed");
    assert.ok((await signIn("admin", chosen, { ip: ip() })).cookie, "provided password must sign in");
  });
});
