// Demonstration + guard for AUDIT.md finding F-12.
//
// F-12: /api/reports refused staff, but the same kind of money summary reached
// every signed-in role elsewhere — revenue and profit (/api/dashboard), every
// order and expense with income and net balance (/api/account), the period's
// expense total (/api/dashboard/orders), cargo cost and revenue totals
// (/api/dashboard/cargo) and expense totals (/api/expenses). The sidebar showed
// Reports to the owner only, so API, UI and other endpoints had three policies.
//
// Decisions agreed with the owner (2026-09-12):
//   - shop-wide money summaries are for managers and the owner
//   - only summaries are restricted for now: staff keep the individual orders,
//     expenses and cargo records they work with (and so could still add them up)
//
// Fix under test: FINANCIAL_SUMMARY_ROLE and hasRole() in src/lib/roles.ts, used
// by the route handlers (the access control) and by the sidebar, dashboard,
// Reports, Account Book and Expenses pages (what gets rendered).
//
// The first test needs nothing. The live test needs a server started against a
// THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f12-financial-summaries.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { BASE, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const ROLES = ["staff", "manager", "owner"];

test("F-12: one role hierarchy and one threshold for money summaries", async () => {
  const { hasRole, FINANCIAL_SUMMARY_ROLE } = await import("../src/lib/roles.ts");

  assert.equal(FINANCIAL_SUMMARY_ROLE, "manager");
  assert.equal(hasRole("owner", "manager"), true);
  assert.equal(hasRole("manager", "manager"), true);
  assert.equal(hasRole("staff", "manager"), false);
  assert.equal(hasRole("manager", "owner"), false);
  assert.equal(hasRole("staff", "staff"), true);
  // Anything that isn't a known role has no rights.
  for (const role of [undefined, null, "", "admin", "OWNER", "toString", "__proto__"]) {
    assert.equal(hasRole(role, "staff"), false, `${JSON.stringify(role)} must not count as a role`);
  }
});

async function get(path, cookie) {
  const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, json, text: text.replaceAll("<!-- -->", "") };
}

test("F-12: money summaries are served to managers and the owner only", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await alignSchemaWithApp(sql);
  await seedRoleUsers(sql);
  await sql.end();
  const cookie = Object.fromEntries(await Promise.all(ROLES.map(async (r) => [r, await cookieFor(r)])));

  await t.test("summary-only endpoints refuse staff", async () => {
    for (const path of ["/api/reports", "/api/dashboard", "/api/account"]) {
      for (const role of ROLES) {
        const { status } = await get(path, cookie[role]);
        assert.equal(status, role === "staff" ? 403 : 200, `${path} as ${role}: got ${status}`);
      }
    }
  });

  await t.test("shared endpoints keep staff's records but drop the totals", async () => {
    for (const role of ROLES) {
      const sees = role !== "staff";

      const orders = await get("/api/dashboard/orders?dateFrom=2000-01-01&dateTo=2100-01-01", cookie[role]);
      assert.equal(orders.status, 200, `dashboard orders as ${role}`);
      assert.ok(Array.isArray(orders.json?.data), `dashboard orders as ${role}: order records`);
      assert.equal(typeof orders.json?.meta?.expensesTotal === "number", sees, `dashboard orders as ${role}: expense total`);

      const cargo = await get("/api/dashboard/cargo", cookie[role]);
      assert.equal(cargo.status, 200, `dashboard cargo as ${role}`);
      assert.equal(typeof cargo.json?.data?.stats?.total_shipments, "number", `dashboard cargo as ${role}: shipment counts`);
      assert.ok(Array.isArray(cargo.json?.data?.recent), `dashboard cargo as ${role}: recent shipments`);
      for (const total of ["carrier_owed", "receiver_owed"]) {
        assert.equal(typeof cargo.json?.data?.stats?.[total] === "number", sees, `dashboard cargo as ${role}: ${total}`);
      }

      const expenses = await get("/api/expenses", cookie[role]);
      assert.equal(expenses.status, 200, `expenses as ${role}`);
      assert.ok(Array.isArray(expenses.json?.data), `expenses as ${role}: expense records`);
      assert.equal(typeof expenses.json?.meta?.total, "number", `expenses as ${role}: pagination`);
      assert.equal(typeof expenses.json?.meta?.stats?.totalAmount === "number", sees, `expenses as ${role}: expense totals`);
    }
  });

  await t.test("pages render the same policy", async () => {
    for (const role of ROLES) {
      const sees = role !== "staff";

      const dashboard = await get("/dashboard", cookie[role]);
      assert.equal(dashboard.status, 200, `/dashboard as ${role}`);
      assert.equal(dashboard.text.includes('href="/reports"'), sees, `sidebar Reports link as ${role}`);
      assert.equal(dashboard.text.includes('href="/users"'), role === "owner", `sidebar Users link as ${role}`);
      assert.equal(dashboard.text.includes("Financial Overview"), sees, `dashboard money cards as ${role}`);
      assert.equal(dashboard.text.includes('href="/account"'), sees, `dashboard Account Book button as ${role}`);
      assert.equal(dashboard.text.includes("Cargo Profit"), sees, `dashboard cargo money cards as ${role}`);
      assert.ok(dashboard.text.includes("New Order"), `/dashboard as ${role}: quick actions stay`);

      for (const path of ["/reports", "/account"]) {
        const page = await get(path, cookie[role]);
        assert.equal(page.status, 200, `${path} as ${role}`);
        assert.equal(page.text.includes("Not available for your role"), !sees, `${path} as ${role}: access message`);
      }

      const expensesPage = await get("/expenses", cookie[role]);
      assert.equal(expensesPage.status, 200, `/expenses as ${role}`);
      assert.equal(expensesPage.text.includes("Total Expense"), sees, `/expenses summary cards as ${role}`);
      assert.ok(expensesPage.text.includes("Add Expense"), `/expenses as ${role}: staff still record expenses`);
    }
  });
});
