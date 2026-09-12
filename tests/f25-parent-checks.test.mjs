// Demonstration + guard for AUDIT.md finding F-25.
//
// F-25: order items, cargo items, cargo payments and cargo expenses were inserted
// against the parent id in the URL without checking it, so a payment could be
// recorded on a shipment in the trash, and a parent that doesn't exist surfaced
// as a foreign-key error and a 500. The same held for the order, order item,
// customer and category a cargo item (or a new shipment's items) points at, and
// for a receiver payment's customer.
//
// Fix under test: missingRecord() in src/lib/parents.ts looks each referenced
// record up inside the write's transaction, share-locking it so it can't be
// moved to the trash before the write commits; the route returns 404 naming the
// first record that is missing or in the trash, and nothing is saved.
//
// Needs a server started against a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f25-parent-checks.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, text: await res.text().catch(() => "") };
}

test("F-25: children of missing or trashed records are refused", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  // Remove this run's rows afterwards: F-13 skips one of its checks while money records exist.
  t.after(async () => {
    const shipments = sql`select id from cargo_shipments where id in (${id("s")}, ${id("sx")}) or notes like ${`f25 % ${run}`}`;
    for (const table of ["cargo_items", "cargo_payments", "cargo_expenses"]) {
      await sql`delete from ${sql(table)} where cargo_shipment_id in (${shipments})`;
    }
    await sql`delete from cargo_shipments where id in (${shipments})`;
    await sql`delete from order_items where order_id in (${id("o")}, ${id("ox")})`;
    await sql`delete from orders where id in (${id("o")}, ${id("ox")})`;
    await sql`delete from cargo_categories where id in (${id("k")}, ${id("kx")})`;
    await sql`delete from customers where id in (${id("c")}, ${id("cx")})`;
    await sql.end();
  });
  await seedRoleUsers(sql);
  const staff = await cookieFor("staff");
  const run = randomBytes(4).toString("hex");
  // ids are varchar(21): "f25" + tag (<= 2) + 8 hex, plus "x" for a missing one.
  const id = (tag) => `f25${tag}${run}`;
  const [settings] = await sql`select currency_code from shop_settings limit 1`;
  const base = settings?.currency_code ?? "THB";

  await sql`insert into customers (id, customer_id, name, deleted_at) values
    (${id("c")}, ${`F25C-${run}`}, 'F25 Customer', null), (${id("cx")}, ${`F25CX-${run}`}, 'F25 Trashed customer', now())`;
  await sql`insert into orders (id, order_id, customer_id, deleted_at) values
    (${id("o")}, ${`F25O-${run}`}, ${id("c")}, null), (${id("ox")}, ${`F25OX-${run}`}, ${id("c")}, now())`;
  await sql`insert into order_items (id, order_id, price, product_qty) values (${id("oi")}, ${id("o")}, 1, 1)`;
  await sql`insert into cargo_shipments (id, cargo_no, deleted_at) values
    (${id("s")}, ${`F25S-${run}`}, null), (${id("sx")}, ${`F25SX-${run}`}, now())`;
  await sql`insert into cargo_categories (id, name, carrier_rate_per_kg, receiver_rate_per_kg, deleted_at) values
    (${id("k")}, ${`F25 K ${run}`}, 1, 1, null), (${id("kx")}, ${`F25 KX ${run}`}, 1, 1, now())`;
  await sql`insert into cargo_items (id, cargo_shipment_id, customer_id, category_id, weight_kg, carrier_rate_per_kg, receiver_rate_per_kg, public_code) values
    (${id("i")}, ${id("s")}, ${id("c")}, ${id("k")}, 1, 1, 1, ${`F25I${run}`})`;

  const count = async (table, column, value) =>
    (await sql`select count(*)::int as n from ${sql(table)} where ${sql(column)} = ${value}`)[0].n;
  const item = { customerId: id("c"), categoryId: id("k"), weightKg: 1, carrierRatePerKg: 1, receiverRatePerKg: 1 };
  const payment = { partyType: "carrier", amount: 1, currency: base, paidAt: "2026-01-01" };
  const expense = { category: "handling", amount: 1, incurredAt: "2026-01-01" };

  await t.test("control: the same writes on live records succeed", async () => {
    for (const [name, path, body] of [
      ["order item", `/api/order-items/${id("o")}`, { productQty: 1, price: 1 }],
      ["cargo item", `/api/cargo-items/${id("s")}`, { ...item, orderId: id("o"), orderItemId: id("oi") }],
      ["receiver payment", `/api/cargo-payments/${id("s")}`, { partyType: "receiver", customerId: id("c"), amount: 1, currency: base, exchangeRate: 1, paidAt: "2026-01-01" }],
      ["cargo expense", `/api/cargo-expenses/${id("s")}`, expense],
      ["shipment with an item", "/api/cargo-shipments", { status: "pending", exchangeRate: 1, notes: `f25 ok ${run}`, items: [item] }],
    ]) {
      const r = await call("POST", path, staff, body);
      assert.equal(r.status, 201, `${name}: got ${r.status} ${r.text.slice(0, 160)}`);
    }
  });

  await t.test("a child of a trashed or missing parent gets 404 and nothing is saved", async () => {
    const orderItem = { productQty: 1, price: 1 };
    for (const [name, path, body, table, column, parent] of [
      ["order item on a trashed order", `/api/order-items/${id("ox")}`, orderItem, "order_items", "order_id", id("ox")],
      ["order item on a missing order", `/api/order-items/${id("o")}x`, orderItem, "order_items", "order_id", `${id("o")}x`],
      ["cargo item on a trashed shipment", `/api/cargo-items/${id("sx")}`, item, "cargo_items", "cargo_shipment_id", id("sx")],
      ["cargo item on a missing shipment", `/api/cargo-items/${id("s")}x`, item, "cargo_items", "cargo_shipment_id", `${id("s")}x`],
      ["payment on a trashed shipment", `/api/cargo-payments/${id("sx")}`, payment, "cargo_payments", "cargo_shipment_id", id("sx")],
      ["payment on a missing shipment", `/api/cargo-payments/${id("s")}x`, payment, "cargo_payments", "cargo_shipment_id", `${id("s")}x`],
      ["expense on a trashed shipment", `/api/cargo-expenses/${id("sx")}`, expense, "cargo_expenses", "cargo_shipment_id", id("sx")],
      ["expense on a missing shipment", `/api/cargo-expenses/${id("s")}x`, expense, "cargo_expenses", "cargo_shipment_id", `${id("s")}x`],
    ]) {
      const r = await call("POST", path, staff, body);
      assert.equal(r.status, 404, `${name}: got ${r.status} ${r.text.slice(0, 160)}`);
      assert.equal(await count(table, column, parent), 0, `${name}: a row was saved`);
    }
  });

  await t.test("a cargo item, receiver payment or new shipment can't point at a trashed or missing record", async () => {
    const itemsBefore = await count("cargo_items", "cargo_shipment_id", id("s"));
    for (const [what, body] of [
      ["a trashed customer", { ...item, customerId: id("cx") }],
      ["a missing customer", { ...item, customerId: `${id("c")}x` }],
      ["a trashed order", { ...item, customerId: null, orderId: id("ox") }],
      ["a missing order item", { ...item, orderId: id("o"), orderItemId: `${id("oi")}x` }],
      ["a trashed category", { ...item, categoryId: id("kx") }],
      ["a missing category", { ...item, categoryId: `${id("k")}x` }],
    ]) {
      const r = await call("POST", `/api/cargo-items/${id("s")}`, staff, body);
      assert.equal(r.status, 404, `cargo item with ${what}: got ${r.status} ${r.text.slice(0, 160)}`);
    }
    assert.equal(await count("cargo_items", "cargo_shipment_id", id("s")), itemsBefore, "a cargo item was saved");

    const receiver = await call("POST", `/api/cargo-payments/${id("s")}`, staff, { partyType: "receiver", customerId: id("cx"), amount: 1, currency: base, exchangeRate: 1, paidAt: "2026-01-01" });
    assert.equal(receiver.status, 404, `receiver payment for a trashed customer: got ${receiver.status} ${receiver.text.slice(0, 160)}`);
    assert.equal(await count("cargo_payments", "customer_id", id("cx")), 0);

    for (const [what, badItem] of [["a missing category", { ...item, categoryId: `${id("k")}x` }], ["a trashed customer", { ...item, customerId: id("cx") }]]) {
      const notes = `f25 ${what} ${run}`;
      const r = await call("POST", "/api/cargo-shipments", staff, { status: "pending", exchangeRate: 1, notes, items: [badItem] });
      assert.equal(r.status, 404, `new shipment whose item has ${what}: got ${r.status} ${r.text.slice(0, 160)}`);
      assert.equal(await count("cargo_shipments", "notes", notes), 0, "the shipment was saved");
    }
  });

  await t.test("editing a cargo item onto a trashed category gets 404 and changes nothing", async () => {
    const r = await call("PATCH", `/api/cargo-items/${id("s")}`, staff, { itemId: id("i"), categoryId: id("kx"), weightKg: 2, carrierRatePerKg: 1, receiverRatePerKg: 1 });
    assert.equal(r.status, 404, `got ${r.status} ${r.text.slice(0, 160)}`);
    const [row] = await sql`select category_id, weight_kg from cargo_items where id = ${id("i")}`;
    assert.deepEqual({ category: row.category_id, weight: row.weight_kg }, { category: id("k"), weight: 1 });
  });
});
