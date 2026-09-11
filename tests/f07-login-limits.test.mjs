// Demonstration + guard for AUDIT.md finding F-07.
//
// F-07: nothing limits sign-in attempts; an unknown username returns before
// bcrypt runs, so response time reveals which usernames exist; and passwords
// set by an owner may be 6 characters.
//
// Fix under test:
//   - in-memory limits in authorize(): 5 failures per IP+username or 20 per IP
//     within 15 min block for 15 min; a success clears the IP+username count
//   - an unknown username is compared against a dummy bcrypt hash (same cost)
//   - one 8-character minimum on every path that sets a password
//
// The first two tests need nothing but node_modules. The live test needs a
// server started against a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   node --test tests/f07-login-limits.test.mjs
// Client addresses are faked with X-Forwarded-For (random per run, because the
// limiter's memory outlives a test run).

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { BASE, liveReady, skipReason, auditDb, upsertUser, cookieFor, signIn } from "./helpers/audit-session.mjs";

test("F-07: attempt limiter blocks, expires and stays bounded", async (t) => {
  const { createAttemptLimiter } = await import("../src/lib/attempt-limiter.ts");
  let clock = 0;
  const make = (opts = {}) =>
    createAttemptLimiter({ maxFailures: 3, windowMs: 1000, blockMs: 5000, now: () => clock, ...opts });

  await t.test("blocks a key after maxFailures inside the window, not before", () => {
    clock = 0;
    const l = make();
    l.recordFailure("a");
    l.recordFailure("a");
    assert.equal(l.isBlocked("a"), false);
    l.recordFailure("a");
    assert.equal(l.isBlocked("a"), true);
    assert.equal(l.isBlocked("b"), false, "other keys are unaffected");
  });

  await t.test("failures spread wider than the window don't accumulate", () => {
    clock = 0;
    const l = make();
    l.recordFailure("a");
    clock = 600;
    l.recordFailure("a");
    clock = 1200;
    l.recordFailure("a");
    assert.equal(l.isBlocked("a"), false);
  });

  await t.test("a block lasts blockMs, isn't extended by attempts, then a fresh window starts", () => {
    clock = 0;
    const l = make();
    for (let i = 0; i < 3; i++) l.recordFailure("a");
    clock = 4000;
    l.recordFailure("a");
    clock = 4999;
    assert.equal(l.isBlocked("a"), true);
    clock = 5000;
    assert.equal(l.isBlocked("a"), false);
    l.recordFailure("a");
    assert.equal(l.isBlocked("a"), false, "one failure after a block must not re-block");
  });

  await t.test("reset clears a key's failures", () => {
    clock = 0;
    const l = make();
    l.recordFailure("a");
    l.recordFailure("a");
    l.reset("a");
    l.recordFailure("a");
    l.recordFailure("a");
    assert.equal(l.isBlocked("a"), false);
  });

  await t.test("flooding new keys stays within maxKeys and doesn't evict an active block", () => {
    clock = 0;
    const l = make({ maxKeys: 3 });
    for (let i = 0; i < 3; i++) l.recordFailure("blocked");
    for (let i = 0; i < 50; i++) l.recordFailure(`flood-${i}`);
    assert.ok(l.size <= 3, `limiter holds ${l.size} keys, max 3`);
    assert.equal(l.isBlocked("blocked"), true);
  });
});

test("F-07: one 8-character minimum for passwords an owner sets", async () => {
  const { PASSWORD_MIN_LENGTH, createUserSchema, updateUserSchema } = await import("../src/validations/user.schema.ts");
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  const base = { username: "someone", role: "staff" };
  assert.equal(createUserSchema.safeParse({ ...base, password: "1234567" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, password: "12345678" }).success, true);
  assert.equal(updateUserSchema.safeParse({ password: "1234567" }).success, false);
  assert.equal(updateUserSchema.safeParse({ password: "12345678" }).success, true);
  assert.equal(updateUserSchema.safeParse({ password: "" }).success, true, "blank keeps the existing password");
});

async function api(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  await res.text().catch(() => {});
  return res.status;
}

test("F-07: sign-in is rate limited and doesn't reveal valid usernames", { skip: liveReady ? false : skipReason }, async (t) => {
  const sql = auditDb();
  t.after(() => sql.end());
  const tag = randomBytes(3).toString("hex");
  const [a, b] = randomBytes(2);
  const ip = (n) => `10.${a}.${b}.${n}`;

  const password = randomBytes(9).toString("hex");
  const user = `f07_${tag}_rl`;
  await upsertUser(sql, { id: user, role: "staff", passwordHash: await bcrypt.hash(password, 4) });
  const plainFailure = (r) => /error=CredentialsSignin/.test(r.location) && !/code=rate_limited/.test(r.location) && !r.cookie;
  const rateLimited = (r) => /code=rate_limited/.test(r.location) && !r.cookie;

  await t.test("control: the right password signs in", async () => {
    const r = await signIn(user, password, { ip: ip(1) });
    assert.ok(r.cookie, `sign-in failed: ${r.location}`);
  });

  await t.test("5 wrong passwords block that IP+username, even for the right password", async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await signIn(user, "wrong-password", { ip: ip(2) });
      assert.ok(plainFailure(r), `attempt ${i} should be an ordinary failure: ${r.location}`);
    }
    const r = await signIn(user, password, { ip: ip(2) });
    assert.ok(rateLimited(r), `6th attempt must be rate limited, got ${r.location || "(no redirect)"} cookie=${!!r.cookie}`);
  });

  await t.test("the same user still signs in from another address", async () => {
    const r = await signIn(user, password, { ip: ip(3) });
    assert.ok(r.cookie, `a block on one address must not lock the user out elsewhere: ${r.location}`);
  });

  await t.test("a successful sign-in resets the IP+username count", async () => {
    for (let round = 1; round <= 2; round++) {
      for (let i = 0; i < 4; i++) await signIn(user, "wrong-password", { ip: ip(4) });
      const r = await signIn(user, password, { ip: ip(4) });
      assert.ok(r.cookie, `round ${round}: sign-in after 4 failures must succeed: ${r.location}`);
    }
  });

  await t.test("one address spraying usernames is capped at 20 failures", async () => {
    for (let i = 0; i < 20; i++) await signIn(`f07_${tag}_nobody${i}`, "wrong-password", { ip: ip(5) });
    const r = await signIn(user, password, { ip: ip(5) });
    assert.ok(rateLimited(r), `21st attempt from one address must be rate limited, got ${r.location} cookie=${!!r.cookie}`);
  });

  await t.test("response time doesn't reveal whether a username exists", async () => {
    // Same cost as real accounts (12), so a timing gap would come from skipping bcrypt.
    const known = `f07_${tag}_t`;
    await upsertUser(sql, { id: known, role: "staff", passwordHash: await bcrypt.hash(randomBytes(9).toString("hex"), 12) });
    const median = (xs) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
    const knownMs = [];
    const unknownMs = [];
    for (let i = 0; i < 5; i++) {
      knownMs.push((await signIn(known, "wrong-password", { ip: ip(10 + i) })).ms);
      unknownMs.push((await signIn(`f07_${tag}_ghost`, "wrong-password", { ip: ip(20 + i) })).ms);
    }
    const gap = Math.abs(median(knownMs) - median(unknownMs));
    assert.ok(
      gap < 100,
      `existing vs unknown username differ by ${gap.toFixed(0)}ms ` +
        `(medians ${median(knownMs).toFixed(0)}ms / ${median(unknownMs).toFixed(0)}ms)`
    );
  });

  // Last: before the fix a 7-character reset succeeds and would change `user`'s password.
  await t.test("every path that sets a password rejects 7 characters", async () => {
    await upsertUser(sql, { id: "u_owner", role: "owner" });
    const owner = await cookieFor("owner");
    const create = await api("POST", "/api/users", owner, { username: `f07_${tag}_new`, password: "1234567", role: "staff" });
    assert.equal(create, 400, `create user with a 7-character password: got ${create}`);
    const reset = await api("PATCH", `/api/users/${user}`, owner, { password: "1234567" });
    assert.equal(reset, 400, `owner reset to a 7-character password: got ${reset}`);

    const self = `f07_${tag}_self`;
    const current = randomBytes(9).toString("hex");
    await upsertUser(sql, { id: self, role: "staff", passwordHash: await bcrypt.hash(current, 4) });
    const change = await api("PATCH", "/api/settings", await cookieFor("staff", { id: self }), {
      currentPassword: current,
      newPassword: "1234567",
      confirmPassword: "1234567",
    });
    assert.equal(change, 400, `self-service change to a 7-character password: got ${change}`);
  });
});
