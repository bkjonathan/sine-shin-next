// Demonstration + guard for AUDIT.md finding F-05.
//
// F-05: the Print-label buttons in customer-table.tsx and order-table.tsx open
// a same-origin about:blank popup and win.document.write() an HTML string with
// customer/order values interpolated raw. React's escaping doesn't apply there,
// so a customer named  <img src=x onerror="...">  runs script with the session
// of whoever prints the label (e.g. an owner), which can call owner-only APIs.
//
// Two checks:
//   1. escapeHtml() (src/lib/utils.ts) neutralises every HTML-significant char.
//   2. Every ${...} in each document.write template is either escapeHtml(...)
//      or a conditional that opens a nested template (whose own ${...} are
//      checked too) and falls back to "". Fails today; keeps a future label
//      field honest.
//
// Run: node --test tests/f05-print-label-xss.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const FILES = [
  "src/components/customers/customer-table.tsx",
  "src/components/orders/order-table.tsx",
];

const PAYLOAD = `<img src=x onerror="fetch('/api/users',{method:'POST'})">`;

test("F-05: escapeHtml neutralises HTML-significant characters", async () => {
  const { escapeHtml } = await import("../src/lib/utils.ts");

  assert.equal(escapeHtml(`& < > " '`), "&amp; &lt; &gt; &quot; &#39;");
  // & must be escaped first, so text that looks like an entity stays literal.
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  assert.equal(escapeHtml(1234), "1234");
  assert.equal(escapeHtml("Ko Aung (Yangon)"), "Ko Aung (Yangon)");

  const out = escapeHtml(PAYLOAD);
  assert.ok(!/[<>"']/.test(out), `payload still contains markup characters: ${out}`);
});

function writeTemplate(src, rel) {
  const open = "win.document.write(`";
  const start = src.indexOf(open);
  assert.notEqual(start, -1, `${rel}: expected a win.document.write(\` template`);
  const end = src.indexOf("`);", start);
  assert.notEqual(end, -1, `${rel}: could not find the end of the document.write template`);
  return src.slice(start + open.length, end);
}

test("F-05: print-label templates escape every interpolated value", async (t) => {
  for (const rel of FILES) {
    await t.test(rel, () => {
      const tpl = writeTemplate(readFileSync(join(here, "..", rel), "utf8"), rel);

      const unescaped = [];
      for (const m of tpl.matchAll(/\$\{/g)) {
        const head = tpl.slice(m.index + 2, m.index + 2 + 80);
        const escaped = /^\s*escapeHtml\(/.test(head);
        const conditional = /^[^`}]*\?\s*`/.test(head);
        if (!escaped && !conditional) unescaped.push("${" + head.split("}")[0] + "}");
      }
      assert.deepEqual(unescaped, [], `${rel}: raw values interpolated into print HTML`);

      // A conditional's else-branch must not smuggle in a raw value.
      for (const m of tpl.matchAll(/`\s*:\s*([^}]*)\}/g)) {
        assert.equal(m[1].trim(), '""', `${rel}: conditional else-branch must be "" (got ${m[1].trim()})`);
      }
    });
  }
});
