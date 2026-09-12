// Demonstration + guard for AUDIT.md finding F-19.
//
// F-19: ID prefixes accept any characters. Display numbers are parsed back with
// cast(split_part(order_id, '-', 2) as integer), so a prefix containing "-"
// (e.g. "SS-A") makes the next create store "SS-A-00001" and every create after
// that fail with a 500 for everyone. "%" and "_" are LIKE wildcards too.
//
// Fix under test: prefixes must be A-Z / 0-9 only (1-20 characters, the column
// size) after the existing normalisation (uppercase, trailing dashes removed).
// Owner-only access to settings was already added under F-04.
//
// Needs a server started against a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f19-id-prefix.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const VALID = { shopName: "Audit Shop", customerIdPrefix: "CUST", orderIdPrefix: "ORD", cargoIdPrefix: "CG" };

async function patchSettings(cookie, body) {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data };
}

test("F-19: ID prefixes are restricted to letters and digits", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await seedRoleUsers(sql);
  await sql.end();
  const owner = await cookieFor("owner");

  for (const field of ["customerIdPrefix", "orderIdPrefix", "cargoIdPrefix"]) {
    await t.test(`${field}: prefixes that break numbering or LIKE are refused`, async () => {
      for (const bad of ["SS-A", "A%B", "A_B", "A B", "A.B", "ÄB", "A".repeat(21), "---"]) {
        const r = await patchSettings(owner, { ...VALID, [field]: bad });
        assert.equal(r.status, 400, `${field}=${JSON.stringify(bad)} must be refused, got ${r.status}`);
      }
    });
  }

  await t.test("valid prefixes are accepted and normalised as before", async () => {
    const r = await patchSettings(owner, { ...VALID, customerIdPrefix: "cust-", orderIdPrefix: "ORD2026", cargoIdPrefix: "cg" });
    assert.equal(r.status, 200, `valid prefixes refused: ${r.status}`);
    assert.equal(r.data?.customerIdPrefix, "CUST", "lowercase + trailing dash still normalised");
    assert.equal(r.data?.orderIdPrefix, "ORD2026");
    assert.equal(r.data?.cargoIdPrefix, "CG");
  });
});
