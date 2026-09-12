// Demonstration + guard for AUDIT.md finding F-17.
//
// F-17: the app sets no security response headers (only /sw.js has headers)
// and advertises `X-Powered-By: Next.js`. The admin UI can be framed
// (clickjacking) and browsers aren't told to stay on HTTPS or not sniff types.
//
// Fix under test: next.config.ts sends HSTS, X-Content-Type-Options, Referrer-
// Policy and X-Frame-Options on every route, and disables X-Powered-By. The
// /sw.js headers must survive.
//
// Needs a running server built from this tree:
//   AUDIT_BASE_URL=http://localhost:<port> node --test tests/f17-security-headers.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { BASE } from "./helpers/audit-session.mjs";

const EXPECTED = {
  "strict-transport-security": /^max-age=31536000$/,
  "x-content-type-options": /^nosniff$/,
  "referrer-policy": /^strict-origin-when-cross-origin$/,
  "x-frame-options": /^DENY$/,
};

async function head(path) {
  const res = await fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
  await res.text().catch(() => {});
  return res;
}

test("F-17: security headers on pages, API routes and the service worker", { skip: BASE ? false : "set AUDIT_BASE_URL to run" }, async (t) => {
  // A static page, an API route, a proxy redirect, and the service worker.
  for (const path of ["/login", "/api/auth/session", "/dashboard", "/sw.js"]) {
    await t.test(path, async () => {
      const res = await head(path);
      for (const [name, pattern] of Object.entries(EXPECTED)) {
        assert.match(res.headers.get(name) ?? "(missing)", pattern, `${path}: ${name}`);
      }
      assert.equal(res.headers.get("x-powered-by"), null, `${path}: X-Powered-By must not be sent`);
    });
  }

  await t.test("/sw.js keeps its own headers", async () => {
    const res = await head("/sw.js");
    assert.match(res.headers.get("cache-control") ?? "", /no-cache, no-store, must-revalidate/);
    assert.match(res.headers.get("content-type") ?? "", /application\/javascript/);
  });
});
