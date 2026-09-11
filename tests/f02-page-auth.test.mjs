// Structural guard for AUDIT.md finding F-02.
//
// F-02: the three server-rendered detail pages
//   /orders/[id]  /customers/[id]  /cargo/[id]
// read the database and hand the data to the client. Today their only auth is
// ambient — middleware.ts plus the (dashboard) layout's auth() redirect. Both
// catch a direct request, but Next.js guidance is to enforce auth close to the
// data (node_modules/next/dist/docs/01-app/02-guides/authentication.md): a
// layout check is skipped on client-side soft navigation (partial rendering),
// and a matcher/route refactor can silently drop middleware coverage.
//
// This is defense-in-depth, so it can't be shown by a black-box request while
// the layout still redirects. Instead we assert the property directly: each
// page must call requireSession() BEFORE it touches the database. Fails today
// (no such call); passes once the guard is added; and it keeps a future fourth
// page honest.
//
// Run: node --test tests/f02-page-auth.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const PAGES = [
  "src/app/(dashboard)/orders/[id]/page.tsx",
  "src/app/(dashboard)/customers/[id]/page.tsx",
  "src/app/(dashboard)/cargo/[id]/page.tsx",
];

test("F-02: detail pages gate with requireSession() before any DB access", async (t) => {
  for (const rel of PAGES) {
    await t.test(rel, () => {
      const src = readFileSync(join(here, "..", rel), "utf8");

      // The auth gate: a call to requireSession( . The import line reads
      // "{ requireSession }" (no paren), so this only matches the call site.
      const gateIndex = src.indexOf("requireSession(");
      // The first database query in these pages is always "await db".
      const firstQueryIndex = src.indexOf("await db");

      assert.notEqual(
        gateIndex,
        -1,
        `${rel}: no requireSession() call — page does not enforce auth of its own`
      );
      assert.notEqual(firstQueryIndex, -1, `${rel}: expected an "await db" query to guard`);
      assert.ok(
        gateIndex < firstQueryIndex,
        `${rel}: requireSession() must run before the first DB query ` +
          `(gate at ${gateIndex}, query at ${firstQueryIndex})`
      );
    });
  }
});
