// Demonstration + guard for AUDIT.md finding F-10.
//
// F-10: revenue, profit and order totals were computed in about a dozen places
// with conflicting formulas — a percentage service fee added as money, items
// with no quantity counted as 0 in some places and 1 in others, "Shop" fees
// subtracted from the customer's total on one page and added to profit on
// another, and profit taken as one period's revenue minus ALL-TIME expenses.
//
// Definitions agreed with the owner (2026-09-11):
//   items subtotal = Σ price × quantity over non-deleted items (no quantity = 1, no price = 0)
//   service fee    = "percent"/"%": subtotal × fee / 100; otherwise the fee itself
//   order total    = subtotal + shipping + delivery + cargo + service fee.
//                    Every fee is charged, "Shop" and "Excluded" ones included. Revenue = Σ order total.
//   shop income    = service fee + purchase discount + each fee ticked "Shop"
//   profit         = Σ shop income − expenses dated in the same period
//   "Excluded" cargo only leaves the cargo statistics.
//
// Fix under test: src/lib/order-money.ts (TypeScript) and src/lib/order-money-sql.ts
// (SQL) implement these once, and every page, report and API uses them.
//
// The first two tests need nothing. The SQL test needs a THROWAWAY database; the
// live test also needs a server using it, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f10-order-money.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql, TransactionRollbackError } from "drizzle-orm";
import { BASE, DB_URL, liveReady, skipReason, auditDb, alignSchemaWithApp, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const near = (actual, expected, label) =>
  assert.ok(Math.abs(Number(actual) - expected) < 1e-6, `${label}: expected ${expected}, got ${actual}`);

const FEES = {
  shippingFee: 0, deliveryFee: 50, cargoFee: 0, serviceFee: 10, serviceFeeType: "percent", productDiscount: 30,
  shippingFeeByShop: false, deliveryFeeByShop: false, cargoFeeByShop: false, excludeCargoFee: false,
};

test("F-10: order money follows the agreed definitions", async () => {
  const { lineAmount, itemsSubtotal, orderMoney, summarizeOrders } = await import("../src/lib/order-money.ts");

  // The owner's worked example: items 1,000, 10% service fee, delivery 50, purchase discount 30.
  assert.deepEqual(orderMoney(FEES, 1000), { itemsSubtotal: 1000, serviceFeeAmount: 100, feesTotal: 150, orderTotal: 1150, shopIncome: 130 });
  // "Shop" on delivery: the customer still pays it, and the shop keeps it.
  const shopDelivery = orderMoney({ ...FEES, deliveryFeeByShop: true }, 1000);
  assert.equal(shopDelivery.orderTotal, 1150);
  assert.equal(shopDelivery.shopIncome, 180);
  // "Excluded" cargo is still charged, and still shop income when ticked "Shop".
  const excludedShopCargo = orderMoney({ ...FEES, cargoFee: 40, cargoFeeByShop: true, excludeCargoFee: true }, 1000);
  assert.equal(excludedShopCargo.orderTotal, 1190);
  assert.equal(excludedShopCargo.shopIncome, 170);
  // A fixed fee is used as-is; the legacy "%" label means percent; nulls count as 0.
  assert.equal(orderMoney({ ...FEES, serviceFeeType: "fixed", serviceFee: 25 }, 1000).serviceFeeAmount, 25);
  assert.equal(orderMoney({ ...FEES, serviceFeeType: "%" }, 1000).serviceFeeAmount, 100);
  assert.deepEqual(
    orderMoney({ ...FEES, deliveryFee: null, serviceFee: null, productDiscount: null }, 0),
    { itemsSubtotal: 0, serviceFeeAmount: 0, feesTotal: 0, orderTotal: 0, shopIncome: 0 }
  );

  // Items: no quantity counts as 1, no price as 0, deleted items are ignored.
  assert.equal(lineAmount(200, null), 200);
  assert.equal(lineAmount(null, 3), 0);
  assert.equal(
    itemsSubtotal([
      { price: 400, productQty: 2 },
      { price: 200, productQty: null },
      { price: 999, productQty: 1, deletedAt: "2099-01-01T00:00:00Z" },
      { price: null, productQty: 3 },
    ]),
    1000
  );

  // Profit subtracts the expenses of the same period, not all-time expenses.
  assert.deepEqual(summarizeOrders([orderMoney(FEES, 1000), shopDelivery], 75.5), {
    revenue: 2300, shopIncome: 310, expenses: 75.5, profit: 234.5,
  });
});

test("F-10: no page, report or API keeps its own money formula", () => {
  const LEGACY = [
    [/\+\s*\(?\s*[\w?.]*\.serviceFee\b(?!Amount|Type|Paid|Rate)/, "a raw service fee added as money (TypeScript)"],
    [/\+\s*COALESCE\(\s*\$\{orders\.serviceFee\}/i, "a raw service fee added as money (SQL)"],
    [/price,\s*0\)\s*\*\s*COALESCE\(oi\.product_qty,\s*0\)/i, "an item with no quantity counted as 0 (SQL)"],
    [/price \?\? 0\)\s*\*\s*\(?[\w?.]*productQty \?\? 0\)/, "an item with no quantity counted as 0 (TypeScript)"],
    [/feesTotal\s*-\s*shop/i, "\"Shop\" fees subtracted from the customer's total"],
  ];
  const skip = new Set(["src/lib/order-money.ts", "src/lib/order-money-sql.ts"]);
  const offenders = [];
  for (const rel of readdirSync(join(root, "src"), { recursive: true })) {
    const file = `src/${rel}`;
    if (!/\.(ts|tsx)$/.test(file) || skip.has(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const [pattern, why] of LEGACY) if (pattern.test(text)) offenders.push(`${file}: ${why}`);
  }
  assert.deepEqual(offenders, [], "formulas outside src/lib/order-money*.ts");

  const uses = (file, pattern, why) =>
    assert.match(readFileSync(join(root, file), "utf8"), pattern, `${file} ${why}`);
  uses("src/components/orders/order-detail-client.tsx", /orderMoney\(/, "must use orderMoney()");
  uses("src/utils/invoiceCalculations.ts", /orderMoney\(/, "must use orderMoney()");
  uses("src/utils/calculations.ts", /summarizeOrders\(/, "must use summarizeOrders() for dashboard revenue/profit");
  uses("src/hooks/useDashboardData.ts", /expensesTotal/, "must pass the period's expenses to the dashboard stats");
  uses("src/components/orders/order-table.tsx", /\.orderTotal\b/, "must show the order total from the API");
  uses("src/app/(dashboard)/orders/page.tsx", /\.orderTotal\b/, "must export and show the order total from the API");
});

// One fixture drives both the database rows and the expected values.
const ORDERS = [
  { id: "f10_o1", orderId: "F10-00001", orderDate: "2099-01-15", status: "completed", customer: true, orderFrom: "F10-Shop",
    fees: { ...FEES, shippingFee: 20, shippingFeeByShop: true, cargoFee: 40, cargoFeeByShop: true, excludeCargoFee: true },
    items: [{ price: 400, productQty: 2 }, { price: 200, productQty: null }, { price: 999, productQty: 1, deleted: true }, { price: null, productQty: 3 }] },
  { id: "f10_o2", orderId: "F10-00002", orderDate: "2099-02-10", status: "completed", customer: true, orderFrom: null,
    fees: { ...FEES, deliveryFee: 10, deliveryFeeByShop: true, serviceFee: 25, serviceFeeType: "fixed", productDiscount: null },
    items: [{ price: 150.5, productQty: 2 }] },
  { id: "f10_o3", orderId: "F10-00003", orderDate: "2099-01-20", status: "pending", customer: false, orderFrom: null,
    fees: { ...FEES, deliveryFee: 0, serviceFee: 5, serviceFeeType: "%", productDiscount: 0 },
    items: [{ price: 100, productQty: 1 }] },
  { id: "f10_o4", orderId: "F10-00004", orderDate: "2099-01-10", status: "completed", customer: true, orderFrom: null, deleted: true,
    fees: { ...FEES, shippingFee: 500 }, items: [{ price: 1000, productQty: 1 }] },
  { id: "f10_o5", orderId: "F10-00005", orderDate: "2098-12-31", status: "completed", customer: false, orderFrom: null,
    fees: { ...FEES, deliveryFee: 0, serviceFee: 0, productDiscount: 0 }, items: [{ price: 777, productQty: 1 }] },
];
const EXPENSES = [
  { id: "f10_e1", date: "2099-01-20", amount: 70 },
  { id: "f10_e2", date: "2099-02-01", amount: 5.5 },
  { id: "f10_e3", date: "2098-12-31", amount: 999 },
  { id: "f10_e4", date: "2099-01-05", amount: 1000, deleted: true },
];
const CUSTOMER_ID = "f10_c1";

async function seedFixture(run) {
  await run(sql`insert into customers (id, customer_id, name) values (${CUSTOMER_ID}, ${"F10C-00001"}, ${"F10 Customer"})`);
  for (const o of ORDERS) {
    const f = o.fees;
    await run(sql`
      insert into orders (id, order_id, customer_id, status, order_from, order_date, shipping_fee, delivery_fee, cargo_fee,
                          service_fee, service_fee_type, product_discount, shipping_fee_by_shop, delivery_fee_by_shop,
                          cargo_fee_by_shop, exclude_cargo_fee, deleted_at)
      values (${o.id}, ${o.orderId}, ${o.customer ? CUSTOMER_ID : null}, ${o.status}, ${o.orderFrom}, ${o.orderDate},
              ${f.shippingFee}, ${f.deliveryFee}, ${f.cargoFee}, ${f.serviceFee}, ${f.serviceFeeType}, ${f.productDiscount},
              ${f.shippingFeeByShop}, ${f.deliveryFeeByShop}, ${f.cargoFeeByShop}, ${f.excludeCargoFee},
              ${o.deleted ? sql`now()` : null})`);
    for (const [i, it] of o.items.entries()) {
      await run(sql`
        insert into order_items (id, order_id, price, product_qty, deleted_at)
        values (${`${o.id}_i${i}`}, ${o.id}, ${it.price}, ${it.productQty}, ${it.deleted ? sql`now()` : null})`);
    }
  }
}

async function removeFixture(run) {
  await run(sql`delete from order_items where order_id like 'f10_o%'`);
  await run(sql`delete from orders where id like 'f10_o%'`);
  await run(sql`delete from expenses where id like 'f10_e%'`);
  await run(sql`delete from customers where id = ${CUSTOMER_ID}`);
}

test("F-10: the SQL formulas agree with the TypeScript ones", { skip: DB_URL ? false : "set AUDIT_DATABASE_URL to run" }, async () => {
  const { itemsSubtotalSql, serviceFeeAmountSql, orderTotalSql, shopIncomeSql } = await import("../src/lib/order-money-sql.ts");
  const { itemsSubtotal, orderMoney } = await import("../src/lib/order-money.ts");
  const client = auditDb();
  const db = drizzle(client);
  try {
    await db.transaction(async (tx) => {
      const run = (q) => tx.execute(q);
      await removeFixture(run);
      await seedFixture(run);
      const rows = await tx.execute(sql`
        select orders.id, ${itemsSubtotalSql} as items_subtotal, ${serviceFeeAmountSql} as service_fee_amount,
               ${orderTotalSql} as order_total, ${shopIncomeSql} as shop_income
        from orders where orders.id like 'f10_o%' order by orders.id`);
      assert.equal(rows.length, ORDERS.length);
      for (const row of rows) {
        const o = ORDERS.find((x) => x.id === row.id);
        const expected = orderMoney(o.fees, itemsSubtotal(o.items.map((it) => ({ ...it, deletedAt: it.deleted ? "x" : null }))));
        near(row.items_subtotal, expected.itemsSubtotal, `${o.id} items subtotal`);
        near(row.service_fee_amount, expected.serviceFeeAmount, `${o.id} service fee`);
        near(row.order_total, expected.orderTotal, `${o.id} order total`);
        near(row.shop_income, expected.shopIncome, `${o.id} shop income`);
      }
      tx.rollback();
    });
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err;
  } finally {
    await client.end();
  }
});

test("F-10: dashboard, reports, order list and customer page use the definitions", { skip: liveReady ? false : skipReason }, async (t) => {
  const { orderMoney, summarizeOrders } = await import("../src/lib/order-money.ts");
  const client = auditDb();
  const db = drizzle(client);
  const run = (q) => db.execute(q);
  t.after(async () => {
    await removeFixture(run);
    await client.end();
  });
  await alignSchemaWithApp(client);
  await seedRoleUsers(client);
  await removeFixture(run);
  await seedFixture(run);
  for (const e of EXPENSES) {
    await run(sql`insert into expenses (id, amount, title, expense_date, deleted_at)
                  values (${e.id}, ${e.amount}, ${"F10 expense"}, ${e.date}, ${e.deleted ? sql`now()` : null})`);
  }
  const owner = await cookieFor("owner");
  const get = async (path) => {
    const res = await fetch(BASE + path, { headers: { cookie: owner }, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    const body = await res.text();
    assert.equal(res.status, 200, `GET ${path}: ${res.status} ${body.slice(0, 200)}`);
    return body;
  };
  const range = "dateFrom=2099-01-01&dateTo=2099-02-28";

  // Hand-checked against the definitions: in range are o1 (1,210 / 190), o2 (336 / 35), o3 (105 / 5);
  // expenses in range 70 + 5.5. o4 is deleted, o5 and the 999 expense fall outside the range.
  const REVENUE = 1651;
  const INCOME = 230;
  const EXPENSES_IN_RANGE = 75.5;
  const PROFIT = 154.5;

  await t.test("reports", async () => {
    const { data } = JSON.parse(await get(`/api/reports?${range}`));
    near(data.kpi.totalRevenue, REVENUE, "reports revenue");
    near(data.kpi.totalExpenses, EXPENSES_IN_RANGE, "reports expenses");
    near(data.kpi.totalProfit, PROFIT, "reports profit");
    near(data.kpi.avgOrderValue, REVENUE / 3, "reports average order value");
    const month = (m) => data.monthlyRevenue.find((r) => r.month === m);
    near(month("2099-01").revenue, 1315, "January revenue");
    near(month("2099-01").profit, 195 - 70, "January profit");
    near(month("2099-02").revenue, 336, "February revenue");
    near(month("2099-02").profit, 35 - 5.5, "February profit");
    near(data.topCustomers.find((c) => c.customerId === "F10C-00001").totalRevenue, 1546, "top customer revenue");
    near(data.ordersByPlatform.find((p) => p.platform === "F10-Shop").revenue, 1210, "platform revenue");
  });

  await t.test("dashboard orders + stats", async () => {
    const body = JSON.parse(await get(`/api/dashboard/orders?${range}&dateField=order_date`));
    const rows = body.data.filter((r) => r.id.startsWith("f10_o"));
    assert.deepEqual(rows.map((r) => r.id).sort(), ["f10_o1", "f10_o2", "f10_o3"]);
    near(rows.find((r) => r.id === "f10_o1").totalPrice, 1000, "o1 items subtotal (no quantity = 1)");
    near(body.meta?.expensesTotal, EXPENSES_IN_RANGE, "dashboard period expenses");
    const summary = summarizeOrders(rows.map((r) => orderMoney(r, r.totalPrice)), body.meta.expensesTotal);
    near(summary.revenue, REVENUE, "dashboard revenue");
    near(summary.profit, PROFIT, "dashboard profit");
  });

  await t.test("dashboard financial API", async () => {
    const { data } = JSON.parse(await get(`/api/dashboard?${range}&dateField=orderDate`));
    near(data.financial.totalRevenue, REVENUE, "revenue");
    near(data.financial.netRevenue, INCOME, "shop income");
    near(data.financial.totalProfit, PROFIT, "profit");
    near(data.recentActivity.find((r) => r.id === "f10_o1").total, 1210, "recent activity total");
  });

  await t.test("order list", async () => {
    const { data } = JSON.parse(await get(`/api/orders?search=F10-&searchField=orderId&limit=100`));
    const total = (id) => data.find((r) => r.id === id)?.orderTotal;
    near(total("f10_o1"), 1210, "o1 order total");
    near(total("f10_o2"), 336, "o2 order total");
    near(total("f10_o5"), 777, "o5 order total");
  });

  await t.test("account", async () => {
    const { data } = JSON.parse(await get(`/api/account`));
    near(data.orders.find((r) => r.id === "f10_o1").totalPrice, 1000, "o1 items subtotal (no quantity = 1)");
  });

  await t.test("customer page", async () => {
    // Amounts only: they are shown with the shop's currency symbol (F-11), not a fixed "$".
    const html = await get(`/customers/${CUSTOMER_ID}`);
    assert.match(html, /Total Spent<\/p><p[^>]*>[^<>\d]* 1,546</, "total spent = completed orders' totals (1,210 + 336)");
    assert.match(html, />[^<>\d]* 1,210</, "o1 listed at its order total");
    assert.match(html, />[^<>\d]* 336</, "o2 listed at its order total");
  });
});
