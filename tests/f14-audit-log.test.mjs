// Demonstration + guard for AUDIT.md finding F-14.
//
// F-14: nothing recorded who created, changed, restored or deleted an order, fee
// flag, payment, expense, user or setting, or the values before and after. A hard
// delete from Trash erased a record without trace, and a single-order edit didn't
// even set updated_at.
//
// Decisions agreed with the owner (2026-09-12):
//   - record every change to shop data, permanently (never password hashes)
//   - an owner-only Settings → Activity page shows it
//
// Fix under test: drizzle/0011_audit_log.sql adds an append-only audit_log that a
// trigger on every business table writes, inside the same transaction as the
// change. withAudit() in src/lib/audit.ts tells the trigger who is acting and
// from where; /api/audit-log and Settings → Activity show the log to the owner.
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database with migrations 0000–0011 applied, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f14-audit-log.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { BASE, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, upsertUser, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(join(root, file), "utf8");

test("F-14: activity entries are described from their before/after rows", async () => {
  const { auditActionLabel, auditChanges, auditRecordLabel } = await import("../src/lib/audit-format.ts");

  assert.equal(auditActionLabel("insert", null, { id: "a" }), "Created");
  assert.equal(auditActionLabel("update", { phone: "1" }, { phone: "2" }), "Changed");
  assert.equal(auditActionLabel("update", { deleted_at: null }, { deleted_at: "2026-09-12T00:00:00Z" }), "Moved to trash");
  assert.equal(auditActionLabel("update", { deleted_at: "2026-09-12T00:00:00Z" }, { deleted_at: null }), "Restored");
  assert.equal(auditActionLabel("delete", { id: "a" }, null), "Deleted permanently");

  // Only fields whose value changed; bookkeeping timestamps are left out.
  assert.deepEqual(
    auditChanges(
      { id: "a", phone: "1", note: null, updated_at: "x", deleted_at: null },
      { id: "a", phone: "2", note: "hi", updated_at: "y", deleted_at: null }
    ),
    [{ field: "phone", from: "1", to: "2" }, { field: "note", from: null, to: "hi" }]
  );
  // A password change shows as a flag, never a hash.
  assert.deepEqual(
    auditChanges({ id: "u", session_version: 0 }, { id: "u", session_version: 1, password_changed: true }),
    [{ field: "session_version", from: 0, to: 1 }, { field: "password_changed", from: null, to: true }]
  );

  assert.equal(auditRecordLabel("orders", null, { order_id: "ORD-00001", customer_id: "c1" }), "ORD-00001");
  assert.equal(auditRecordLabel("cargo_shipments", { cargo_no: "CG-00002" }, null), "CG-00002");
  assert.equal(auditRecordLabel("customers", null, { name: "Aung" }), "Aung");
});

test("F-14: every route handler write goes through withAudit", () => {
  const offenders = [];
  let writers = 0;
  for (const rel of readdirSync(join(root, "src/app/api"), { recursive: true })) {
    if (!String(rel).endsWith("route.ts")) continue;
    const file = `src/app/api/${rel}`;
    const text = source(file);
    if (/\bdb\s*\.\s*(insert|update|delete)\s*\(/.test(text)) offenders.push(`${file}: writes with db instead of withAudit's tx`);
    if (/\btx\s*\.\s*(insert|update|delete)\s*\(/.test(text)) {
      writers += 1;
      // createOnce (F-13) runs its work inside withAudit.
      if (!/\b(withAudit|createOnce)\(/.test(text)) offenders.push(`${file}: tx without withAudit`);
    }
  }
  assert.deepEqual(offenders, [], "writes that audit_log can't attribute to a user");
  assert.equal(writers, 22, "all 22 route files that write should use withAudit");

  // Journaled after 0010; drizzle skips an entry with an older `when` (F-20).
  const entries = JSON.parse(source("drizzle/meta/_journal.json")).entries;
  const e11 = entries.find((e) => e.tag === "0011_audit_log");
  assert.ok(e11, "drizzle/meta/_journal.json has no 0011_audit_log entry");
  assert.ok(e11.when > entries.find((e) => e.tag === "0010_shop_currency").when, "0011 must be newer than 0010");
});

const IP = "203.0.113.7";
const TABLES = [
  "cargo_categories", "cargo_expenses", "cargo_items", "cargo_payments", "cargo_shipments",
  "customers", "expenses", "order_items", "orders", "shop_settings", "users",
];

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json", "x-forwarded-for": IP },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, data: json?.data, json, text };
}

test("F-14: every change is recorded, attributed and append-only", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await alignSchemaWithApp(sql);
  await seedRoleUsers(sql);
  await upsertUser(sql, { id: "u_f14", role: "staff" });
  const cookie = { staff: await cookieFor("staff"), manager: await cookieFor("manager"), owner: await cookieFor("owner") };
  const logFor = (entity, id) => sql`select * from audit_log where entity = ${entity} and entity_id = ${id} order by id`;
  let customerId;
  let orderId;

  try {
    await t.test("audit_log exists with a recording trigger on every business table", async () => {
      const rows = await sql`
        select event_object_table as t from information_schema.triggers
        where trigger_name = 'audit_log_record' group by 1 order by 1`;
      assert.deepEqual(rows.map((r) => r.t), TABLES);
    });

    await t.test("a create is recorded with the user, role, client address and new row", async () => {
      const r = await call("POST", "/api/customers", cookie.staff, { name: "F14 Customer", phone: "0800000001" });
      assert.equal(r.status, 201, `create customer: ${r.status} ${r.text.slice(0, 200)}`);
      customerId = r.data.id;
      const [row, extra] = await logFor("customers", customerId);
      assert.ok(row, "no audit row for the new customer");
      assert.equal(extra, undefined, "one create, one row");
      assert.deepEqual(
        { action: row.action, user: row.user_id, role: row.user_role, ip: row.client_ip, before: row.before, name: row.after?.name },
        { action: "insert", user: "u_staff", role: "staff", ip: IP, before: null, name: "F14 Customer" }
      );
    });

    await t.test("an edit keeps the values before and after", async () => {
      const r = await call("PATCH", `/api/customers/${customerId}`, cookie.staff, { phone: "0800000002" });
      assert.equal(r.status, 200);
      const row = (await logFor("customers", customerId)).at(-1);
      assert.equal(row.action, "update");
      assert.equal(row.before.phone, "0800000001");
      assert.equal(row.after.phone, "0800000002");
    });

    await t.test("trash, restore and permanent delete are all recorded; the deleted row survives in the log", async () => {
      assert.equal((await call("DELETE", `/api/customers/${customerId}`, cookie.manager)).status, 200);
      assert.equal((await call("PATCH", `/api/trash/customers/${customerId}`, cookie.manager)).status, 200);
      assert.equal((await call("DELETE", `/api/customers/${customerId}`, cookie.manager)).status, 200);
      assert.equal((await call("DELETE", `/api/trash/customers/${customerId}`, cookie.owner)).status, 200);

      const rows = await logFor("customers", customerId);
      assert.deepEqual(rows.map((r) => [r.action, r.user_id]), [
        ["insert", "u_staff"], ["update", "u_staff"],
        ["update", "u_manager"], ["update", "u_manager"], ["update", "u_manager"],
        ["delete", "u_owner"],
      ]);
      const last = rows.at(-1);
      assert.equal(last.after, null);
      assert.equal(last.before.name, "F14 Customer", "the permanently deleted customer is still readable in the log");
    });

    await t.test("a multi-row write is attributed throughout, and an order edit sets updated_at", async () => {
      const [owner] = await sql`select id from customers limit 1`;
      const custId = owner?.id ?? (await call("POST", "/api/customers", cookie.staff, { name: "F14 Order Customer" })).data.id;
      const r = await call("POST", "/api/orders", cookie.staff, {
        customerId: custId, status: "pending", exchangeRate: 1, shippingFee: 0, deliveryFee: 0, cargoFee: 0,
        serviceFee: 0, serviceFeeType: "fixed", items: [{ productUrl: "https://example.com/f14", productQty: 1, price: 100 }],
      });
      assert.equal(r.status, 201, `create order: ${r.status} ${r.text.slice(0, 200)}`);
      orderId = r.data.id;
      const [orderRow] = await logFor("orders", orderId);
      const itemRows = await sql`select * from audit_log where entity = 'order_items' and after->>'order_id' = ${orderId}`;
      assert.equal(orderRow?.user_id, "u_staff");
      assert.equal(itemRows.length, 1, "the order's item is recorded too");
      assert.equal(itemRows[0].user_id, "u_staff");

      assert.equal((await call("PATCH", `/api/orders/${orderId}`, cookie.staff, { note: "F14 edit" })).status, 200);
      const edit = (await logFor("orders", orderId)).at(-1);
      assert.equal(edit.after.note, "F14 edit");
      assert.equal(edit.before.updated_at, null);
      assert.ok(edit.after.updated_at, "a single-order edit sets updated_at");
    });

    await t.test("password changes are recorded without any password hash", async () => {
      // A reset needs the acting owner's own password (F-18).
      const ownerPassword = "f14-owner-password-1";
      await upsertUser(sql, { id: "u_owner", role: "owner", passwordHash: await bcrypt.hash(ownerPassword, 4) });
      const r = await call("PATCH", "/api/users/u_f14", cookie.owner, { password: "f14-new-password-1", currentPassword: ownerPassword });
      assert.equal(r.status, 200, `reset password: ${r.status} ${r.text.slice(0, 200)}`);
      const row = (await logFor("users", "u_f14")).at(-1);
      assert.equal(row.user_id, "u_owner");
      assert.equal(row.after.password_changed, true);
      const [{ leaked }] = await sql`
        select count(*)::int as leaked from audit_log
        where before ? 'password_hash' or after ? 'password_hash'
           or before ? 'master_password_hash' or after ? 'master_password_hash'`;
      assert.equal(leaked, 0, "no password hash may be stored in the log");
    });

    await t.test("a write that fails leaves no log row", async () => {
      const [{ n: before }] = await sql`select count(*)::int as n from audit_log where entity = 'order_items'`;
      const r = await call("POST", "/api/order-items/f14_no_such_order", cookie.staff, { productQty: 1, price: 1 });
      assert.equal(r.status, 500, "insert against a missing order fails on its foreign key");
      const [{ n: after }] = await sql`select count(*)::int as n from audit_log where entity = 'order_items'`;
      assert.equal(after, before);
    });

    await t.test("a change made outside the app is still recorded, without an app user", async () => {
      // A fresh id each run: log rows from earlier runs can't be removed.
      const id = `f14_sql_${Date.now()}`;
      await sql`insert into customers (id, customer_id, name) values (${id}, ${`F14SQL-${Date.now()}`}, 'F14 SQL')`;
      await sql`delete from customers where id = ${id}`;
      const rows = await logFor("customers", id);
      assert.deepEqual(rows.map((r) => [r.action, r.user_id, r.db_user]), [["insert", null, "audit"], ["delete", null, "audit"]]);
    });

    await t.test("log rows can't be changed, deleted or truncated", async () => {
      for (const stmt of ["update audit_log set action = 'x'", "delete from audit_log", "truncate audit_log"]) {
        await assert.rejects(() => sql.unsafe(stmt), /append-only/, `${stmt} must be refused`);
      }
    });

    await t.test("only the owner reads the log", async () => {
      const r = await call("GET", `/api/audit-log?entity=customers&entityId=${customerId}`, cookie.owner);
      assert.equal(r.status, 200);
      assert.deepEqual(r.data?.map((e) => [e.action, e.username]), [
        ["delete", "u_owner"], ["update", "u_manager"], ["update", "u_manager"], ["update", "u_manager"],
        ["update", "u_staff"], ["insert", "u_staff"],
      ], "newest first, with the acting user's name");
      for (const role of ["manager", "staff"]) {
        assert.equal((await call("GET", "/api/audit-log", cookie[role])).status, 403, `${role} must not read the log`);
      }

      const ownerSettings = await call("GET", "/settings", cookie.owner);
      const managerSettings = await call("GET", "/settings", cookie.manager);
      assert.match(ownerSettings.text, />Activity</, "owner sees Settings → Activity");
      assert.doesNotMatch(managerSettings.text, />Activity</, "manager doesn't");
    });
  } finally {
    if (orderId) {
      await sql`delete from order_items where order_id = ${orderId}`;
      await sql`delete from orders where id = ${orderId}`;
    }
    await sql`delete from customers where name = 'F14 Order Customer'`;
    await sql`delete from users where id = 'u_f14'`;
    await sql.end();
  }
});
