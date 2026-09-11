// Regression guard for AUDIT.md finding F-01.
//
// F-01: next 16.2.1 sits inside the published vulnerable ranges for four
// middleware / proxy-bypass advisories. This app's three server-rendered
// detail pages (/orders/[id], /customers/[id], /cargo/[id]) rely on
// middleware.ts alone for authentication, which is exactly the class of app
// those advisories affect.
//
// Highest "fixed in" among the four middleware-bypass advisories:
//   CVE-2026-44575 (GHSA-267c-6grr-h53f)  fixed 16.2.5
//   CVE-2026-44574 (GHSA-492v-c6pp-mqqv)  fixed 16.2.5
//   CVE-2026-45109 (GHSA-26hh-7cqf-hhc6)  fixed 16.2.6
//   "single locale" proxy bypass          fixed 16.2.11
// So any next < 16.2.11 is in scope. We pin the guard to the chosen fix, 16.2.12.
//
// Run: node --test tests/
//
// Test A (version guard) needs nothing but node_modules and fails on 16.2.1.
// Test B (runtime guard) only runs when AUDIT_BASE_URL points at a running
// server; it documents that middleware must redirect the RSC / segment-prefetch
// URL variants an attacker would try. It passes on 16.2.1 today (no reproducible
// bypass on this app) and must keep passing after the upgrade.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MIN_SAFE = [16, 2, 12]; // first release we consider free of the F-01 advisories

function parseVersion(v) {
  const [core] = v.split("-"); // drop any prerelease tag
  return core.split(".").map((n) => parseInt(n, 10));
}

// Returns true when a >= b, comparing [major, minor, patch].
function gte(a, b) {
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return true;
}

test("F-01: installed next is at or above the patched release", () => {
  const pkgPath = join(here, "..", "node_modules", "next", "package.json");
  const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
  const parsed = parseVersion(version);
  assert.ok(
    gte(parsed, MIN_SAFE),
    `next ${version} is inside the F-01 middleware-bypass range; need >= ${MIN_SAFE.join(".")}`
  );
});

const BASE = process.env.AUDIT_BASE_URL;

// The unauthenticated request forms an attacker would send to try to slip a
// dynamic detail page past middleware. Each must redirect to /login.
const ATTACK_REQUESTS = [
  { name: "plain nav", path: "/orders/testid123", headers: {} },
  { name: ".rsc variant", path: "/orders/testid123.rsc", headers: { RSC: "1" } },
  {
    name: "header prefetch",
    path: "/orders/testid123",
    headers: { RSC: "1", "Next-Router-Prefetch": "1", "Next-Router-Segment-Prefetch": "/__PAGE__" },
  },
  { name: "segment url", path: "/orders/testid123.segments/__PAGE__.segment.rsc", headers: {} },
];

test("F-01: middleware redirects unauthenticated RSC/segment variants", { skip: BASE ? false : "set AUDIT_BASE_URL to run" }, async (t) => {
  for (const req of ATTACK_REQUESTS) {
    await t.test(req.name, async () => {
      const res = await fetch(BASE + req.path, { headers: req.headers, redirect: "manual" });
      const location = res.headers.get("location") ?? "";
      assert.equal(res.status, 307, `${req.name}: expected 307, got ${res.status}`);
      assert.match(location, /^\/login/, `${req.name}: expected redirect to /login, got "${location}"`);
    });
  }
});
