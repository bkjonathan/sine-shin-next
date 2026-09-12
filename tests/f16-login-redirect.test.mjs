// Demonstration + guard for AUDIT.md finding F-16.
//
// F-16: the login page reads `callbackUrl` from the query string and passes it
// to router.push after sign-in. An absolute or protocol-relative URL is an
// external navigation, so /login?callbackUrl=https://evil.example/ sends a
// freshly signed-in user to a look-alike site.
//
// Fix under test: safeRedirectPath() (src/lib/utils.ts) returns the value only
// if it is a relative path that resolves to the same origin — using the same
// URL parser as the browser, so "//", "/\" and control-character tricks can't
// slip through — and the login page redirects only through it.
//
// Run: node --test tests/f16-login-redirect.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://shop.example";

test("F-16: safeRedirectPath only allows same-origin paths", async () => {
  const { safeRedirectPath } = await import("../src/lib/utils.ts");

  // Allowed: relative same-origin paths, normalised to path + query + hash.
  assert.equal(safeRedirectPath("/dashboard", ORIGIN), "/dashboard");
  assert.equal(safeRedirectPath("/orders/abc?tab=items#top", ORIGIN), "/orders/abc?tab=items#top");

  // Refused: fall back to /dashboard.
  for (const hostile of [
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    " //evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeRedirectPath(hostile, ORIGIN), "/dashboard", `should refuse ${JSON.stringify(hostile)}`);
  }
});

test("F-16: the login page redirects only through safeRedirectPath", () => {
  const src = readFileSync(join(here, "..", "src/app/(auth)/login/page.tsx"), "utf8");
  assert.match(src, /router\.push\(\s*safeRedirectPath\(/, "router.push must go through safeRedirectPath()");
  assert.doesNotMatch(src, /router\.push\(\s*callbackUrl\s*\)/, "raw callbackUrl must not reach router.push");
});
