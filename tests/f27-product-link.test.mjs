// Demonstration + guard for AUDIT.md finding F-27.
//
// F-27: the order items table rendered any stored product link as <a href>. React
// 19 refuses javascript: links, but data: and other schemes still became links.
//
// Decision already agreed under F-15 (2026-09-12): a product link may be any text
// up to 2,000 characters, because staff paste share text and app links. So the
// schema is unchanged; instead the table makes a link only of http and https
// addresses and shows anything else as plain text.
//
// Fix under test: safeHref() in src/lib/utils.ts, used by order-items-section.tsx.
// Needs nothing: node --test tests/f27-product-link.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

function tsxFiles(dir = "src") {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []
  );
}

test("F-27: only http and https addresses become links", async () => {
  const { safeHref } = await import("../src/lib/utils.ts");
  for (const link of ["https://shopee.co.th/product/1", "http://example.com/a?b=1", "HTTPS://EXAMPLE.COM/x"]) {
    assert.ok(safeHref(link)?.startsWith("http"), `${link} should be a link`);
  }
  for (const text of [
    "javascript:alert(1)",
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example/x",
    "shopee.co.th/product/1",
    "Check out this product https://shopee.co.th/product/1",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeHref(text), null, `${JSON.stringify(text)} must not become a link`);
  }
});

test("F-27: a stored product link reaches an href only through safeHref", () => {
  const section = read("src/components/orders/order-items-section.tsx");
  assert.doesNotMatch(section, /href=\{item\.productUrl\}/);
  assert.match(section, /safeHref\(item\.productUrl\)/);
  const direct = tsxFiles().filter((file) => /href=\{[^}]*productUrl[^}]*\}/.test(read(file)) && !/safeHref/.test(read(file)));
  assert.deepEqual(direct, [], "these components put productUrl into an href directly");
});
