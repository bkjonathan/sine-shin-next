// Demonstration + guard for AUDIT.md finding F-26.
//
// F-26: list endpoints read page and limit with Number(), and search terms went
// into ILIKE patterns unescaped. Checked against this code (drizzle-orm 0.45),
// the effects differ from the audit's description:
//   - ?limit=abc gives a NaN limit, which drizzle leaves out, so every matching
//     row comes back and the 100-row cap is gone; ?page=abc silently shows page 1
//   - ?page=1e308 (an infinite offset) and ?limit=2.5 return 500
//   - % and _ in a search act as wildcards
//   - the username-taken checks used ILIKE with the new name as the pattern, so
//     "a_b" clashed with an existing "axb"
//
// Fix under test: intParam() and containsPattern() in src/lib/query.ts; the six
// list endpoints use them, and the username checks compare lower-cased names.
//
// The first two tests need nothing. The live test needs a server started against
// a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f26-query-parsing.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, upsertUser, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const LIST_ROUTES = ["orders", "customers", "expenses", "cargo-shipments", "users", "audit-log"].map((r) => `src/app/api/${r}/route.ts`);

function routeFiles(dir = "src/app/api") {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : []
  );
}

test("F-26: page and limit become whole numbers within bounds; search terms match literally", async () => {
  const { intParam, containsPattern } = await import("../src/lib/query.ts");
  assert.equal(intParam(null, 20, 1, 100), 20);
  assert.equal(intParam("", 20, 1, 100), 20);
  assert.equal(intParam("abc", 20, 1, 100), 20);
  assert.equal(intParam("Infinity", 20, 1, 100), 20);
  assert.equal(intParam("50", 20, 1, 100), 50);
  assert.equal(intParam("2.5", 20, 1, 100), 2);
  assert.equal(intParam("-5", 20, 1, 100), 1);
  assert.equal(intParam("1e308", 1, 1, 1_000_000), 1_000_000);

  assert.equal(containsPattern("plain"), "%plain%");
  assert.equal(containsPattern("50%off"), "%50\\%off%");
  assert.equal(containsPattern("a_b"), "%a\\_b%");
  assert.equal(containsPattern("c:\\x"), "%c:\\\\x%");
});

test("F-26: list routes parse with intParam, escape searches, and don't match usernames by pattern", () => {
  for (const file of LIST_ROUTES) {
    const src = read(file);
    assert.doesNotMatch(src, /Number\(searchParams\.get\("(page|limit)"\)/, `${file} reads page/limit with Number()`);
    assert.match(src, /intParam\(searchParams\.get\("page"\)/, `${file} doesn't use intParam for page`);
  }
  const unescaped = routeFiles().filter((file) => /`%\$\{/.test(read(file)));
  assert.deepEqual(unescaped, [], "these routes build a LIKE pattern from raw input");
  for (const file of ["src/app/api/users/route.ts", "src/app/api/users/[id]/route.ts"]) {
    assert.doesNotMatch(read(file), /ilike\(users\.username, parsed\.data\.username\)/, `${file} matches the new username as a pattern`);
  }
});

test("F-26: odd page and limit values, wildcards and look-alike usernames behave", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  t.after(() => sql.end());
  await seedRoleUsers(sql);
  const owner = await cookieFor("owner");
  const run = randomBytes(4).toString("hex");
  const tag = `f26 ${run}`;

  // More matching customers than one page of 20 holds, plus look-alike names.
  const names = [...Array.from({ length: 25 }, (_, i) => `${tag} n${i}`), `${tag} 50%off`, `${tag} 50xoff`, `${tag} a_b`, `${tag} aXb`];
  const rows = names.map((name, i) => ({ id: `f26${run}${i}`, customer_id: `F26-${run}-${i}`, name }));
  await sql`insert into customers ${sql(rows, "id", "customer_id", "name")}`;

  const get = async (path) => {
    const res = await fetch(BASE + path, { headers: { cookie: owner }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text };
  };
  const search = (term) => get(`/api/customers?search=${encodeURIComponent(term)}&limit=100`);

  await t.test("a limit that isn't a number keeps the normal page size", async () => {
    const r = await get(`/api/customers?search=${encodeURIComponent(tag)}&limit=abc`);
    assert.equal(r.status, 200);
    assert.equal(r.json.meta.limit, 20, `meta.limit was ${r.json.meta.limit}`);
    assert.equal(r.json.data.length, 20, `?limit=abc returned ${r.json.data.length} of ${names.length} matching rows`);
  });

  await t.test("page and limit values out of range or with decimals don't cause a 500", async () => {
    for (const route of ["orders", "customers", "expenses", "cargo-shipments", "users", "audit-log"]) {
      for (const query of ["page=abc", "page=1e308", "page=-3", "limit=2.5", "limit=abc", "limit=100000"]) {
        const r = await get(`/api/${route}?${query}`);
        assert.equal(r.status, 200, `/api/${route}?${query}: got ${r.status} ${r.text.slice(0, 120)}`);
        assert.ok(Number.isInteger(r.json.meta.page) && Number.isInteger(r.json.meta.limit), `/api/${route}?${query}: meta ${JSON.stringify(r.json.meta)}`);
        assert.ok(r.json.meta.limit <= 100, `/api/${route}?${query}: limit ${r.json.meta.limit}`);
      }
    }
  });

  await t.test("% and _ in a search match themselves", async () => {
    assert.deepEqual((await search(`${run} 50%off`)).json.data.map((c) => c.name), [`${tag} 50%off`]);
    assert.deepEqual((await search(`${run} a_b`)).json.data.map((c) => c.name), [`${tag} a_b`]);
  });

  await t.test("a username with _ doesn't clash with a different one; case still does", async () => {
    await upsertUser(sql, { id: `f26x${run}`, role: "staff", username: `f26x${run}` });
    const underscore = await get("/api/users"); // warm-up read keeps the timing honest for the writes below
    assert.equal(underscore.status, 200);

    const post = (username) =>
      fetch(`${BASE}/api/users`, {
        method: "POST",
        headers: { cookie: owner, "content-type": "application/json" },
        body: JSON.stringify({ username, password: `f26-password-${run}`, role: "staff" }),
        signal: AbortSignal.timeout(20_000),
      });
    assert.equal((await post(`f26_${run}`)).status, 201, `f26_${run} was refused because f26x${run} exists`);

    await upsertUser(sql, { id: `f26k${run}`, role: "staff", username: `F26Case${run}` });
    assert.equal((await post(`f26case${run}`)).status, 409, "a name differing only in case must still count as taken");

    await upsertUser(sql, { id: `f26y${run}`, role: "staff", username: `f26y${run}z` });
    await upsertUser(sql, { id: `f26p${run}`, role: "staff", username: `f26p${run}` });
    const rename = await fetch(`${BASE}/api/users/f26p${run}`, {
      method: "PATCH",
      headers: { cookie: owner, "content-type": "application/json" },
      body: JSON.stringify({ username: `f26_${run}z` }),
      signal: AbortSignal.timeout(20_000),
    });
    assert.equal(rename.status, 200, `renaming to f26_${run}z was refused because f26y${run}z exists`);
  });
});
