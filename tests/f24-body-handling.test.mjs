// Demonstration + guard for AUDIT.md finding F-24.
//
// F-24: the DELETE handlers for order items, cargo items, cargo payments and cargo
// expenses read the body outside any try/catch and didn't check the id's type.
// They didn't skip rows already in the trash, and reported success when nothing
// matched. The cargo-item bag move and bag rename also changed trashed items.
//
// Fix under test: those handlers parse the body with a zod schema inside
// try/catch (400 for a body that isn't a JSON object or an id that isn't a
// string), change only rows that aren't in the trash, and return 404 when no row
// changed.
//
// Needs a server started against a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f24-body-handling.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

async function send(method, path, cookie, text) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: text,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, text: await res.text().catch(() => "") };
}
const call = (method, path, cookie, body) => send(method, path, cookie, JSON.stringify(body));

test("F-24: child DELETE and bag-edit handlers validate their body and skip trashed rows", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  // Remove this run's rows afterwards: F-13 skips one of its checks while money records exist.
  t.after(async () => {
    for (const table of ["cargo_items", "cargo_payments", "cargo_expenses"]) {
      await sql`delete from ${sql(table)} where cargo_shipment_id = ${id("s")}`;
    }
    await sql`delete from cargo_shipments where id = ${id("s")}`;
    await sql`delete from order_items where order_id = ${id("o")}`;
    await sql`delete from orders where id = ${id("o")}`;
    await sql`delete from customers where id = ${id("c")}`;
    await sql.end();
  });
  await seedRoleUsers(sql);
  const cookie = { staff: await cookieFor("staff"), manager: await cookieFor("manager") };
  const run = randomBytes(4).toString("hex");
  // ids are varchar(21): "f24" + tag (<= 3) + 8 hex.
  const id = (tag) => `f24${tag}${run}`;
  const bag = `bag-${run}`;
  const trashedOnlyBag = `gone-${run}`;

  await sql`insert into customers (id, customer_id, name) values (${id("c")}, ${`F24C-${run}`}, 'F24 Customer')`;
  await sql`insert into orders (id, order_id, customer_id) values (${id("o")}, ${`F24O-${run}`}, ${id("c")})`;
  await sql`insert into order_items (id, order_id, price, product_qty, deleted_at) values
    (${id("oi")}, ${id("o")}, 1, 1, null), (${id("oix")}, ${id("o")}, 1, 1, now())`;
  await sql`insert into cargo_shipments (id, cargo_no) values (${id("s")}, ${`F24S-${run}`})`;
  await sql`insert into cargo_items (id, cargo_shipment_id, customer_id, weight_kg, carrier_rate_per_kg, receiver_rate_per_kg, public_code, bag_label, deleted_at) values
    (${id("i")}, ${id("s")}, ${id("c")}, 1, 1, 1, ${`F24I${run}`}, ${bag}, null),
    (${id("ix")}, ${id("s")}, ${id("c")}, 1, 1, 1, ${`F24X${run}`}, ${bag}, now()),
    (${id("iy")}, ${id("s")}, ${id("c")}, 1, 1, 1, ${`F24Y${run}`}, ${trashedOnlyBag}, now()),
    (${id("id")}, ${id("s")}, ${id("c")}, 1, 1, 1, ${`F24D${run}`}, null, null)`;
  await sql`insert into cargo_payments (id, cargo_shipment_id, party_type, amount, currency, paid_at, deleted_at) values
    (${id("p")}, ${id("s")}, 'carrier', 1, 'THB', '2026-01-01', null), (${id("px")}, ${id("s")}, 'carrier', 1, 'THB', '2026-01-01', now())`;
  await sql`insert into cargo_expenses (id, cargo_shipment_id, amount, incurred_at, deleted_at) values
    (${id("e")}, ${id("s")}, 1, '2026-01-01', null), (${id("ex")}, ${id("s")}, 1, '2026-01-01', now())`;

  // name, path, id key, a live row, a trashed row, table
  const deletes = [
    ["order item", `/api/order-items/${id("o")}`, "itemId", id("oi"), id("oix"), "order_items"],
    ["cargo item", `/api/cargo-items/${id("s")}`, "itemId", id("id"), id("ix"), "cargo_items"],
    ["cargo payment", `/api/cargo-payments/${id("s")}`, "paymentId", id("p"), id("px"), "cargo_payments"],
    ["cargo expense", `/api/cargo-expenses/${id("s")}`, "expenseId", id("e"), id("ex"), "cargo_expenses"],
  ];
  const bagOf = async (itemId) => (await sql`select bag_label from cargo_items where id = ${itemId}`)[0].bag_label;
  const deletedAt = async (table, rowId) => (await sql`select deleted_at from ${sql(table)} where id = ${rowId}`)[0].deleted_at;

  await t.test("a body that isn't a JSON object gets 400, not an unhandled error", async () => {
    for (const [name, path] of deletes) {
      for (const text of ["{not json", "null"]) {
        const r = await send("DELETE", path, cookie.manager, text);
        assert.equal(r.status, 400, `${name} DELETE with body ${text}: got ${r.status}`);
      }
    }
    const r = await send("PATCH", `/api/cargo-items/${id("s")}`, cookie.staff, "null");
    assert.equal(r.status, 400, `cargo item PATCH with body null: got ${r.status}`);
  });

  await t.test("an id that isn't a string gets 400", async () => {
    for (const [name, path, key] of deletes) {
      const r = await call("DELETE", path, cookie.manager, { [key]: 123 });
      assert.equal(r.status, 400, `${name} DELETE with a numeric id: got ${r.status} ${r.text.slice(0, 120)}`);
    }
  });

  await t.test("bag edits leave trashed items alone", async () => {
    const path = `/api/cargo-items/${id("s")}`;
    const move = await call("PATCH", path, cookie.staff, { itemId: id("ix"), bagLabel: `moved-${run}` });
    assert.equal(move.status, 404, `moving a trashed item: got ${move.status}`);
    assert.equal(await bagOf(id("ix")), bag, "a trashed item was moved to another bag");

    const renameTrashedOnly = await call("PATCH", path, cookie.staff, { fromBagLabel: trashedOnlyBag, toBagLabel: `renamed-${run}` });
    assert.equal(renameTrashedOnly.status, 404, `renaming a bag only trashed items carry: got ${renameTrashedOnly.status}`);
    assert.equal(await bagOf(id("iy")), trashedOnlyBag);

    const rename = await call("PATCH", path, cookie.staff, { fromBagLabel: bag, toBagLabel: `renamed-${run}` });
    assert.equal(rename.status, 200, `renaming a bag with a live item: got ${rename.status} ${rename.text.slice(0, 120)}`);
    assert.equal(await bagOf(id("i")), `renamed-${run}`);
    assert.equal(await bagOf(id("ix")), bag, "a trashed item was renamed along with the bag");
  });

  await t.test("deleting a missing or trashed row gets 404 and changes nothing; a live row is deleted", async () => {
    for (const [name, path, key, liveId, trashedId, table] of deletes) {
      const before = await deletedAt(table, trashedId);
      const again = await call("DELETE", path, cookie.manager, { [key]: trashedId });
      assert.equal(again.status, 404, `${name}: deleting a trashed row: got ${again.status}`);
      assert.equal((await deletedAt(table, trashedId)).getTime(), before.getTime(), `${name}: the trashed row was changed`);

      const missing = await call("DELETE", path, cookie.manager, { [key]: `${trashedId}x` });
      assert.equal(missing.status, 404, `${name}: deleting a row that doesn't exist: got ${missing.status}`);

      const live = await call("DELETE", path, cookie.manager, { [key]: liveId });
      assert.equal(live.status, 200, `${name}: deleting a live row: got ${live.status} ${live.text.slice(0, 120)}`);
      assert.ok(await deletedAt(table, liveId), `${name}: the live row wasn't moved to the trash`);
    }
  });
});
