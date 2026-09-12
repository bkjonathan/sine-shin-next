// Demonstration + guard for AUDIT.md finding F-06.
//
// F-06: sessions are self-contained 30-day JWTs and auth() never re-reads the
// users table. Deleting a user, demoting them or changing a password leaves
// their existing sessions working, and the role is trusted from the token.
//
// Fix under test: the JWT carries users.session_version (`sv`) from sign-in.
// Every auth() reloads the user and rejects the session if the row is gone or
// the version changed, and takes the role from the database. Role and password
// changes bump the version. Sessions idle out after 12 hours. Middleware runs
// on Node.js so it applies the same check (no /login <-> /dashboard loop).
//
// Needs a server started against a THROWAWAY database with all migrations
// applied, and the server's secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f06-session-revocation.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { BASE, liveReady, skipReason, auditDb, upsertUser, cookieFor, signIn } from "./helpers/audit-session.mjs";

const OWNER = "u_owner";
// users.id is varchar(21): "f06_" + 8 hex + "_" + tag (<= 7 chars).
const uid = (tag) => `f06_${randomBytes(4).toString("hex")}_${tag}`;

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, ...(body !== undefined && { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, location: res.headers.get("location"), text };
}

// A session probe any signed-in role may call. A live session gets 200; a
// rejected one gets the proxy's redirect to /login (or the route's own 401 if
// the proxy is bypassed).
async function probe(cookie) {
  const r = await call("GET", "/api/settings", cookie);
  if (r.status === 200) return "accepted";
  if (r.status === 401 || (r.status === 307 && /\/login/.test(r.location ?? ""))) return "rejected";
  return `unexpected ${r.status}`;
}

test("F-06: sessions are re-checked against the users table and revocable", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  t.after(() => sql.end());
  // Deletes, role changes and password resets need the owner's own password (F-18).
  const ownerPassword = randomBytes(9).toString("hex");
  await upsertUser(sql, { id: OWNER, role: "owner", passwordHash: await bcrypt.hash(ownerPassword, 4) });
  const owner = await cookieFor("owner", { id: OWNER });

  await t.test("control: a current session is accepted", async () => {
    assert.equal(await probe(owner), "accepted");
  });

  await t.test("a token issued before F-06 (no session version) is rejected", async () => {
    const id = uid("legacy");
    await upsertUser(sql, { id, role: "staff" });
    assert.equal(await probe(await cookieFor("staff", { id, sv: null })), "rejected");
  });

  await t.test("deleting a user ends their existing session", async () => {
    const id = uid("del");
    await upsertUser(sql, { id, role: "staff" });
    const cookie = await cookieFor("staff", { id });
    assert.equal(await probe(cookie), "accepted", "precondition: session works before delete");
    assert.equal((await call("DELETE", `/api/users/${id}`, owner, { currentPassword: ownerPassword })).status, 200, "owner deletes the user");
    assert.equal(await probe(cookie), "rejected", "a deleted user's session must be rejected");
  });

  await t.test("the role comes from the database, not the token", async () => {
    const id = uid("forged");
    await upsertUser(sql, { id, role: "staff" });
    // Token claims owner, row says staff: the owner-only settings update must be forbidden.
    const r = await call("PATCH", "/api/settings", await cookieFor("owner", { id }), {});
    assert.equal(r.status, 403, `stale/forged role claim was trusted (got ${r.status})`);
  });

  await t.test("demoting a user ends their existing session", async () => {
    const id = uid("role");
    await upsertUser(sql, { id, role: "owner" });
    const cookie = await cookieFor("owner", { id });
    assert.equal(await probe(cookie), "accepted", "precondition");
    assert.equal((await call("PATCH", `/api/users/${id}`, owner, { role: "staff", currentPassword: ownerPassword })).status, 200, "owner demotes");
    assert.equal(await probe(cookie), "rejected", "a demoted user's old session must be rejected");
  });

  await t.test("an owner password reset ends the target's sessions", async () => {
    const id = uid("reset");
    await upsertUser(sql, { id, role: "staff" });
    const cookie = await cookieFor("staff", { id });
    assert.equal(await probe(cookie), "accepted", "precondition");
    const r = await call("PATCH", `/api/users/${id}`, owner, { password: "reset-password-123", currentPassword: ownerPassword });
    assert.equal(r.status, 200, `owner resets password (got ${r.status})`);
    assert.equal(await probe(cookie), "rejected", "sessions must end after a password reset");
  });

  await t.test("changing your own password ends your sessions", async () => {
    const id = uid("self");
    const current = randomBytes(9).toString("hex");
    await upsertUser(sql, { id, role: "staff", passwordHash: await bcrypt.hash(current, 4) });
    const cookie = await cookieFor("staff", { id });
    const next = `new-${current}`;
    const r = await call("PATCH", "/api/settings", cookie, { currentPassword: current, newPassword: next, confirmPassword: next });
    assert.equal(r.status, 200, `self password change (got ${r.status}: ${r.text.slice(0, 120)})`);
    assert.equal(await probe(cookie), "rejected", "the old session must end after a password change");
  });

  await t.test("renaming a user does not end their session", async () => {
    const id = uid("rename");
    await upsertUser(sql, { id, role: "staff" });
    const cookie = await cookieFor("staff", { id });
    assert.equal((await call("PATCH", `/api/users/${id}`, owner, { username: `r_${id}` })).status, 200, "owner renames");
    assert.equal(await probe(cookie), "accepted", "a username-only edit must not sign the user out");
  });

  await t.test("sign-in issues a token carrying the user's current version", async () => {
    const id = uid("login");
    const password = randomBytes(9).toString("hex");
    // A non-zero version: a token that omits or hard-codes the version would fail.
    await upsertUser(sql, { id, role: "staff", passwordHash: await bcrypt.hash(password, 4), sessionVersion: 3 });
    const { cookie } = await signIn(id, password);
    assert.ok(cookie, "credentials sign-in did not set a session cookie");
    assert.equal(await probe(cookie), "accepted", "a freshly signed-in session must be accepted");
  });

  await t.test("sessions idle out after 12 hours", async () => {
    const r = await call("GET", "/api/auth/session", owner);
    const hours = (Date.parse(JSON.parse(r.text).expires) - Date.now()) / 3_600_000;
    assert.ok(hours > 11.9 && hours < 12.1, `session expiry should be ~12h away, got ${hours.toFixed(2)}h`);
  });

  await t.test("middleware rejects a revoked session too (no /login <-> /dashboard loop)", async () => {
    const id = uid("mw");
    await upsertUser(sql, { id, role: "staff" });
    const cookie = await cookieFor("staff", { id, sv: 99 }); // version mismatch
    const dash = await call("GET", "/dashboard", cookie);
    assert.equal(dash.status, 307, `/dashboard should redirect a revoked session (got ${dash.status})`);
    // Only the proxy adds callbackUrl; the (dashboard) layout's redirect does not,
    // so this proves the proxy itself ran and rejected the session.
    assert.match(dash.location ?? "", /\/login\?callbackUrl=/, `redirect did not come from the proxy: ${dash.location}`);
    const login = await call("GET", "/login", cookie);
    assert.equal(login.status, 200, `/login must render for a revoked session (got ${login.status} -> ${login.location})`);
  });
});
