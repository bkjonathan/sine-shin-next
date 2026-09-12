// Demonstration + guard for AUDIT.md finding F-23.
//
// F-23: the public tracking page (/t/<code>) closed only once a shipment was
// delivered, so a cancelled shipment kept showing the consignee's name, phone and
// address for as long as its sticker existed. It also sent the whole
// shop_settings row (ID prefixes, currencies, the default exchange rate) to
// anonymous visitors, and staff weren't told the item note is public.
//
// Decision agreed with the owner (2026-09-12): the page closes when a shipment is
// delivered or cancelled; there is no time limit after arrival.
//
// Fix under test:
//   - isTrackingClosed() is true for delivered and cancelled
//   - the page loads only the shop's name and logo for its components
//   - the note field tells staff that anyone who scans the label sees the note
//   - public-code.ts states the alphabet size correctly (31 characters)
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f23-public-tracking.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BASE, liveReady, skipReason, auditDb } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("F-23: the page closes for delivered and cancelled shipments only", async () => {
  const { isTrackingClosed } = await import("../src/components/cargo/public-tracking-status.ts");
  assert.deepEqual(["pending", "in_transit", "arrived", "delivered", "cancelled"].filter(isTrackingClosed), ["delivered", "cancelled"]);
});

test("F-23: the page loads only the shop fields it shows, and staff are told the note is public", () => {
  const page = read("src/app/t/[code]/page.tsx");
  assert.doesNotMatch(page, /select\(\)\s*\.from\(shopSettings\)/, "the page selects the whole shop_settings row");
  assert.match(page, /shopName: shopSettings\.shopName/);
  assert.match(page, /logoUrl: shopSettings\.logoUrl/);

  const itemsSection = read("src/components/cargo/cargo-items-section.tsx");
  assert.doesNotMatch(itemsSection, /shown on the customer label"/, "the note placeholder doesn't say who can see the note");
  assert.match(itemsSection, /anyone who scans/);

  const publicCode = read("src/lib/public-code.ts");
  const alphabet = /ALPHABET = "([^"]+)"/.exec(publicCode)[1];
  assert.match(publicCode, new RegExp(`${alphabet.length}-character alphabet`), `the comment should state the ${alphabet.length}-character alphabet`);
});

test("F-23: a cancelled shipment's page shows no consignee details, and no page sends shop settings", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  // Remove this run's rows afterwards: F-13 skips one of its checks while any shipment exists.
  t.after(async () => {
    await sql`delete from cargo_items where cargo_shipment_id in (${openShipment}, ${cancelledShipment})`;
    await sql`delete from cargo_shipments where id in (${openShipment}, ${cancelledShipment})`;
    await sql`delete from customers where id = ${customer}`;
    await sql.end();
  });
  const run = randomBytes(4).toString("hex");
  const phone = `+95-f23-${run}`;
  const address = `F23 street ${run}`;
  const customer = `f23c${run}`;
  const openShipment = `f23o${run}`;
  const cancelledShipment = `f23x${run}`;
  const openCode = `F23O${run.toUpperCase()}`;
  const cancelledCode = `F23X${run.toUpperCase()}`;

  // With no settings row there would be nothing for the page to leak.
  await sql`insert into shop_settings (id, shop_name) values ('singleton', 'F23 Shop') on conflict (id) do nothing`;
  await sql`insert into customers (id, customer_id, name, phone, address) values (${customer}, ${`F23C-${run}`}, ${`F23 Consignee ${run}`}, ${phone}, ${address})`;
  await sql`insert into cargo_shipments (id, cargo_no, status) values
    (${openShipment}, ${`F23-O-${run}`}, 'in_transit'), (${cancelledShipment}, ${`F23-X-${run}`}, 'cancelled')`;
  await sql`insert into cargo_items (id, cargo_shipment_id, customer_id, weight_kg, carrier_rate_per_kg, receiver_rate_per_kg, public_code, note) values
    (${`${openShipment}i`}, ${openShipment}, ${customer}, 1, 1, 1, ${openCode}, 'F23 note'),
    (${`${cancelledShipment}i`}, ${cancelledShipment}, ${customer}, 1, 1, 1, ${cancelledCode}, 'F23 note')`;

  const page = async (code) => {
    const res = await fetch(`${BASE}/t/${code}`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    return { status: res.status, html: await res.text() };
  };

  await t.test("control: an in-transit shipment's page shows its consignee", async () => {
    const r = await page(openCode);
    assert.equal(r.status, 200);
    assert.ok(r.html.includes(phone), "the consignee's phone should be on an open page");
  });

  await t.test("a cancelled shipment's page is closed and carries no consignee details", async () => {
    const r = await page(cancelledCode);
    assert.equal(r.status, 200);
    assert.ok(!r.html.includes(phone), "the consignee's phone was sent for a cancelled shipment");
    assert.ok(!r.html.includes(address), "the consignee's address was sent for a cancelled shipment");
    assert.match(r.html, /This shipment was cancelled/);
  });

  await t.test("neither page sends shop settings beyond the name and logo", async () => {
    for (const code of [openCode, cancelledCode]) {
      const { html } = await page(code);
      for (const key of ["customerIdPrefix", "orderIdPrefix", "cargoIdPrefix", "defaultExchangeRate", "currencyCode"]) {
        assert.ok(!html.includes(key), `/t/${code} sent the shop's ${key}`);
      }
    }
  });
});
