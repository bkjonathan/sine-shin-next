// Shared helpers for the live audit tests (F-03, F-04, F-06).
//
// Since F-06 a session is valid only if its user row exists and the token's
// session version (`sv`) matches users.session_version, so a minted cookie
// needs a real user in the server's database. These helpers mint cookies and
// seed users — into a THROWAWAY database only (see auditDb).

import { encode } from "next-auth/jwt";
import postgres from "postgres";

export const BASE = process.env.AUDIT_BASE_URL;
export const SECRET = process.env.NEXTAUTH_SECRET;
export const DB_URL = process.env.AUDIT_DATABASE_URL;
// Cookie name for a non-secure (http) deployment, which is what the test server uses.
export const SALT = "authjs.session-token";

export const liveReady = Boolean(BASE && SECRET && DB_URL);
export const skipReason =
  "set AUDIT_BASE_URL, NEXTAUTH_SECRET and AUDIT_DATABASE_URL (the throwaway DB the server uses) to run";

/** Connects to the audit DB; refuses anything but a local database named audit*. */
export function auditDb() {
  const u = new URL(DB_URL);
  const name = u.pathname.slice(1);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || !name.startsWith("audit")) {
    throw new Error(
      `Refusing to seed ${u.hostname}/${name}: audit tests only write to a local database whose name starts with "audit".`
    );
  }
  return postgres(DB_URL, { max: 2, onnotice: () => {} });
}

/** Inserts or resets a user row. The default password hash never matches a login. */
export async function upsertUser(sql, { id, role, username = id, passwordHash = "!unusable", sessionVersion = 0 }) {
  await sql`
    insert into users (id, name, password_hash, role, session_version)
    values (${id}, ${username}, ${passwordHash}, ${role}, ${sessionVersion})
    on conflict (id) do update set
      name = excluded.name, password_hash = excluded.password_hash,
      role = excluded.role, session_version = excluded.session_version`;
}

/** Seeds the u_staff / u_manager / u_owner users that cookieFor(role) refers to. */
export async function seedRoleUsers(sql) {
  for (const role of ["staff", "manager", "owner"]) await upsertUser(sql, { id: `u_${role}`, role });
}

// Set-Cookie values by name, keeping the last per name as a browser does
// (the proxy and the Auth.js route can both set authjs.csrf-token).
const jar = (res) => new Map(res.headers.getSetCookie().map((c) => c.split(";")[0].split(/=(.*)/s).slice(0, 2)));

/**
 * Real credentials sign-in through Auth.js. `ip` is sent as X-Forwarded-For so
 * tests can act as distinct clients. Returns the redirect `location`, the
 * session `cookie` (null when sign-in failed) and the callback's time in `ms`.
 */
export async function signIn(username, password, { ip } = {}) {
  const forwarded = ip ? { "x-forwarded-for": ip } : {};
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: forwarded, signal: AbortSignal.timeout(20_000) });
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = [...jar(csrfRes)].map(([k, v]) => `${k}=${v}`).join("; ");
  const started = performance.now();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { ...forwarded, "content-type": "application/x-www-form-urlencoded", cookie: csrfCookie },
    body: new URLSearchParams({ csrfToken, username, password, callbackUrl: `${BASE}/dashboard` }),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  await res.text().catch(() => {});
  const ms = performance.now() - started;
  const session = jar(res).get(SALT);
  return { location: res.headers.get("location") ?? "", cookie: session ? `${SALT}=${session}` : null, ms };
}

/**
 * Mints a session cookie. `sv` is the session version claim; pass `sv: null`
 * to mimic a token issued before F-06 (no claim at all).
 */
export async function cookieFor(role, { id = `u_${role}`, sv = 0 } = {}) {
  const token = { sub: id, id, name: id, email: id, role };
  if (sv !== null) token.sv = sv;
  return `${SALT}=${await encode({ token, secret: SECRET, salt: SALT })}`;
}
