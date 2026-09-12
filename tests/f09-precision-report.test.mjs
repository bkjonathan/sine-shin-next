// Guard for the F-09 precision report (scripts/f09-money-precision-report.mjs).
//
// F-09 (money stored as double precision) is not fixed yet. Before choosing
// numeric types and a rounding rule, the owner runs this read-only report
// against production. These tests check that it is right about the cases that
// decide the migration — values that need rounding, float noise that doesn't,
// NaN/Infinity that numeric can't hold, negatives, large magnitudes and the
// service-fee type split — and that it cannot write.
//
// Needs only a THROWAWAY database with migrations applied (no app server):
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f09-precision-report.test.mjs
// Seed rows are inserted and reported inside one transaction that is rolled back.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DB_URL, auditDb } from "./helpers/audit-session.mjs";
import { precisionReport, openReadOnly } from "../scripts/f09-money-precision-report.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skip = DB_URL ? false : "set AUDIT_DATABASE_URL (a throwaway database with migrations applied) to run";

const byColumn = (report) => Object.fromEntries(report.columns.map((c) => [c.column, c]));
const byType = (report) => Object.fromEntries(report.serviceFeeTypes.map((t) => [t.type, t]));
class Rollback extends Error {}

test("F-09 report: flags exactly the values a numeric migration would change or reject", { skip }, async () => {
  const sql = auditDb();
  try {
    await sql.begin(async (tx) => {
      const beforeReport = await precisionReport(tx);
      const before = byColumn(beforeReport);

      await tx`
        insert into orders (id, order_id, shipping_fee, delivery_fee, cargo_fee, service_fee, service_fee_type, exchange_rate, product_discount)
        values ('f09_o1', 'F09-00001', 10.005, 0.1::float8 + 0.2::float8, 'NaN', 5, 'percent', 1::float8 / 3, -2.5),
               ('f09_o2', 'F09-00002', 123456789012.34, 0, 0, 1500, 'fixed', 1, null)`;
      await tx`insert into order_items (id, order_id, price) values ('f09_i1', 'f09_o1', 'Infinity')`;

      const afterReport = await precisionReport(tx);
      const after = byColumn(afterReport);
      const delta = (col, field) => after[col][field] - before[col][field];

      assert.equal(delta("orders.shipping_fee", "rows"), 2);
      assert.equal(delta("orders.shipping_fee", "overScale"), 1, "10.005 needs rounding at 2dp");
      assert.ok(Number(after["orders.shipping_fee"].maxRoundChange) >= 0.005, "rounding 10.005 changes it by 0.005");
      assert.ok(after["orders.shipping_fee"].intDigits >= 12, "123456789012.34 needs 12 integer digits");
      assert.equal(delta("orders.delivery_fee", "overScale"), 0, "0.1 + 0.2 float noise is not a real third decimal");
      assert.equal(delta("orders.cargo_fee", "nonFinite"), 1, "NaN can't become numeric");
      assert.equal(delta("order_items.price", "nonFinite"), 1, "Infinity can't become numeric");
      assert.equal(delta("orders.product_discount", "negatives"), 1);
      assert.equal(delta("orders.product_discount", "nulls"), 1);
      assert.equal(delta("orders.exchange_rate", "overScale"), 1, "1/3 has more than 6 decimals");

      const typesBefore = byType(beforeReport);
      const typesAfter = byType(afterReport);
      const count = (types, t) => types[t]?.orders ?? 0;
      assert.equal(count(typesAfter, "percent") - count(typesBefore, "percent"), 1);
      assert.equal(count(typesAfter, "fixed") - count(typesBefore, "fixed"), 1);
      assert.ok(Number(typesAfter.fixed.max_value) >= 1500);

      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  } finally {
    await sql.end();
  }
});

test("F-09 report: its connection refuses writes", { skip }, async () => {
  await auditDb().end(); // validates the URL is a local audit* database first
  const ro = await openReadOnly(DB_URL);
  try {
    await assert.rejects(ro`update orders set note = note where false`, /read-only transaction/);
  } finally {
    await ro.end();
  }
});

test("F-09 report: the script runs end to end without printing credentials", { skip }, async () => {
  await auditDb().end();
  const r = spawnSync(process.execPath, ["scripts/f09-money-precision-report.mjs"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: DB_URL },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.equal(r.status, 0, `report failed:\n${r.stderr}`);
  assert.match(r.stdout, /F-09 precision report/);
  assert.match(r.stdout, /orders\.shipping_fee/);
  assert.ok(!r.stdout.includes(new URL(DB_URL).password), "the database password must not be printed");
});
