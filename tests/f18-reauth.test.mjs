// Demonstration + guard for AUDIT.md finding F-18.
//
// F-18: an owner session could reset any user's password, change their role or
// delete them without typing a password, so a copied session cookie or an
// unattended browser was enough. The same route also let an owner set their own
// password without the current one, which Settings has always required.
//
// Decisions agreed with the owner (2026-09-12):
//   - a password reset, a role change and a delete ask for the acting owner's own
//     password, every time
//   - creating a user and renaming one don't
//
// Fix under test: PATCH and DELETE /api/users/:id take `currentPassword` and check
// it against the signed-in owner's own password before changing anything. Wrong
// entries are limited per account (5 in 15 minutes, as for sign-in), and the
// Settings password change counts toward the same limit, so neither route can be
// used to guess the password behind a stolen session.
//
// The first test needs nothing. The live test needs a server started against a
// THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f18-reauth.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { BASE, liveReady, skipReason, auditDb, upsertUser, cookieFor } from "./helpers/audit-session.mjs";

// users.id is varchar(21): "f18_" + 8 hex + "_" + tag (<= 7 chars).
const uid = (tag) => `f18_${randomBytes(4).toString("hex")}_${tag}`;
const newPassword = () => randomBytes(9).toString("hex");

test("F-18: the users API takes the owner's current password, up to 128 characters", async () => {
  const { updateUserSchema, deleteUserSchema } = await import("../src/validations/user.schema.ts");
  assert.ok(deleteUserSchema, "user.schema.ts must export deleteUserSchema");
  assert.equal(updateUserSchema.safeParse({ role: "staff", currentPassword: "x".repeat(128) }).success, true);
  assert.equal(updateUserSchema.safeParse({ role: "staff", currentPassword: "x".repeat(129) }).success, false);
  assert.equal(deleteUserSchema.safeParse({ currentPassword: "x".repeat(128) }).success, true);
  assert.equal(deleteUserSchema.safeParse({ currentPassword: "x".repeat(129) }).success, false);
  // The schema allows it to be missing; the route decides when it's needed.
  assert.equal(deleteUserSchema.safeParse({}).success, true);
});

async function call(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, ...(body !== undefined && { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, error: json?.error ?? text.slice(0, 120) };
}

test("F-18: password resets, role changes and deletes need the acting owner's password", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  t.after(() => sql.end());

  // A fresh account for every check, so wrong entries in one never block another.
  async function account(tag, role) {
    const id = uid(tag);
    const password = newPassword();
    await upsertUser(sql, { id, role, passwordHash: await bcrypt.hash(password, 4) });
    return { id, password, cookie: await cookieFor(role, { id }) };
  }
  const row = async (id) => (await sql`select role, password_hash, session_version from users where id = ${id}`)[0];

  await t.test("a password reset without the owner's own password changes nothing", async () => {
    const owner = await account("pw", "owner");
    const user = await account("pwt", "staff");
    const before = await row(user.id);
    const password = newPassword();
    const path = `/api/users/${user.id}`;

    const missing = await call("PATCH", path, owner.cookie, { password });
    assert.equal(missing.status, 400, `no owner password: got ${missing.status} ${missing.error}`);
    assert.match(missing.error, /password/i);
    const wrong = await call("PATCH", path, owner.cookie, { password, currentPassword: `x${owner.password}` });
    assert.equal(wrong.status, 400, `wrong owner password: got ${wrong.status} ${wrong.error}`);
    // The check is against the acting owner, not the account being changed.
    const targets = await call("PATCH", path, owner.cookie, { password, currentPassword: user.password });
    assert.equal(targets.status, 400, `the target's own password must not count: got ${targets.status}`);
    assert.deepEqual(await row(user.id), before, "the password and sessions must be untouched");

    const ok = await call("PATCH", path, owner.cookie, { password, currentPassword: owner.password });
    assert.equal(ok.status, 200, `with the owner's password: got ${ok.status} ${ok.error}`);
    assert.ok(await bcrypt.compare(password, (await row(user.id)).password_hash), "the new password is set");
  });

  await t.test("a role change without the owner's own password changes nothing", async () => {
    const owner = await account("role", "owner");
    const user = await account("rolet", "staff");
    const path = `/api/users/${user.id}`;

    const missing = await call("PATCH", path, owner.cookie, { role: "owner" });
    assert.equal(missing.status, 400, `no owner password: got ${missing.status} ${missing.error}`);
    const wrong = await call("PATCH", path, owner.cookie, { role: "owner", currentPassword: `x${owner.password}` });
    assert.equal(wrong.status, 400, `wrong owner password: got ${wrong.status} ${wrong.error}`);
    assert.equal((await row(user.id)).role, "staff", "the role must be untouched");

    const ok = await call("PATCH", path, owner.cookie, { role: "owner", currentPassword: owner.password });
    assert.equal(ok.status, 200, `with the owner's password: got ${ok.status} ${ok.error}`);
    assert.equal((await row(user.id)).role, "owner");
  });

  await t.test("deleting a user without the owner's own password deletes nothing", async () => {
    const owner = await account("del", "owner");
    const user = await account("delt", "staff");
    const path = `/api/users/${user.id}`;

    const missing = await call("DELETE", path, owner.cookie);
    assert.equal(missing.status, 400, `no owner password: got ${missing.status} ${missing.error}`);
    const wrong = await call("DELETE", path, owner.cookie, { currentPassword: `x${owner.password}` });
    assert.equal(wrong.status, 400, `wrong owner password: got ${wrong.status} ${wrong.error}`);
    assert.ok(await row(user.id), "the user must still exist");

    const ok = await call("DELETE", path, owner.cookie, { currentPassword: owner.password });
    assert.equal(ok.status, 200, `with the owner's password: got ${ok.status} ${ok.error}`);
    assert.equal(await row(user.id), undefined, "the user is deleted");
  });

  await t.test("an owner can't set their own password from Users without the current one", async () => {
    const owner = await account("self", "owner");
    const before = await row(owner.id);
    const r = await call("PATCH", `/api/users/${owner.id}`, owner.cookie, { password: newPassword() });
    assert.equal(r.status, 400, `got ${r.status} ${r.error}`);
    assert.deepEqual(await row(owner.id), before, "the password and sessions must be untouched");
  });

  await t.test("by decision, creating a user and renaming one don't ask", async () => {
    const owner = await account("free", "owner");
    const user = await account("freet", "staff");
    const rename = await call("PATCH", `/api/users/${user.id}`, owner.cookie, { username: `${user.id}r` });
    assert.equal(rename.status, 200, `rename: got ${rename.status} ${rename.error}`);
    const create = await call("POST", "/api/users", owner.cookie, { username: `${user.id}n`, password: newPassword(), role: "staff" });
    assert.equal(create.status, 201, `create: got ${create.status} ${create.error}`);
  });

  await t.test("wrong entries are limited per account, across Users and Settings", async () => {
    const owner = await account("limit", "owner");
    const user = await account("limitt", "staff");
    const path = `/api/users/${user.id}`;
    const wrongRole = (i) => call("PATCH", path, owner.cookie, { role: "owner", currentPassword: `wrong-${i}` });
    const settingsChange = (currentPassword) => {
      const next = newPassword();
      return call("PATCH", "/api/settings", owner.cookie, { currentPassword, newPassword: next, confirmPassword: next });
    };

    // A correct entry clears earlier mistakes, so an owner who mistypes now and then isn't locked out.
    for (const role of ["manager", "staff"]) {
      for (let i = 0; i < 4; i++) assert.equal((await wrongRole(i)).status, 400, `wrong entry ${i + 1} before setting ${role}`);
      const ok = await call("PATCH", path, owner.cookie, { role, currentPassword: owner.password });
      assert.equal(ok.status, 200, `a correct entry after 4 mistakes: got ${ok.status} ${ok.error}`);
    }

    // Three wrong entries through Users and two through Settings make five.
    for (let i = 0; i < 3; i++) assert.equal((await wrongRole(i)).status, 400);
    for (let i = 0; i < 2; i++) assert.equal((await settingsChange(`wrong-${i}`)).status, 400);

    const blocked = await call("PATCH", path, owner.cookie, { role: "owner", currentPassword: owner.password });
    assert.equal(blocked.status, 429, `the right password must be refused while blocked: got ${blocked.status} ${blocked.error}`);
    const selfBlocked = await settingsChange(owner.password);
    assert.equal(selfBlocked.status, 429, `Settings shares the block: got ${selfBlocked.status} ${selfBlocked.error}`);
    assert.equal((await row(user.id)).role, "staff", "nothing changed while blocked");

    const other = await account("other", "owner");
    const unaffected = await call("PATCH", path, other.cookie, { role: "manager", currentPassword: other.password });
    assert.equal(unaffected.status, 200, `another owner isn't blocked: got ${unaffected.status} ${unaffected.error}`);
  });

  await t.test("simultaneous wrong entries can't get past the limit", async () => {
    const owner = await account("burst", "owner");
    const user = await account("burstt", "staff");
    const replies = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        call("PATCH", `/api/users/${user.id}`, owner.cookie, { role: "owner", currentPassword: `wrong-${i}` })
      )
    );
    const counts = {};
    for (const r of replies) counts[r.status] = (counts[r.status] ?? 0) + 1;
    assert.deepEqual(counts, { 400: 5, 429: 15 }, `20 simultaneous wrong entries got ${JSON.stringify(counts)}`);
    assert.equal((await row(user.id)).role, "staff");
  });
});
