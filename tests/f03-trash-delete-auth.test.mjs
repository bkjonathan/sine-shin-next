// Demonstration + guard for AUDIT.md finding F-03.
//
// F-03: the permanent-delete handlers under /api/trash/<type>/[id] (DELETE)
// check only that the caller is logged in — never their role. So any
// authenticated user, including `staff`, can irreversibly destroy trashed
// orders, customers, expenses and cargo shipments. Fix: restrict these to the
// `owner` role (403 otherwise), before any DB work.
//
// This is a live authorization gap, so we demonstrate it end-to-end: mint a
// valid session JWT and call each endpoint. Since F-06 the session's user must
// exist in the server's DB, so the role users are seeded first.
//   - A `staff` token must be forbidden (403).
//   - An `owner` token must NOT be forbidden (it may then 404 against the
//     throwaway DB, but it must not be blocked by the role gate).
//
// Requires a running server, its secret, and the throwaway DB it uses:
//   AUDIT_BASE_URL=http://localhost:<port> \
//   NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f03-trash-delete-auth.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const TRASH_TYPES = ["expenses", "orders", "customers", "cargo-shipments"];

async function del(type, cookie) {
  const res = await fetch(`${BASE}/api/trash/${type}/nonexistent-test-id`, {
    method: "DELETE",
    headers: { cookie },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  await res.text().catch(() => {});
  return res.status;
}

test(
  "F-03: permanent trash delete is owner-only",
  { skip: liveReady ? false : skipReason },
  async (t) => {
    const sql = auditDb();
    await seedRoleUsers(sql);
    await sql.end();

    const staff = await cookieFor("staff");
    const owner = await cookieFor("owner");

    for (const type of TRASH_TYPES) {
      await t.test(`staff is forbidden from deleting ${type}`, async () => {
        const status = await del(type, staff);
        assert.equal(
          status,
          403,
          `DELETE /api/trash/${type}: staff must be forbidden (403); got ${status}. ` +
            `A non-403 means a non-owner reached the permanent-delete operation.`
        );
      });
    }

    // Policy guard: the owner must NOT be blocked by the role gate.
    await t.test("owner is not blocked by the role gate (expenses)", async () => {
      const status = await del("expenses", owner);
      assert.notEqual(status, 403, `owner should not get 403 from the role gate; got ${status}`);
    });
  }
);
