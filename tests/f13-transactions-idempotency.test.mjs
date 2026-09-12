// Demonstration + guard for AUDIT.md finding F-13.
//
// F-13: creates weren't safe to run at the same time or to run twice.
//   - Display numbers (ORD-00042, CUST-…, EXP-…, CG-…) were "highest existing + 1",
//     read before the insert's transaction, so two creates at the same moment got
//     the same number: a 500 from the unique constraint or, for expenses (no
//     constraint), two records with one number. One stored ID whose number part
//     isn't digits made every later create of that kind fail.
//   - The shop-settings save checked the currency lock, then inserted or updated,
//     in separate steps: a money record being saved meanwhile went unnoticed, and
//     two first-time saves raced on the insert.
//   - Nothing stopped a retry saving a second copy: after the browser's 15-second
//     timeout, clicking Save again created another order or payment.
//
// Decisions agreed with the owner (2026-09-12):
//   - numbers stay "highest existing + 1": a permanently deleted top number may be
//     given out again, as before
//   - retry protection for every create that records money or a numbered record:
//     orders, order items, cargo shipments, cargo items, cargo payments, cargo
//     expenses, expenses and customers
//
// Fix under test: createOnce() (src/lib/idempotency.ts) runs a create in one
// transaction. When the request carries an Idempotency-Key it stores the key and
// the reply in that same transaction (drizzle/0012_idempotency_keys.sql): a retry
// gets the stored reply, and the same key with different values gets 422. The
// browser hooks send one key per submission (src/hooks/use-idempotency-key.ts).
// nextDisplayNumber() (src/lib/display-number.ts) numbers inside the transaction
// under a per-table lock and skips IDs whose number part isn't digits. PATCH
// /api/settings checks the currency lock and saves in one transaction.
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database with migrations 0000–0012 applied, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f13-transactions-idempotency.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AxiosError } from "axios";
import { BASE, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(join(root, file), "utf8");

test("F-13: the browser keeps a submission's key only while the outcome is unknown", async () => {
  const { outcomeUnknown } = await import("../src/hooks/use-idempotency-key.ts");
  const replied = (status) => new AxiosError("reply", "ERR_BAD_RESPONSE", undefined, undefined, { status });

  // No reply at all: the server may have saved it, so a retry must reuse the key.
  assert.equal(outcomeUnknown(new AxiosError("timeout of 15000ms exceeded", "ECONNABORTED")), true);
  assert.equal(outcomeUnknown(new AxiosError("Network Error", "ERR_NETWORK")), true);
  // The proxy gave up waiting; the app may still have saved it.
  for (const status of [502, 503, 504]) assert.equal(outcomeUnknown(replied(status)), true, `${status}`);
  // The app answered, so this submission is settled either way.
  for (const status of [400, 403, 409, 422, 500]) assert.equal(outcomeUnknown(replied(status)), false, `${status}`);
  assert.equal(outcomeUnknown(undefined), false, "success");
  assert.equal(outcomeUnknown(new Error("not a request error")), false);
});

test("F-13: every money-or-numbered create is retry-safe and numbered inside its transaction", () => {
  const routes = [
    "src/app/api/orders/route.ts",
    "src/app/api/order-items/[orderId]/route.ts",
    "src/app/api/cargo-shipments/route.ts",
    "src/app/api/cargo-items/[cargoShipmentId]/route.ts",
    "src/app/api/cargo-payments/[cargoShipmentId]/route.ts",
    "src/app/api/cargo-expenses/[cargoShipmentId]/route.ts",
    "src/app/api/expenses/route.ts",
    "src/app/api/customers/route.ts",
  ];
  const handler = (text, start) => text.split(start)[1]?.split(/\nexport (?:async )?function /)[0] ?? "";
  for (const file of routes) {
    assert.match(handler(source(file), "export async function POST"), /createOnce\(/, `${file}: POST must go through createOnce`);
  }

  const hooks = {
    "src/hooks/use-orders.ts": ["useCreateOrder", "useAddOrderItem"],
    "src/hooks/use-cargo.ts": ["useCreateCargoShipment", "useAddCargoItem", "useAddCargoPayment", "useAddCargoExpense"],
    "src/hooks/use-expenses.ts": ["useCreateExpense"],
    "src/hooks/use-customers.ts": ["useCreateCustomer"],
  };
  for (const [file, names] of Object.entries(hooks)) {
    for (const name of names) {
      const body = handler(source(file), `export function ${name}(`);
      assert.match(body, /useIdempotencyKey\(\)/, `${file}: ${name} must send an Idempotency-Key`);
      assert.match(body, /headers\(\)/, `${file}: ${name} must put the key on its request`);
    }
  }

  // Numbering lives in one helper that runs inside the create's transaction.
  for (const rel of readdirSync(join(root, "src/app/api"), { recursive: true })) {
    if (!String(rel).endsWith(".ts")) continue;
    assert.doesNotMatch(source(`src/app/api/${rel}`), /split_part/i, `src/app/api/${rel}: numbering outside nextDisplayNumber`);
  }

  // Journaled after 0011; drizzle skips an entry with an older `when` (F-20).
  const entries = JSON.parse(source("drizzle/meta/_journal.json")).entries;
  const e12 = entries.find((e) => e.tag === "0012_idempotency_keys");
  assert.ok(e12, "drizzle/meta/_journal.json has no 0012_idempotency_keys entry");
  assert.ok(e12.when > entries.find((e) => e.tag === "0011_audit_log").when, "0012 must be newer than 0011");
});

const RUN = Date.now().toString(36);
const MARK = `F13 ${RUN}`;
const TODAY = "2026-09-12";

async function call(method, path, cookie, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, data: json?.data, json, text, headers: res.headers };
}

const keyed = (label) => ({ "idempotency-key": `f13-${RUN}-${label}` });
const burst = (n, send) => Promise.all(Array.from({ length: n }, (_, i) => send(i)));
const summary = (rs, field) => rs.map((r) => `${r.status} ${r.data?.[field] ?? r.text.slice(0, 80)}`).join(", ");

test("F-13: creates are numbered safely, saved once per submission, and settings save atomically", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await alignSchemaWithApp(sql);
  await seedRoleUsers(sql);
  const cookie = { staff: await cookieFor("staff"), manager: await cookieFor("manager"), owner: await cookieFor("owner") };
  const [before] = await sql`select * from shop_settings limit 1`;
  const VALID = {
    shopName: before?.shop_name ?? "Audit Shop",
    customerIdPrefix: before?.customer_id_prefix ?? "CUST",
    orderIdPrefix: before?.order_id_prefix ?? "ORD",
    cargoIdPrefix: before?.cargo_id_prefix ?? "CG",
  };
  const base = before?.currency_code ?? "THB";
  let customerId;
  let orderId;
  let shipmentId;
  let categoryId;

  const orderBody = (note, extra = {}) => ({
    customerId, status: "pending", exchangeRate: 1, shippingFee: 0, deliveryFee: 0, cargoFee: 0,
    serviceFee: 0, serviceFeeType: "fixed", note: `${MARK} ${note}`,
    items: [{ productUrl: "https://example.com/f13", productQty: 1, price: 100 }], ...extra,
  });

  try {
    // First: it needs a shop with no money records yet, and later steps add some.
    await t.test("a base-currency change waits for a money record still being saved, then refuses", async (st) => {
      const [{ found }] = await sql`
        select exists(select 1 from orders) or exists(select 1 from expenses) or exists(select 1 from cargo_shipments)
            or exists(select 1 from cargo_payments) or exists(select 1 from cargo_expenses)
            or exists(select 1 from cargo_categories) as found`;
      if (found) return st.skip("the throwaway database already holds money records");

      let patch;
      let answeredWhileSaving;
      await sql.begin(async (tx) => {
        await tx`insert into orders (id, order_id, note) values (${`f13lock${RUN}`}, ${`F13LOCK-${RUN}`}, ${`${MARK} lock`})`;
        let settled = false;
        patch = call("PATCH", "/api/settings", cookie.owner, { ...VALID, currencyCode: "USD", currencySymbol: "$" })
          .finally(() => { settled = true; });
        await delay(1500);
        answeredWhileSaving = settled;
      });
      const r = await patch;
      if (r.status === 200) {
        // Put the currency back at once so the later steps run against the real base currency.
        await sql`update shop_settings set currency_code = ${base}, currency_symbol = ${before?.currency_symbol ?? "฿"}`;
      }
      assert.equal(answeredWhileSaving, false, `the change answered ${r.status} while an order was still being saved`);
      assert.equal(r.status, 409, `once the order is saved the base currency is locked: ${r.status} ${r.text.slice(0, 200)}`);
    });

    await t.test("creates at the same moment get different numbers", async () => {
      const c = await call("POST", "/api/customers", cookie.staff, { name: `${MARK} customer` });
      assert.equal(c.status, 201, `fixture customer: ${c.status} ${c.text.slice(0, 200)}`);
      customerId = c.data.id;

      const kinds = [
        ["orders", "/api/orders", "orderId", (i) => orderBody(`burst ${i}`)],
        ["customers", "/api/customers", "customerId", (i) => ({ name: `${MARK} burst ${i}` })],
        ["expenses", "/api/expenses", "expenseId", (i) => ({ category: "other", amount: 1 + i, description: `${MARK} burst ${i}`, date: TODAY })],
        ["cargo shipments", "/api/cargo-shipments", "cargoNo", (i) => ({ status: "pending", exchangeRate: 1, notes: `${MARK} burst ${i}` })],
      ];
      for (const [label, path, field, body] of kinds) {
        const rs = await burst(8, (i) => call("POST", path, cookie.staff, body(i)));
        assert.ok(rs.every((r) => r.status === 201), `${label}: every create must succeed — ${summary(rs, field)}`);
        const numbers = rs.map((r) => r.data[field]);
        assert.equal(new Set(numbers).size, numbers.length, `${label}: numbers must be unique — ${numbers.join(", ")}`);
      }
    });

    await t.test("a stored ID whose number part isn't digits doesn't block numbering", async () => {
      const prefix = VALID.orderIdPrefix;
      try {
        await sql`insert into orders (id, order_id, note) values (${`f13bad${RUN}`}, ${`${prefix}-F13X${RUN}`}, ${`${MARK} bad id`})`;
        const o = await call("POST", "/api/orders", cookie.staff, orderBody("after a bad id"));
        assert.equal(o.status, 201, `order after ${prefix}-F13X${RUN}: ${o.status} ${o.text.slice(0, 200)}`);
        assert.match(o.data.orderId, new RegExp(`^${prefix}-\\d{5,}$`));

        await sql`insert into customers (id, customer_id, name) values (${`f13bad${RUN}`}, ${`F13NODASH${RUN}`}, ${`${MARK} bad id`})`;
        const c = await call("POST", "/api/customers", cookie.staff, { name: `${MARK} after a bad id` });
        assert.equal(c.status, 201, `customer after F13NODASH${RUN}: ${c.status} ${c.text.slice(0, 200)}`);
      } finally {
        // Removed straight away so they can't break the later steps on a build without the fix.
        await sql`delete from orders where id = ${`f13bad${RUN}`}`;
        await sql`delete from customers where id = ${`f13bad${RUN}`}`;
      }
    });

    await t.test("a retry with the same Idempotency-Key returns the saved order instead of saving another", async () => {
      const body = orderBody("once");
      const first = await call("POST", "/api/orders", cookie.staff, body, keyed("order-once"));
      assert.equal(first.status, 201, `first submit: ${first.status} ${first.text.slice(0, 200)}`);
      orderId = first.data.id;

      const retry = await call("POST", "/api/orders", cookie.staff, body, keyed("order-once"));
      assert.equal(retry.status, 201, `retry: ${retry.status} ${retry.text.slice(0, 200)}`);
      assert.equal(retry.data?.id, orderId, "the retry must return the order already saved");
      assert.equal(retry.data?.orderId, first.data.orderId);
      assert.equal(retry.headers.get("idempotent-replayed"), "true");

      const [{ n }] = await sql`select count(*)::int as n from orders where note = ${body.note}`;
      const [{ items }] = await sql`select count(*)::int as items from order_items where order_id = ${orderId}`;
      assert.deepEqual({ orders: n, items }, { orders: 1, items: 1 });
    });

    await t.test("the same key with different values is refused; simultaneous retries still save once", async () => {
      const changed = await call("POST", "/api/orders", cookie.staff, orderBody("once", { shippingFee: 50 }), keyed("order-once"));
      assert.equal(changed.status, 422, `reused key, different values: ${changed.status} ${changed.text.slice(0, 200)}`);
      const [{ n }] = await sql`select count(*)::int as n from orders where note = ${`${MARK} once`}`;
      assert.equal(n, 1, "nothing new saved");

      const body = orderBody("together");
      const rs = await burst(3, () => call("POST", "/api/orders", cookie.staff, body, keyed("order-together")));
      assert.ok(rs.every((r) => r.status === 201), summary(rs, "orderId"));
      assert.equal(new Set(rs.map((r) => r.data.id)).size, 1, `one order for all three: ${summary(rs, "orderId")}`);
      const [{ m }] = await sql`select count(*)::int as m from orders where note = ${body.note}`;
      assert.equal(m, 1);
    });

    await t.test("a key belongs to the user who sent it, and a malformed key is refused", async () => {
      const other = await call("POST", "/api/orders", cookie.manager, orderBody("manager"), keyed("order-once"));
      assert.equal(other.status, 201, `another user's same key: ${other.status} ${other.text.slice(0, 200)}`);
      assert.notEqual(other.data?.id, orderId, "another user's submission is its own order");

      for (const bad of ["short", "has spaces in the key!", "x".repeat(101)]) {
        const r = await call("POST", "/api/orders", cookie.staff, orderBody(`bad key ${bad.length}`), { "idempotency-key": bad });
        assert.equal(r.status, 400, `Idempotency-Key ${JSON.stringify(bad)}: ${r.status}`);
      }
    });

    await t.test("every other money-or-numbered create returns the saved record on retry", async () => {
      const s = await call("POST", "/api/cargo-shipments", cookie.staff, { status: "pending", exchangeRate: 1, notes: `${MARK} fixture` });
      const cat = await call("POST", "/api/cargo-categories", cookie.owner, { name: `${MARK} category`, carrierRatePerKg: 1, receiverRatePerKg: 2 });
      assert.deepEqual([s.status, cat.status], [201, 201], `fixtures: ${s.text.slice(0, 120)} ${cat.text.slice(0, 120)}`);
      shipmentId = s.data.id;
      categoryId = cat.data.id;

      const cases = [
        ["order-items", `/api/order-items/${orderId}`, { productUrl: "https://example.com/f13-item", productQty: 2, price: 5 }],
        ["cargo-shipments", "/api/cargo-shipments", { status: "pending", exchangeRate: 1, notes: `${MARK} once` }],
        ["cargo-items", `/api/cargo-items/${shipmentId}`, { customerId, categoryId, weightKg: 1, carrierRatePerKg: 1, receiverRatePerKg: 2 }],
        ["cargo-payments", `/api/cargo-payments/${shipmentId}`, { partyType: "carrier", amount: 10, currency: base, paidAt: TODAY }],
        ["cargo-expenses", `/api/cargo-expenses/${shipmentId}`, { category: "handling", amount: 5, incurredAt: TODAY }],
        ["expenses", "/api/expenses", { category: "other", amount: 7, description: `${MARK} once`, date: TODAY }],
        ["customers", "/api/customers", { name: `${MARK} once` }],
      ];
      for (const [label, path, body] of cases) {
        const first = await call("POST", path, cookie.staff, body, keyed(label));
        const retry = await call("POST", path, cookie.staff, body, keyed(label));
        assert.equal(first.status, 201, `${label} first submit: ${first.status} ${first.text.slice(0, 200)}`);
        assert.equal(retry.status, 201, `${label} retry: ${retry.status} ${retry.text.slice(0, 200)}`);
        assert.equal(retry.data?.id, first.data?.id, `${label}: the retry must return the saved record, not a second one`);
      }
    });

    await t.test("a refused or failed create doesn't use up its key", async () => {
      const refused = await call("POST", `/api/cargo-payments/${shipmentId}`, cookie.staff,
        { partyType: "carrier", amount: 10, currency: "USD", paidAt: TODAY }, keyed("refused-payment"));
      assert.equal(refused.status, 400, `carrier payment in USD: ${refused.status}`);
      const accepted = await call("POST", `/api/cargo-payments/${shipmentId}`, cookie.staff,
        { partyType: "carrier", amount: 10, currency: base, paidAt: TODAY }, keyed("refused-payment"));
      assert.equal(accepted.status, 201, `corrected payment, same key: ${accepted.status} ${accepted.text.slice(0, 200)}`);

      const broken = await call("POST", `/api/cargo-items/${shipmentId}`, cookie.staff,
        { customerId, categoryId: "f13_no_such_category", weightKg: 1, carrierRatePerKg: 1, receiverRatePerKg: 1 }, keyed("failed-item"));
      assert.equal(broken.status, 500, "an unknown category fails on its foreign key");
      const fixed = await call("POST", `/api/cargo-items/${shipmentId}`, cookie.staff,
        { customerId, categoryId, weightKg: 1, carrierRatePerKg: 1, receiverRatePerKg: 1 }, keyed("failed-item"));
      assert.equal(fixed.status, 201, `corrected item, same key: ${fixed.status} ${fixed.text.slice(0, 200)}`);
    });

    await t.test("two first-time saves of shop settings both succeed and leave one row", async () => {
      await sql`delete from shop_settings`;
      const rs = await burst(5, () => call("PATCH", "/api/settings", cookie.owner, VALID));
      assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200, 200], rs.map((r) => r.text.slice(0, 80)).join(" | "));
      const [{ n }] = await sql`select count(*)::int as n from shop_settings`;
      assert.equal(n, 1);
    });
  } finally {
    const M = `${MARK}%`;
    const shipments = sql`select id from cargo_shipments where notes like ${M}`;
    await sql`delete from cargo_items where cargo_shipment_id in (${shipments}) or customer_id in (select id from customers where name like ${M})`;
    await sql`delete from cargo_payments where cargo_shipment_id in (${shipments})`;
    await sql`delete from cargo_expenses where cargo_shipment_id in (${shipments})`;
    await sql`delete from cargo_shipments where notes like ${M}`;
    await sql`delete from cargo_categories where name like ${M}`;
    await sql`delete from order_items where order_id in (select id from orders where note like ${M})`;
    await sql`delete from orders where note like ${M}`;
    await sql`delete from expenses where title like ${M}`;
    await sql`delete from customers where name like ${M}`;
    const [{ keys }] = await sql`select to_regclass('idempotency_keys') is not null as keys`;
    if (keys) await sql`delete from idempotency_keys where key like ${`f13-${RUN}-%`}`;
    await sql`delete from shop_settings`;
    if (before) await sql`insert into shop_settings ${sql(before)}`;
    await sql.end();
  }
});
