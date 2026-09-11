// Demonstration + guard for AUDIT.md finding F-04.
//
// F-04: nearly every write endpoint checks only that the caller is logged in,
// never their role, so `staff` can do owner/manager-level actions. Approved
// matrix (roles are hierarchical owner > manager > staff):
//   - create / edit / bulk-status / record-payment  -> staff+
//   - any soft-delete, trash restore, payment/expense reversal -> manager+
//   - shop settings, cargo-category rates, permanent delete -> owner
//
// The gate goes right after the session check, before body parsing / DB, so an
// under-privileged role gets 403 regardless of body. An allowed role proceeds
// and then hits validation/DB (400/404 against the throwaway DB) — anything
// but 403. Since F-06 the session's user must exist, so role users are seeded.
//
// Requires the server, its secret, and the throwaway DB it uses:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f04-write-authz.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const RANK = { staff: 1, manager: 2, owner: 3 };
const ID = "nonexistent-test-id";

// method, path, minimum role required
const ENDPOINTS = [
  // staff+ : create / edit / bulk / record payment
  ["POST", "/api/orders", "staff"],
  ["PATCH", `/api/orders/${ID}`, "staff"],
  ["PATCH", "/api/orders/bulk", "staff"],
  ["POST", `/api/order-items/${ID}`, "staff"],
  ["PATCH", `/api/order-items/${ID}`, "staff"],
  ["POST", "/api/customers", "staff"],
  ["PATCH", `/api/customers/${ID}`, "staff"],
  ["POST", "/api/expenses", "staff"],
  ["PATCH", `/api/expenses/${ID}`, "staff"],
  ["POST", "/api/cargo-shipments", "staff"],
  ["PATCH", `/api/cargo-shipments/${ID}`, "staff"],
  ["POST", `/api/cargo-items/${ID}`, "staff"],
  ["PATCH", `/api/cargo-items/${ID}`, "staff"],
  ["POST", `/api/cargo-payments/${ID}`, "staff"],
  ["POST", `/api/cargo-expenses/${ID}`, "staff"],
  // manager+ : soft-delete, restore, payment/expense reversal
  ["DELETE", `/api/orders/${ID}`, "manager"],
  ["DELETE", `/api/order-items/${ID}`, "manager"],
  ["DELETE", `/api/customers/${ID}`, "manager"],
  ["DELETE", `/api/expenses/${ID}`, "manager"],
  ["DELETE", `/api/cargo-shipments/${ID}`, "manager"],
  ["DELETE", `/api/cargo-items/${ID}`, "manager"],
  ["DELETE", `/api/cargo-payments/${ID}`, "manager"],
  ["DELETE", `/api/cargo-expenses/${ID}`, "manager"],
  ["PATCH", `/api/trash/orders/${ID}`, "manager"],
  ["PATCH", `/api/trash/customers/${ID}`, "manager"],
  ["PATCH", `/api/trash/expenses/${ID}`, "manager"],
  ["PATCH", `/api/trash/cargo-shipments/${ID}`, "manager"],
  // owner : settings, category rates, permanent delete
  ["POST", "/api/cargo-categories", "owner"],
  ["PATCH", `/api/cargo-categories/${ID}`, "owner"],
  ["DELETE", `/api/cargo-categories/${ID}`, "owner"],
  ["PATCH", "/api/settings", "owner"],
  ["DELETE", `/api/trash/orders/${ID}`, "owner"],
  ["DELETE", `/api/trash/customers/${ID}`, "owner"],
  ["DELETE", `/api/trash/expenses/${ID}`, "owner"],
  ["DELETE", `/api/trash/cargo-shipments/${ID}`, "owner"],
];

test(
  "F-04: write endpoints enforce the role matrix",
  { skip: liveReady ? false : skipReason },
  async (t) => {
    const sql = auditDb();
    await seedRoleUsers(sql);
    await sql.end();

    const cookies = {
      staff: await cookieFor("staff"),
      manager: await cookieFor("manager"),
      owner: await cookieFor("owner"),
    };

    for (const [method, path, min] of ENDPOINTS) {
      await t.test(`${method} ${path} (min ${min})`, async () => {
        for (const role of ["staff", "manager", "owner"]) {
          const res = await fetch(BASE + path, {
            method,
            headers: { cookie: cookies[role], "content-type": "application/json" },
            body: "{}",
            redirect: "manual",
            signal: AbortSignal.timeout(20_000),
          });
          await res.text().catch(() => {});
          const allowed = RANK[role] >= RANK[min];
          if (allowed) {
            assert.notEqual(res.status, 403, `${method} ${path}: ${role} (>= ${min}) should NOT be forbidden, got 403`);
          } else {
            assert.equal(res.status, 403, `${method} ${path}: ${role} (< ${min}) must be forbidden (403), got ${res.status}`);
          }
        }
      });
    }
  }
);
