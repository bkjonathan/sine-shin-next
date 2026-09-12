// Demonstration + guard for AUDIT.md finding F-28.
//
// F-28: the orders, customers and expenses pages built their CSV export by
// wrapping each value in quotes without doubling quotes inside it, and a value
// starting with =, +, -, @, tab or carriage return was left as is, so a customer
// name could run as a spreadsheet formula when the file was opened. (The audit's
// note about the exported order total was fixed under F-10.)
//
// Fix under test: toCsv() in src/lib/utils.ts doubles quotes and prefixes a
// formula-like cell with ', leaving plain numbers alone; the three pages use it.
// Needs nothing: node --test tests/f28-csv-export.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("F-28: CSV cells are quoted, quotes doubled, and formula starts neutralised", async () => {
  const { toCsv } = await import("../src/lib/utils.ts");
  assert.equal(toCsv([["Name", "Total"], ['Say "hi"', "12.5"]]), '"Name","Total"\n"Say ""hi""","12.5"');
  assert.equal(toCsv([["a,b\nc", null, undefined, 7]]), '"a,b\nc","","","7"');

  for (const formula of ['=HYPERLINK("http://evil.example","open")', "+1+1", "-2+3", "@SUM(A1:A2)", "\tcmd", "\rcmd"]) {
    const cell = toCsv([[formula]]);
    assert.ok(cell.startsWith(`"'`), `${JSON.stringify(formula)} was exported as ${cell}`);
  }
  // Plain numbers, negatives included, stay numbers.
  assert.equal(toCsv([["-5", "3.25", "-0.5", "0"]]), '"-5","3.25","-0.5","0"');
});

test("F-28: the orders, customers and expenses exports use toCsv", () => {
  for (const page of ["orders", "customers", "expenses"]) {
    const src = read(`src/app/(dashboard)/${page}/page.tsx`);
    assert.match(src, /toCsv\(/, `${page} export doesn't use toCsv`);
    assert.doesNotMatch(src, /`"\$\{v\}"`/, `${page} export still quotes values by hand`);
  }
});
