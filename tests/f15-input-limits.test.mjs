// Demonstration + guard for AUDIT.md finding F-15.
//
// F-15: numbers had lower limits only, dates weren't checked, and some text
// fields and lists had no length limit. A fee of 1e308 was stored and then made
// dashboard sums fail for everyone; a quantity above the integer column, an
// impossible date ("2026-02-30") or a blank date from the forms reached Postgres
// and returned 500; a percentage service fee could be 5000%.
//
// Decisions agreed with the owner (2026-09-12):
//   - any single amount is at most 1,000,000,000 (fits a large receiver payment in kyat)
//   - a percentage service fee is at most 100%
//   - a product link may be any text up to 2,000 characters
//   - no check that a purchase discount is within the items
//
// Fix under test: src/validations/limits.ts holds the limits and a real-date
// check, and every request schema uses them. PATCH /api/orders/:id checks a
// percentage fee against the stored fee or type the edit doesn't change, because
// the order page saves one field at a time.
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f15-input-limits.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BASE, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(join(root, file), "utf8");

test("F-15: a date must be a real calendar date, and a blank one means no date", async () => {
  const { isCalendarDate, optionalIsoDate } = await import("../src/validations/limits.ts");

  for (const ok of ["2026-09-12", "2024-02-29", "0001-01-01", "9999-12-31"]) {
    assert.equal(isCalendarDate(ok), true, ok);
  }
  for (const bad of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "0000-01-01", "2026-9-12", "12/09/2026", "", "2026-09-12T00:00:00Z"]) {
    assert.equal(isCalendarDate(bad), false, JSON.stringify(bad));
  }
  // Date inputs send "" when left empty; Postgres can't store that in a date column.
  assert.equal(optionalIsoDate.parse(""), null);
  assert.equal(optionalIsoDate.parse(null), null);
  assert.equal(optionalIsoDate.parse(undefined), undefined);
  assert.equal(optionalIsoDate.safeParse("2026-02-30").success, false);
});

test("F-15: every number, date, string and list in the request schemas has a limit", () => {
  const files = readdirSync(join(root, "src/validations"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => `src/validations/${f}`)
    .concat("src/app/api/orders/bulk/route.ts");
  const offenders = [];
  for (const file of files) {
    source(file).split("\n").forEach((line, i) => {
      const at = `${file}:${i + 1}`;
      if (/z\.number\(\)/.test(line) && !/\.(max|lt|lte)\(/.test(line)) offenders.push(`${at} number without a maximum`);
      if (/z\.array\(/.test(line) && !/MAX_LIST/.test(line)) offenders.push(`${at} list without MAX_LIST`);
      if (/z\.string\(\)/.test(line) && !/\.(max|regex)\(|refine\(isCalendarDate/.test(line)) offenders.push(`${at} string without a maximum`);
      if (/\b(\w*Date|paidAt|incurredAt|date)\s*:\s*z\.string\(\)/.test(line)) offenders.push(`${at} date field accepts any text`);
    });
  }
  assert.deepEqual(offenders, [], "request fields without an upper limit");
});

const RUN = Date.now().toString(36);
const MARK = `F15 ${RUN}`;
const TODAY = "2026-09-12";
const OVER = { amount: 1e9 + 1, rate: 1e6 + 1, weight: 1e5 + 1, quantity: 1e6 + 1 };

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML page */ }
  return { status: res.status, data: json?.data, text };
}

test("F-15: the API refuses values outside their limits with 400 and accepts values at them", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await alignSchemaWithApp(sql);
  await seedRoleUsers(sql);
  const cookie = { staff: await cookieFor("staff"), owner: await cookieFor("owner") };
  const [before] = await sql`select * from shop_settings limit 1`;
  const VALID = {
    shopName: before?.shop_name ?? "Audit Shop",
    customerIdPrefix: before?.customer_id_prefix ?? "CUST",
    orderIdPrefix: before?.order_id_prefix ?? "ORD",
    cargoIdPrefix: before?.cargo_id_prefix ?? "CG",
  };
  const base = before?.currency_code ?? "THB";
  const restoreSettings = async () => {
    if (before) await sql`update shop_settings set default_exchange_rate = ${before.default_exchange_rate}, logo_cloud_url = ${before.logo_cloud_url}`;
  };
  let customerId;
  let shipmentId;
  let categoryId;

  const orderBody = (note, extra = {}) => ({
    customerId, status: "pending", exchangeRate: 1, shippingFee: 0, deliveryFee: 0, cargoFee: 0,
    serviceFee: 0, serviceFeeType: "fixed", note: `${MARK} ${note}`, orderDate: TODAY,
    items: [{ productUrl: "https://example.com/f15", productQty: 1, price: 10 }], ...extra,
  });
  const item = (extra) => ({ items: [{ productUrl: "https://example.com/f15", productQty: 1, price: 10, ...extra }] });

  // Runs [label, method, path, role, body, expected status] cases and reports every mismatch at once.
  const expectStatuses = async (cases) => {
    const wrong = [];
    for (const [label, method, path, role, body, expected] of cases) {
      const r = await call(method, path, cookie[role], body);
      if (r.status !== expected) wrong.push(`${label}: expected ${expected}, got ${r.status} ${r.text.slice(0, 120)}`);
    }
    assert.deepEqual(wrong, []);
  };

  try {
    const c = await call("POST", "/api/customers", cookie.staff, { name: `${MARK} customer` });
    const s = await call("POST", "/api/cargo-shipments", cookie.staff, { status: "pending", exchangeRate: 1, notes: `${MARK} fixture` });
    const cat = await call("POST", "/api/cargo-categories", cookie.owner, { name: `${MARK} category`, carrierRatePerKg: 1, receiverRatePerKg: 2 });
    assert.deepEqual([c.status, s.status, cat.status], [201, 201, 201], `fixtures: ${c.text.slice(0, 100)} ${s.text.slice(0, 100)} ${cat.text.slice(0, 100)}`);
    customerId = c.data.id;
    shipmentId = s.data.id;
    categoryId = cat.data.id;

    await t.test("absurd amounts can't be saved, so dashboard totals can't overflow", async () => {
      try {
        const creates = [];
        for (const i of [1, 2]) creates.push((await call("POST", "/api/orders", cookie.staff, orderBody(`huge ${i}`, { shippingFee: 1e308 }))).status);
        const dashboard = await call("GET", "/api/dashboard", cookie.owner);
        assert.deepEqual({ creates, dashboard: dashboard.status }, { creates: [400, 400], dashboard: 200 }, dashboard.text.slice(0, 160));
      } finally {
        await sql`delete from order_items where order_id in (select id from orders where note like ${`${MARK} huge%`})`;
        await sql`delete from orders where note like ${`${MARK} huge%`}`;
      }
    });

    await t.test("amounts, rates, weights and quantities are limited", async () => {
      try {
        await expectStatuses([
          ["order with every amount, rate, weight and quantity at its limit", "POST", "/api/orders", "staff", orderBody("at limit", {
            shippingFee: 1e9, deliveryFee: 1e9, cargoFee: 1e9, serviceFee: 1e9, productDiscount: 1e9, exchangeRate: 1e6,
            ...item({ price: 1e9, productQty: 1e6, productWeight: 1e5 }),
          }), 201],
          ["order shipping fee over", "POST", "/api/orders", "staff", orderBody("over", { shippingFee: OVER.amount }), 400],
          ["order fixed service fee over", "POST", "/api/orders", "staff", orderBody("over", { serviceFee: OVER.amount }), 400],
          ["order purchase discount over", "POST", "/api/orders", "staff", orderBody("over", { productDiscount: OVER.amount }), 400],
          ["order exchange rate over", "POST", "/api/orders", "staff", orderBody("over", { exchangeRate: OVER.rate }), 400],
          ["item price over", "POST", "/api/orders", "staff", orderBody("over", item({ price: OVER.amount })), 400],
          ["item quantity over", "POST", "/api/orders", "staff", orderBody("over", item({ productQty: OVER.quantity })), 400],
          ["item quantity beyond the integer column", "POST", "/api/orders", "staff", orderBody("over", item({ productQty: 3e9 })), 400],
          ["item weight over", "POST", "/api/orders", "staff", orderBody("over", item({ productWeight: OVER.weight })), 400],
          ["shipment exchange rate over", "POST", "/api/cargo-shipments", "staff", { status: "pending", exchangeRate: OVER.rate, notes: `${MARK} over` }, 400],
          ["cargo category rate over", "POST", "/api/cargo-categories", "owner", { name: `${MARK} over`, carrierRatePerKg: OVER.amount, receiverRatePerKg: 1 }, 400],
          ["cargo item weight over", "POST", `/api/cargo-items/${shipmentId}`, "staff", { customerId, categoryId, weightKg: OVER.weight, carrierRatePerKg: 1, receiverRatePerKg: 1 }, 400],
          ["cargo item rate over", "POST", `/api/cargo-items/${shipmentId}`, "staff", { customerId, categoryId, weightKg: 1, carrierRatePerKg: 1, receiverRatePerKg: OVER.amount }, 400],
          ["carrier payment at the limit", "POST", `/api/cargo-payments/${shipmentId}`, "staff", { partyType: "carrier", amount: 1e9, currency: base, paidAt: TODAY }, 201],
          ["payment amount over", "POST", `/api/cargo-payments/${shipmentId}`, "staff", { partyType: "carrier", amount: OVER.amount, currency: base, paidAt: TODAY }, 400],
          ["payment exchange rate over", "POST", `/api/cargo-payments/${shipmentId}`, "staff", { partyType: "receiver", customerId, amount: 10, currency: "MMK", exchangeRate: OVER.rate, paidAt: TODAY }, 400],
          ["cargo expense amount over", "POST", `/api/cargo-expenses/${shipmentId}`, "staff", { category: "handling", amount: OVER.amount, incurredAt: TODAY }, 400],
          ["expense at the limit", "POST", "/api/expenses", "staff", { category: "other", amount: 1e9, description: `${MARK} at limit`, date: TODAY }, 201],
          ["expense amount over", "POST", "/api/expenses", "staff", { category: "other", amount: OVER.amount, description: `${MARK} over`, date: TODAY }, 400],
          ["default exchange rate over", "PATCH", "/api/settings", "owner", { ...VALID, defaultExchangeRate: OVER.rate }, 400],
        ]);
      } finally {
        await restoreSettings();
      }
    });

    await t.test("dates must be real calendar dates, and a blank date from a form means no date", async () => {
      await expectStatuses([
        ["order dated 2026-02-30", "POST", "/api/orders", "staff", orderBody("bad date", { orderDate: "2026-02-30" }), 400],
        ["order dated 29 February in a leap year", "POST", "/api/orders", "staff", orderBody("leap date", { orderDate: "2024-02-29" }), 201],
        ["expense dated 2026-02-29", "POST", "/api/expenses", "staff", { category: "other", amount: 1, description: `${MARK} bad date`, date: "2026-02-29" }, 400],
        ["payment dated 2026-02-30", "POST", `/api/cargo-payments/${shipmentId}`, "staff", { partyType: "carrier", amount: 1, currency: base, paidAt: "2026-02-30" }, 400],
        ["cargo expense dated 2026-13-01", "POST", `/api/cargo-expenses/${shipmentId}`, "staff", { category: "handling", amount: 1, incurredAt: "2026-13-01" }, 400],
        ["shipment departure edited to 2026-13-01", "PATCH", `/api/cargo-shipments/${shipmentId}`, "staff", { departureDate: "2026-13-01" }, 400],
      ]);

      const blankOrder = await call("POST", "/api/orders", cookie.staff, orderBody("blank dates", { orderDate: "", shipmentDate: "" }));
      const blankShipment = await call("POST", "/api/cargo-shipments", cookie.staff,
        { status: "pending", exchangeRate: 1, notes: `${MARK} blank dates`, departureDate: "", arrivalDate: "" });
      assert.deepEqual({ order: blankOrder.status, shipment: blankShipment.status }, { order: 201, shipment: 201 },
        `blank dates as the forms send them: ${blankOrder.text.slice(0, 120)} | ${blankShipment.text.slice(0, 120)}`);
      assert.deepEqual([blankOrder.data.orderDate, blankShipment.data.departureDate, blankShipment.data.arrivalDate], [null, null, null]);
    });

    await t.test("a percentage service fee is at most 100%, checked against what the order already stores", async () => {
      const over = await call("POST", "/api/orders", cookie.staff, orderBody("percent over", { serviceFeeType: "percent", serviceFee: 101 }));
      const percent = await call("POST", "/api/orders", cookie.staff, orderBody("percent", { serviceFeeType: "percent", serviceFee: 100 }));
      const fixed = await call("POST", "/api/orders", cookie.staff, orderBody("fixed", { serviceFeeType: "fixed", serviceFee: 500 }));
      assert.deepEqual([over.status, percent.status, fixed.status], [400, 201, 201], `create: ${over.text.slice(0, 160)}`);
      const patch = async (id, body) => (await call("PATCH", `/api/orders/${id}`, cookie.staff, body)).status;
      const stored = async (id) => (await sql`select service_fee, service_fee_type from orders where id = ${id}`)[0];

      // The order page saves the type and the fee separately.
      assert.equal(await patch(fixed.data.id, { serviceFeeType: "percent" }), 400, "a fee of 500 can't become 500%");
      assert.deepEqual(await stored(fixed.data.id), { service_fee: 500, service_fee_type: "fixed" });
      assert.equal(await patch(percent.data.id, { serviceFee: 150 }), 400, "150 on a percentage order");
      assert.equal(await patch(percent.data.id, { serviceFee: 80 }), 200);
      assert.equal(await patch(percent.data.id, { serviceFeeType: "fixed", serviceFee: 500 }), 200, "an amount may be over 100");

      // An order saved over 100% before the limit can still have its other fields edited.
      await sql`update orders set service_fee = 150, service_fee_type = '%' where id = ${percent.data.id}`;
      assert.equal(await patch(percent.data.id, { note: `${MARK} legacy edit` }), 200);
      assert.equal(await patch(percent.data.id, { serviceFee: 120 }), 400, "the legacy '%' type counts as a percentage");
    });

    await t.test("text fields, IDs and lists are limited", async () => {
      const shareText = `【淘宝】${MARK} https://m.tb.cn/h.f15 复制这条消息打开手机淘宝 `;
      const link = (n) => shareText.padEnd(n, "x").slice(0, n);
      const items = (n) => Array.from({ length: n }, () => ({ productUrl: "https://example.com/f15", productQty: 1, price: 1 }));
      try {
        await expectStatuses([
          ["product link of 2,000 characters of pasted share text", "POST", "/api/orders", "staff", orderBody("long link", item({ productUrl: link(2000) })), 201],
          ["product link over 2,000 characters", "POST", "/api/orders", "staff", orderBody("long link", item({ productUrl: link(2001) })), 400],
          ["order note over 2,000 characters", "POST", "/api/orders", "staff", orderBody("x", { note: `${MARK} ${"n".repeat(2000)}` }), 400],
          ["order source over 100 characters", "POST", "/api/orders", "staff", orderBody("long source", { orderFrom: "o".repeat(101) }), 400],
          ["customer id over 36 characters", "POST", "/api/orders", "staff", orderBody("long customer id", { customerId: "c".repeat(37) }), 400],
          ["order with 500 items", "POST", "/api/orders", "staff", orderBody("500 items", { items: items(500) }), 201],
          ["order with 501 items", "POST", "/api/orders", "staff", orderBody("501 items", { items: items(501) }), 400],
          ["bulk status for 501 orders", "PATCH", "/api/orders/bulk", "staff", { ids: Array.from({ length: 501 }, (_, i) => `f15_${i}`), status: "pending" }, 400],
          ["logo as a javascript: URL", "PATCH", "/api/settings", "owner", { ...VALID, logoUrl: "javascript:alert(1)" }, 400],
          ["logo as an https address", "PATCH", "/api/settings", "owner", { ...VALID, logoUrl: "https://example.com/logo.png" }, 200],
        ]);
      } finally {
        await restoreSettings();
      }
    });
  } finally {
    const M = `${MARK}%`;
    const shipments = sql`select id from cargo_shipments where notes like ${M}`;
    await sql`delete from cargo_items where cargo_shipment_id in (${shipments})`;
    await sql`delete from cargo_payments where cargo_shipment_id in (${shipments})`;
    await sql`delete from cargo_expenses where cargo_shipment_id in (${shipments})`;
    await sql`delete from cargo_shipments where notes like ${M}`;
    await sql`delete from cargo_categories where name like ${M}`;
    await sql`delete from order_items where order_id in (select id from orders where note like ${M})`;
    await sql`delete from orders where note like ${M}`;
    await sql`delete from expenses where title like ${M}`;
    await sql`delete from customers where name like ${M}`;
    await restoreSettings();
    await sql.end();
  }
});
