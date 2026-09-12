// Demonstration + guard for AUDIT.md finding F-11.
//
// F-11: cargo balances converted a receiver payment only when its currency
// differed from `prefs.currencyCode`, a value read from each browser's
// localStorage (default "USD"). The same payments therefore showed different
// paid/partial/unpaid badges and balances on different browsers, every currency
// symbol was per-browser too, and a payment could be recorded in any currency,
// including ones the balance math silently mis-converts.
//
// Decisions agreed with the owner (2026-09-12):
//   - base currency THB (฿), exchange currency MMK (Ks), stored once in shop_settings
//   - receiver payments in the base or exchange currency; carrier payments in the base only
//   - the base currency code can't change once any order, expense or cargo record exists
//   - the default exchange rate is shop-wide and only the owner sets it
//
// Fix under test: drizzle/0010_shop_currency.sql adds the settings columns;
// src/lib/currency.ts maps them (falling back to the shop defaults) and checks
// payment currencies; /api/settings and /api/cargo-payments enforce the rules;
// the cargo page computes balances from the server's shop settings.
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database with migrations 0000–0010 applied, plus its secret. It
// changes shop settings and puts them back, so run it on its own or with
// --test-concurrency=1:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f11-shop-currency.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BASE, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(join(root, file), "utf8");

test("F-11: shop currency defaults and payment currency rules", async () => {
  const { CURRENCY_DEFAULTS, shopCurrency, paymentCurrencyError } = await import("../src/lib/currency.ts");

  assert.deepEqual(CURRENCY_DEFAULTS, {
    currencyCode: "THB", currencySymbol: "฿", exchangeCurrencyCode: "MMK", exchangeCurrencySymbol: "Ks", exchangeRate: 1,
  });
  // No settings row, or settings still loading: the shop defaults.
  assert.deepEqual(shopCurrency(null), CURRENCY_DEFAULTS);
  assert.deepEqual(shopCurrency(undefined), CURRENCY_DEFAULTS);
  // A settings row maps its columns to the prefs every page reads.
  assert.deepEqual(
    shopCurrency({ currencyCode: "USD", currencySymbol: "$", exchangeCurrencyCode: "MMK", exchangeCurrencySymbol: "Ks", defaultExchangeRate: 2100 }),
    { currencyCode: "USD", currencySymbol: "$", exchangeCurrencyCode: "MMK", exchangeCurrencySymbol: "Ks", exchangeRate: 2100 }
  );

  // Receivers may pay in either currency; carriers are counted at face value, so base only.
  const shop = { currencyCode: "THB", exchangeCurrencyCode: "MMK" };
  assert.equal(paymentCurrencyError("receiver", "MMK", shop), null);
  assert.equal(paymentCurrencyError("receiver", " thb ", shop), null);
  assert.equal(paymentCurrencyError("carrier", "THB", shop), null);
  assert.match(paymentCurrencyError("carrier", "MMK", shop) ?? "", /carrier.*THB/i);
  assert.match(paymentCurrencyError("carrier", "USD", shop) ?? "", /carrier.*THB/i);
  assert.match(paymentCurrencyError("receiver", "USD", shop) ?? "", /THB or MMK/);
  assert.match(paymentCurrencyError("receiver", "MMKK", shop) ?? "", /THB or MMK/);
});

test("F-11: no browser-local currency feeds money math", () => {
  const offenders = [];
  for (const rel of readdirSync(join(root, "src"), { recursive: true })) {
    const file = `src/${rel}`;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    if (/localStorage\.\w+\(\s*["'`][^"'`]*currency/i.test(source(file))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "currency settings read from or written to localStorage");

  // Every money display passes the shop's symbol. formatCurrency() defaults to "$",
  // and a few pages hard-coded "$" (found in the browser while verifying F-12).
  const dollars = [];
  for (const rel of readdirSync(join(root, "src"), { recursive: true })) {
    const file = `src/${rel}`;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = source(file);
    if (/formatCurrency\((?:[^(),]|\([^()]*\))*\)/.test(text)) dollars.push(`${file}: formatCurrency() without a symbol`);
    if (/>\$\{[\w?.]*(amount|total|spent|price|fee)/i.test(text)) dollars.push(`${file}: hard-coded "$" before an amount`);
  }
  assert.deepEqual(dollars, [], "money shown with a dollar sign instead of the shop's symbol");

  const detail = source("src/components/cargo/cargo-detail-client.tsx");
  assert.doesNotMatch(detail, /useCurrencyPrefs/, "cargo balances must not depend on client-loaded prefs");
  assert.match(detail, /shopCurrency\(shop\)/, "cargo balances must use the server's shop settings");
  assert.doesNotMatch(
    source("src/components/cargo/cargo-payments-section.tsx"),
    /"USD"|"MMK"/,
    "the payment form must default to the shop's currencies, not hard-coded codes"
  );

  // The migration is journaled after 0009; drizzle skips an entry with an older `when` (F-20).
  const entries = JSON.parse(source("drizzle/meta/_journal.json")).entries;
  const e10 = entries.find((e) => e.tag === "0010_shop_currency");
  assert.ok(e10, "drizzle/meta/_journal.json has no 0010_shop_currency entry");
  assert.ok(e10.when > entries.find((e) => e.tag === "0009_user_session_version").when, "0010 must be newer than 0009");
});

const VALID = { shopName: "Audit Shop", customerIdPrefix: "CUST", orderIdPrefix: "ORD", cargoIdPrefix: "CG" };
const CURRENCY = { currencyCode: "THB", currencySymbol: "฿", exchangeCurrencyCode: "MMK", exchangeCurrencySymbol: "Ks" };
const CUSTOMER = "f11_c1";
const SHIP_PAGE = "f11_s1";
const SHIP_POST = "f11_s2";

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
  return { status: res.status, data: json?.data, error: json?.error, text };
}

async function hasMoneyRows(sql) {
  const [{ found }] = await sql`
    select exists(select 1 from orders) or exists(select 1 from expenses)
        or exists(select 1 from cargo_shipments) or exists(select 1 from cargo_payments)
        or exists(select 1 from cargo_expenses) or exists(select 1 from cargo_categories) as found`;
  return found;
}

async function removeCargoFixture(sql) {
  await sql`delete from cargo_payments where cargo_shipment_id in (${SHIP_PAGE}, ${SHIP_POST})`;
  await sql`delete from cargo_items where cargo_shipment_id in (${SHIP_PAGE}, ${SHIP_POST})`;
  await sql`delete from cargo_shipments where id in (${SHIP_PAGE}, ${SHIP_POST})`;
  await sql`delete from customers where id = ${CUSTOMER}`;
}

// 10 kg at carrier 30 / receiver 50 per kg: carrier owed 300 THB, receiver owed 500 THB.
// The receiver paid 20,000 MMK at 100 MMK per THB (200 THB) plus 300 THB, so is paid in
// full; the carrier was paid 300 THB. Under the old untouched-browser base ("USD") the THB
// payment was divided by the rate too: paid 203, "partial", 297 left.
async function seedCargoFixture(sql) {
  await removeCargoFixture(sql);
  await sql`insert into customers (id, customer_id, name) values (${CUSTOMER}, ${"F11C-00001"}, ${"F11 Receiver"})`;
  await sql`insert into cargo_shipments (id, cargo_no, exchange_rate) values (${SHIP_PAGE}, ${"F11-CG-1"}, 100), (${SHIP_POST}, ${"F11-CG-2"}, 100)`;
  await sql`
    insert into cargo_items (id, cargo_shipment_id, customer_id, weight_kg, carrier_rate_per_kg, receiver_rate_per_kg, public_code)
    values (${"f11_i1"}, ${SHIP_PAGE}, ${CUSTOMER}, 10, 30, 50, ${"F11PUBLICCODE001"})`;
  await sql`
    insert into cargo_payments (id, cargo_shipment_id, party_type, customer_id, amount, currency, exchange_rate, paid_at) values
      (${"f11_p1"}, ${SHIP_PAGE}, ${"receiver"}, ${CUSTOMER}, 20000, ${"MMK"}, 100, ${"2099-01-01"}),
      (${"f11_p2"}, ${SHIP_PAGE}, ${"receiver"}, ${CUSTOMER}, 300, ${"THB"}, null, ${"2099-01-02"}),
      (${"f11_p3"}, ${SHIP_PAGE}, ${"carrier"}, null, 300, ${"THB"}, null, ${"2099-01-03"})`;
}

test("F-11: currency lives in shop settings and the server enforces it", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  await alignSchemaWithApp(sql);
  await seedRoleUsers(sql);
  const owner = await cookieFor("owner");
  const staff = await cookieFor("staff");
  const [before] = await sql`select * from shop_settings limit 1`;

  try {
    await t.test("every role reads the shop's currency from the server (THB / MMK by default)", async () => {
      if (before) {
        await sql`update shop_settings set currency_code = default, currency_symbol = default,
                    exchange_currency_code = default, exchange_currency_symbol = default, default_exchange_rate = default`;
      }
      const r = await call("GET", "/api/settings", staff);
      assert.equal(r.status, 200);
      assert.deepEqual(
        {
          currencyCode: r.data?.currencyCode, currencySymbol: r.data?.currencySymbol,
          exchangeCurrencyCode: r.data?.exchangeCurrencyCode, exchangeCurrencySymbol: r.data?.exchangeCurrencySymbol,
          defaultExchangeRate: r.data?.defaultExchangeRate,
        },
        { ...CURRENCY, defaultExchangeRate: 1 }
      );
    });

    await t.test("the owner sets symbols and the shared default rate; formats are validated", async () => {
      const ok = await call("PATCH", "/api/settings", owner, {
        ...VALID, currencyCode: " thb ", currencySymbol: "฿", exchangeCurrencyCode: "mmk", exchangeCurrencySymbol: "Ks", defaultExchangeRate: 125.5,
      });
      assert.equal(ok.status, 200, `valid currency settings refused: ${ok.status} ${ok.error ?? ""}`);
      assert.equal(ok.data?.currencyCode, "THB", "codes are trimmed and uppercased");
      assert.equal(ok.data?.exchangeCurrencyCode, "MMK");
      const read = await call("GET", "/api/settings", staff);
      assert.equal(read.data?.defaultExchangeRate, 125.5, "staff see the owner's default rate");

      for (const bad of [
        { currencyCode: "BAHT" }, { currencyCode: "" }, { currencyCode: "TH1" },
        { exchangeCurrencyCode: "THB" }, { currencySymbol: "" }, { exchangeCurrencySymbol: "x".repeat(11) },
        { defaultExchangeRate: 0 }, { defaultExchangeRate: -1 }, { defaultExchangeRate: 1e12 },
      ]) {
        const r = await call("PATCH", "/api/settings", owner, { ...VALID, ...bad });
        assert.equal(r.status, 400, `${JSON.stringify(bad)} must be refused, got ${r.status}`);
      }
      const forbidden = await call("PATCH", "/api/settings", staff, { ...VALID, defaultExchangeRate: 99 });
      assert.equal(forbidden.status, 403, "only the owner changes currency settings");
    });

    await t.test("the base currency can change only while no money is recorded", async (st) => {
      if (await hasMoneyRows(sql)) {
        st.diagnostic("database already holds orders/expenses/cargo rows; unlocked path not exercised");
      } else {
        const change = await call("PATCH", "/api/settings", owner, { ...VALID, currencyCode: "USD" });
        assert.equal(change.status, 200, `base change on an empty shop refused: ${change.status} ${change.error ?? ""}`);
        const back = await call("PATCH", "/api/settings", owner, { ...VALID, currencyCode: "THB" });
        assert.equal(back.status, 200);
      }

      await seedCargoFixture(sql);
      const locked = await call("PATCH", "/api/settings", owner, { ...VALID, currencyCode: "USD" });
      assert.equal(locked.status, 409, `base change with money recorded must be refused, got ${locked.status}`);
      assert.match(locked.error ?? "", /THB/);
      assert.equal((await call("GET", "/api/settings", staff)).data?.currencyCode, "THB", "base currency unchanged");
      const same = await call("PATCH", "/api/settings", owner, { ...VALID, ...CURRENCY });
      assert.equal(same.status, 200, "re-saving the same base currency is not a change");
    });

    await t.test("the cargo page computes balances with the shop's currency", async () => {
      await seedCargoFixture(sql);
      // A symbol change is allowed while locked, and shows the page reads the server's value.
      const sym = await call("PATCH", "/api/settings", owner, { ...VALID, currencySymbol: "TB" });
      assert.equal(sym.status, 200);

      const page = await call("GET", `/cargo/${SHIP_PAGE}`, staff);
      assert.equal(page.status, 200);
      const html = page.text.replaceAll("<!-- -->", "");
      assert.match(html, /Receiver Owed<\/p><p[^>]*>TB 500<\/p><p[^>]*>Balance TB 0<\/p>/, "receiver owed 500, balance 0, in the shop's symbol");
      assert.match(html, /Carrier Owed<\/p><p[^>]*>TB 300<\/p><p[^>]*>Balance TB 0<\/p>/);
      assert.match(html, /title="Receiver paid [^"]* 500 in full"/, "receiver badge must be paid in full (MMK converted, THB at face value)");
    });

    await t.test("payments are accepted only in currencies the balance math handles", async () => {
      await seedCargoFixture(sql);
      const pay = (body) =>
        call("POST", `/api/cargo-payments/${SHIP_POST}`, staff, { amount: 100, exchangeRate: 100, paidAt: "2099-02-01", ...body });
      const receiver = { partyType: "receiver", customerId: CUSTOMER };
      const carrier = { partyType: "carrier", customerId: null };

      assert.equal((await pay({ ...receiver, currency: "MMK" })).status, 201, "receiver in the exchange currency");
      const thb = await pay({ ...receiver, currency: " thb " });
      assert.equal(thb.status, 201, "receiver in the base currency");
      assert.equal(thb.data?.currency, "THB", "stored normalised");
      assert.equal((await pay({ ...carrier, currency: "THB" })).status, 201, "carrier in the base currency");
      for (const [body, why] of [
        [{ ...receiver, currency: "USD" }, "receiver in a third currency"],
        [{ ...receiver, currency: "MMKK" }, "receiver with a mistyped code"],
        [{ ...carrier, currency: "MMK" }, "carrier in the exchange currency (never converted)"],
        [{ ...carrier, currency: "USD" }, "carrier in the old form default"],
      ]) {
        const r = await pay(body);
        assert.equal(r.status, 400, `${why} must be refused, got ${r.status}`);
      }
    });
  } finally {
    await removeCargoFixture(sql);
    if (!before) {
      await sql`delete from shop_settings`;
    } else {
      await sql`update shop_settings set shop_name = ${before.shop_name}, customer_id_prefix = ${before.customer_id_prefix},
                  order_id_prefix = ${before.order_id_prefix}, cargo_id_prefix = ${before.cargo_id_prefix}`;
      if ("currency_code" in before) {
        await sql`update shop_settings set currency_code = ${before.currency_code}, currency_symbol = ${before.currency_symbol},
                    exchange_currency_code = ${before.exchange_currency_code}, exchange_currency_symbol = ${before.exchange_currency_symbol},
                    default_exchange_rate = ${before.default_exchange_rate}`;
      }
    }
    await sql.end();
  }
});
