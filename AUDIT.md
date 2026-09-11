# Security & Architecture Audit — sine-shin-next

- **Date:** 2026-09-11
- **Code audited:** commit `9edae52`, branch `refactor/code-base`
- **Method:** Read-only. Source read by hand; `grep`, `git log`, `npm ls` and `npm audit --omit=dev` run. Nothing was run against a database or a running server, and no exploit was attempted. "Confirmed" in this report means confirmed by reading code or build output, not reproduced.

---

## 1. Summary

This is a single-tenant Next.js 16.2.1 App Router application: one shop per deployment, with no shop or owner column anywhere in the schema. The backend is 29 route-handler files (61 method handlers) plus five server-rendered pages that query the database. There are no server actions. Data lives in PostgreSQL through Drizzle ORM, and login uses Auth.js (next-auth 5 beta) credentials with 30-day JWT cookies.

Authentication is consistent: every route handler calls `auth()` before touching the database. Authorisation is almost absent. Only `/api/users/*` (owner) and `/api/reports` (owner/manager) check the role. Any signed-in account, including `staff`, can:

- change fees and paid flags
- record or delete payments
- change shop settings
- permanently delete orders, customers, expenses and shipments

None of this is audited, and sessions cannot be revoked.

The most urgent risks:

1. The installed Next.js version has published middleware-bypass advisories, and three detail pages rely on middleware alone for authentication.
2. A stored XSS in the print-label windows lets a staff account act with an owner's session.
3. Money correctness is weak:
   - every amount is a `double precision` float
   - revenue and profit use at least three conflicting formulas, and one adds a percentage as if it were money
   - cargo payment balances depend on a currency setting stored in each browser

There is also no rate limiting, no transactions, no idempotency, no security headers, and a documented default owner password (`admin`/`admin123`). CLAUDE.md describes inventory and invoicing, but the schema has no inventory model and no invoice table; invoices are rendered from live order data. The codebase is small and consistent, so most fixes are Small or Medium.

---

## 1a. Post-audit status (working-tree fixes)

_Added 2026-09-11, after remediation began. The changes below live in the working tree and are **not committed**._

- **F-01 — fixed in working tree.** Upgraded `next` and `eslint-config-next` 16.2.1 → **16.2.12**, which clears all four middleware/proxy-bypass advisories. Verified by `next build`, `tsc --noEmit`, and a version + runtime guard (`tests/f01-next-version.test.mjs`). Caveat: a live bypass could **not** be reproduced on this app at 16.2.1 — middleware redirected every `.rsc`/segment variant tried. **Residual:** `next` still wants **16.3.3+** for the AVIF image-optimiser and Windows-host RCE advisories (both believed unreachable here — no `next/image`, Linux host); tracked as a separate follow-up.
- **F-02 — fixed in working tree; severity corrected.** Added a `requireSession()` gate to the three detail pages (`tests/f02-page-auth.test.mjs`). **Corrected severity: HIGH → LOW–MEDIUM (defense-in-depth).** The original HIGH over-stated it: alongside middleware, the `(dashboard)` layout's own `auth()` already redirects direct/anonymous requests (verified), so this was never a live anonymous-read hole — the real residual was only the partial-rendering / lost-coverage case. The section-1 summary and the section-2 counts still reflect the **original** assessment; this note supersedes the F-02 severity.
- **Permission matrix agreed (answers §6 item 2).** Roles are hierarchical, owner > manager > staff:
  - create / edit / bulk status / record payment → **staff+**
  - soft-delete, trash restore, payment/expense reversal → **manager+**
  - shop settings, cargo-category rates, permanent delete → **owner**

  Enforced with `roleAtLeast(session, min)` / `forbidden()` in src/lib/auth.ts, called right after the session check. Staff+ handlers need no extra gate: every signed-in session carries a role (the `jwt` callback defaults it to `staff`). The §5 "Role check" column still shows the **original** state.
- **F-03 — fixed in working tree.** Permanent delete (`DELETE /api/trash/*/[id]`) is owner-only; restore (`PATCH`) is manager+. Verified by `tests/f03-trash-delete-auth.test.mjs` (6/6) against a local `next build && next start`. For that run `DATABASE_URL` pointed at an unreachable host (`127.0.0.1:1`) and a throwaway secret was used; the server log showed `ECONNREFUSED` on a read-only probe before any write test ran. **Residual:** no audit row is written before a delete (F-14), and owners can still hard-delete financial records.
- **F-04 — fixed in working tree.** The manager+ and owner rows of the matrix are enforced on all 20 handlers they cover. In `PATCH /api/settings` the owner gate sits after the password-change branch: that branch always returns and only changes the caller's own password, so any role can still change their own password but only an owner can change shop settings. Verified by `tests/f04-write-authz.test.mjs` (35 endpoints × staff/manager/owner, all pass) on the same local server. **Residual:**
  - the role comes from the JWT, so a demoted user keeps their old rights until the token expires (F-06)
  - read endpoints still serve financials to every role (F-12)
  - F-19's owner-only-settings part is now covered; its prefix-format and numbering parts are not
  - not checked: whether the UI hides the controls that now return 403 to lower roles
- **F-05 — fixed in working tree.** Every value written into the print-label popup in customer-table.tsx and order-table.tsx now goes through a new `escapeHtml()` in src/lib/utils.ts. Escaping on output also neutralises any payload already stored, so no data cleanup is needed. A grep for raw-HTML sinks (`document.write`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc`, `dangerouslySetInnerHTML`) found no others. Verified by `tests/f05-print-label-xss.test.mjs` (failed before the fix, 4/4 after), `tsc --noEmit` and `next build`. Not reproduced in a browser (no live database). **Residual:** the popup's inline auto-print `<script>` will need a CSP hash once F-17 lands, and the escaping guard covers only these two templates.
- **F-06 — fixed in working tree; needs a migration before deploy.**
  - **Session version.** New column `users.session_version` (drizzle/0009_user_session_version.sql, `ADD COLUMN IF NOT EXISTS`; journal `when` is the current time, so it isn't skipped — F-20). Sign-in writes it into the JWT as `sv`. The `jwt` callback in src/lib/auth.ts reloads the user on every `auth()`, returns `null` (signed out) if the row is gone or the version differs, and takes `role` from the database.
  - **Revocation.** The version is bumped by an owner's role change or password reset (`PATCH /api/users/[id]`) and by a self-service password change (`PATCH /api/settings`); the latter also signs the current device out (the client calls `signOut`). Deleting a user needs no bump. A username-only edit signs nobody out.
  - **Idle timeout.** `session.maxAge` is 12 hours. Auth.js re-issues the JWT on every session read, so this is an idle timeout, not a fixed interval. (Correction to F-06 and Appendix B §C: re-issue is not throttled to once per 24 h — `updateAge` applies only to database sessions; see node_modules/@auth/core/lib/actions/session.js.)
  - **Proxy on Node.js.** `middleware.ts` is replaced by **src/proxy.ts** (same code) so the proxy runs on Node.js and applies the same database check. The old root `middleware.ts` was built for the Edge runtime, where that query can't run. Adding `runtime: "nodejs"` to it, or placing `proxy.ts` at the repo root, both build but are never invoked by `next start`: Next only registers the file beside `src/app` (node_modules/next/dist/build/index.js:616-634). This resolves §6 item 8.
  - **Verified** by `tests/f06-session-revocation.test.mjs` against a local `next build && next start` backed by a throwaway Postgres container with all migrations applied: 8 of its 11 checks failed on the pre-fix build; all 11 pass after. The F-01–F-05 tests pass on the same build (68 tests total), including F-01's runtime guard, which is what caught the unregistered proxy. F-03/F-04 now seed their role users through `tests/helpers/audit-session.mjs`, which refuses any database that isn't local and named `audit*`.
  - **Deploy order matters.** Apply 0009 to production _before_ the new image goes live — until the column exists, nobody can sign in. If production was built with `db:push` (step 2 of the tracked setup doc; see F-33), `db:migrate` may try to re-run 0000 against existing tables, so run 0009's single `ALTER TABLE … IF NOT EXISTS` statement by hand instead. Every existing session is signed out once on deploy (old tokens carry no version). Each `auth()` is now one primary-key lookup (a page load does about three: proxy, layout, page), and a database outage signs users out rather than failing open.
  - **Residual:** no "sign out everywhere" button (a password change does it); an owner who resets their _own_ password from the Users page is signed out on their next request without a message.
- **F-07 — fixed in working tree.**
  - **Rate limiting (in-app, no new dependency).** src/lib/attempt-limiter.ts, used in `authorize()` in src/lib/auth.ts. Within 15 minutes, 5 failed sign-ins for one IP+username, or 20 from one IP, block that key for 15 minutes. Blocked attempts skip the database and bcrypt and return error code `rate_limited`; the login page then says "Too many failed sign-in attempts". A successful sign-in clears that IP+username count. The per-IP threshold is deliberately higher so a shop behind one address isn't locked out by a few typos (one constant to change).
  - **Client address.** The last `X-Forwarded-For` entry, which Traefik adds; Next.js only sets the header when it's absent (node_modules/next/dist/server/base-server.js:577). This assumes Traefik is the only proxy in front — behind a CDN, visitors would share the CDN's addresses (unknown, §6 item 4).
  - **Username enumeration.** An unknown username is checked against a dummy cost-12 bcrypt hash. Measured on a local build, rejecting an existing vs an unknown username took 261 ms vs 4 ms before, and 264 ms vs 262 ms after.
  - **Password policy.** One `PASSWORD_MIN_LENGTH = 8` (src/validations/user.schema.ts) for create user, owner reset, self-service change and the Users edit form, which previously had no client-side minimum. Existing shorter passwords still sign in. Login input is capped at 100 (username) / 128 (password) characters.
  - **Verified** by `tests/f07-login-limits.test.mjs`: limiter unit tests with a fake clock, schema tests, and live sign-ins through Auth.js with faked client addresses. Before the fix, every check of the fix failed and only the three guard checks (normal sign-in, another address, reset on success) passed; after it, all pass. Full suite F-01–F-07: 83 tests pass.
  - **Residual:** the counts live in process memory, so they reset on restart or redeploy and aren't shared if more than one replica ever runs. If port 3000 is reachable without Traefik (F-31), a client can forge `X-Forwarded-For` and dodge the limits — fix F-31. There is deliberately no per-username limit across addresses, because it would let anyone lock the owner out. F-18's one-password-policy part is done; its re-authentication part is not.
- **F-08 — code fixed in working tree; production check still needed.**
  - **No default password.** src/db/seed.ts takes the owner password from `SEED_OWNER_PASSWORD` (refused under 8 characters) or generates a random 20-character one and prints it once. The credentials line in memory/project_shop_manager.md is replaced.
  - **The seed was also broken.** It imported `dotenv/config`, which isn't a dependency, so `npm run db:seed` failed with `Cannot find module`. The import is removed; pass `DATABASE_URL` in the environment, as the script's own usage line says. (Adding `dotenv` back would be a new dependency.)
  - **Verified** by `tests/f08-seed-owner-password.test.mjs`: it runs the real seed against the throwaway database, signs in with the generated and the provided password, confirms the old default is refused, and checks that no tracked file other than this report still contains it. Before the fix the seed couldn't load and the default was still tracked. Full suite F-01–F-08: 88 tests pass.
  - **Still needs the owner:** confirm the production `admin` account doesn't use the old default — it stays in git history, so treat it as public. No `mustChangePassword` flag yet (decision pending). A generated password that was printed to a terminal or CI log should be changed after first sign-in.
- **New finding F-33 (found while verifying F-06).** A database built only from drizzle/0000–0009 lacks at least four columns the code uses: `expenses.expense_id`, `expenses.title`, `expenses.expense_date` and `cargo_items.note`. On such a database the expenses API, the trash and the public `/t/[code]` page return 500 (`errorMissingColumn`). Existing databases presumably gained these columns through `db:push` — step 2 of the tracked setup doc (memory/project_shop_manager.md:33) is `npm run db:push`. Consequences: rebuilding from migrations (disaster recovery, a new environment) yields a broken app, and production's `drizzle.__drizzle_migrations` may not reflect its real schema — so check both before running `db:migrate` there (F-20). **Not fixed:** needs a read-only look at the production schema first.

---

## 2. Findings table

| ID | Severity | Area | File:line | Description |
|---|---|---|---|---|
| F-01 | CRITICAL | D Middleware / M Deps | package.json:42 | ✓ fixed (WT, →16.2.12; see §1a) — next 16.2.1 has published middleware/proxy-bypass advisories; three pages rely on middleware alone for auth |
| F-02 | HIGH→LOW-MED | A Access control | src/app/(dashboard)/orders/[id]/page.tsx:11-21 | ✓ fixed (WT); severity corrected, see §1a — three server-rendered detail pages query the DB with no auth check of their own |
| F-03 | HIGH | A Access control | src/app/api/trash/orders/[id]/route.ts:29-38 | ✓ fixed (WT; see §1a) — Any role can permanently delete orders, customers, expenses and cargo shipments |
| F-04 | HIGH | A Access control | src/app/api/cargo-payments/[cargoShipmentId]/route.ts:41-93 | ✓ fixed (WT; see §1a) — Money- and status-changing writes have no role authorisation |
| F-05 | HIGH | J XSS | src/components/customers/customer-table.tsx:29-40 | ✓ fixed (WT; see §1a) — Stored XSS in print-label windows lets a staff user act with an owner's session |
| F-06 | HIGH | C Session | src/lib/auth.ts:47-57 | ✓ fixed (WT; migration 0009 must run first — see §1a) — Sessions cannot be revoked; deleting, demoting or re-passwording a user doesn't end their sessions |
| F-07 | HIGH | H Abuse | src/lib/auth.ts:21-44 | ✓ fixed (WT; see §1a) — No rate limiting or lockout on login; response timing reveals valid usernames |
| F-08 | HIGH | I Secrets | src/db/seed.ts:51-58 | ✓ code fixed (WT); production password check still needed — see §1a — Seeded owner account `admin` / `admin123`, documented in a tracked file |
| F-09 | HIGH | G Money | src/db/schema/orders.ts:11-16 | All monetary values stored as `double precision` and computed as JS floats |
| F-10 | HIGH | G Money | src/app/api/dashboard/route.ts:73-74 | Revenue and profit have conflicting definitions; percentage service fee summed as money |
| F-11 | HIGH | G Money | src/components/cargo/cargo-detail-client.tsx:188-192 | Cargo payment balances depend on a per-browser localStorage currency |
| F-12 | MEDIUM | A/E Access control | src/app/api/dashboard/route.ts:28-30 | Financial data blocked in `/api/reports` is served to every role by other endpoints |
| F-13 | MEDIUM | G Correctness | src/app/api/orders/route.ts:96-126 | No transactions, racy display-number generation, no idempotency |
| F-14 | MEDIUM | K Audit | src/db/schema/index.ts:1-11 | No audit trail for any money, status, delete or user change |
| F-15 | MEDIUM | F Validation | src/validations/order.schema.ts:10-40 | Amounts, rates, percentages and quantities have no upper bounds; dates unvalidated |
| F-16 | MEDIUM | C Auth | src/app/(auth)/login/page.tsx:22,44 | Open redirect after login via `callbackUrl` |
| F-17 | MEDIUM | J Headers | next.config.ts:5-14 | No CSP, HSTS, frame, nosniff or referrer headers; `X-Powered-By` enabled |
| F-18 | MEDIUM | C Auth | src/app/api/users/[id]/route.ts:35-107 | ◐ password-minimum part done under F-07; re-authentication still open — Owner resets other users' passwords/roles with no re-authentication; 6-char passwords allowed |
| F-19 | MEDIUM | F/G Correctness | src/validations/settings.schema.ts:8-10 | Any role can set an ID prefix that breaks order/customer/shipment creation |
| F-20 | MEDIUM | N Migrations | drizzle/meta/_journal.json | Journal timestamps out of order; Drizzle silently skips older migrations |
| F-21 | MEDIUM | I Secrets | Dockerfile:15,36 | No `.dockerignore`; `.env` can be baked into the runtime image |
| F-22 | LOW | K Logging | src/app/api/dashboard/route.ts:150-159 | 500 responses return SQL text and params; failed user writes log bcrypt hashes |
| F-23 | LOW | E Exposure | src/app/t/[code]/page.tsx:77-111 | Public tracking page stays open for cancelled shipments; full shop row sent to anonymous users |
| F-24 | LOW | F Validation | src/app/api/cargo-items/[cargoShipmentId]/route.ts:117-134 | DELETE/bag handlers parse body outside try, don't type-check ids, touch deleted rows |
| F-25 | LOW | G Integrity | src/app/api/cargo-payments/[cargoShipmentId]/route.ts:56-67 | Child rows can be attached to deleted or non-existent parents |
| F-26 | LOW | F Validation | src/app/api/orders/route.ts:15-16 | `?page=abc` gives 500; LIKE wildcards unescaped; username check uses `ilike` |
| F-27 | LOW | J XSS | src/components/orders/order-items-section.tsx:196 | `productUrl` rendered as a link without scheme validation |
| F-28 | LOW | J Export | src/app/(dashboard)/orders/page.tsx:70-80 | CSV export doesn't escape quotes or neutralise spreadsheet formulas |
| F-29 | LOW | I Config | src/env.ts:1-19 | Environment validation module is never imported |
| F-30 | LOW | E Public code | drizzle/0007_cargo_item_public_code.sql:10-12 | Backfilled tracking codes generated with `md5(random())` |
| F-31 | LOW | I Deploy | docker-compose.yml:6-7,12 | Compose publishes port 3000 on all interfaces with `AUTH_TRUST_HOST=true` |
| F-32 | LOW | M Deps | package.json:33,38,41,43 | Advisories in axios, drizzle-orm, nanoid, @auth/core — not reachable, but should be patched |
| F-33 | MEDIUM | N Migrations | drizzle/*.sql vs src/db/schema/expenses.ts, cargo-items.ts | Added after the audit (see §1a) — migrations never create `expenses.expense_id`/`title`/`expense_date` or `cargo_items.note`; a database built from migrations breaks expenses, trash and public tracking |

---

## 3. Finding details

Each finding lists what I found, the evidence, a proposed fix and an effort estimate. The fixes are descriptions only; no fix code has been written.

### CRITICAL

#### F-01 — Next.js 16.2.1 has published middleware-bypass advisories, and three pages rely on middleware alone

> **Status: fixed in working tree (not committed).** `next`/`eslint-config-next` upgraded to 16.2.12. See §1a for verification and the 16.3.3+ residual.

**Area:** D Middleware, M Dependencies
**Where:** package.json:42 (`"next": "16.2.1"`); middleware.ts:16-20; pages listed in F-02.

**What I found.** `npm audit --omit=dev` reports 25 advisories against next 16.2.1. Three of them bypass exactly the control this app relies on:

- GHSA-267c-6grr-h53f — "Middleware / Proxy bypass in App Router applications via segment-prefetch routes"
- GHSA-26hh-7cqf-hhc6 — incomplete-fix follow-up to the above
- GHSA-492v-c6pp-mqqv — "Middleware / Proxy bypass through dynamic route parameter injection"

Two further advisories allow denial of service against Server Components: GHSA-q4gf-8mx6-v5v3 and GHSA-8h8q-6873-q5fj.

This is an App Router app with dynamic routes. `/orders/[id]`, `/customers/[id]` and `/cargo/[id]` are server components that never check the session (F-02). If either bypass works here, an anonymous visitor with a valid id receives:

- customer name, phone and address
- every order fee and paid flag
- cargo payments and expenses

Ids are 21-character nanoids, which prevents guessing. They do leak through URLs, browser history, screenshots and shared links.

**Not verified.** I did not read the advisory text (no network reads) and did not attempt a bypass. The CRITICAL rating combines two things: a published bypass of the exact control this app depends on, and the absence of any second check.

**CVE-2025-29927:** fixed in 14.2.25 and 15.2.3. Version 16.2.1 is later, so it is **not** vulnerable to that specific CVE.

**Proposed fix.** Upgrade `next` and `eslint-config-next` to the first patched release npm audit reports (16.3.4 or later), then build and smoke-test every page. Separately, fix F-02 so middleware stops being the only defence.
**Effort:** Small

### HIGH

#### F-02 — Three server-rendered pages read the database with no auth check of their own

> **Status: fixed in working tree (not committed); severity corrected HIGH → LOW–MEDIUM.** A `requireSession()` gate was added to all three pages. On investigation the original HIGH was too high: the `(dashboard)` layout's own `auth()` already redirects direct/anonymous requests, so this was defense-in-depth, not a live anonymous-read hole. The "exact request" framing below describes the intended attack, but such a request is in fact redirected today by both middleware and the layout. See §1a.

**Area:** A Access control, D Middleware
**Where:**

- src/app/(dashboard)/orders/[id]/page.tsx:11-53
- src/app/(dashboard)/customers/[id]/page.tsx:16-31
- src/app/(dashboard)/cargo/[id]/page.tsx:12-101

**What I found.** None of these pages calls `auth()`; each starts querying immediately (e.g. orders/[id]/page.tsx:15-19). Two checks sit in front of them:

- middleware.ts:16-20
- the group layout, src/app/(dashboard)/layout.tsx:10-11

The bundled Next.js guide warns against relying on layouts: "Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation" (node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350-1352). In practice, middleware is the only line of defence.

Data rendered by these pages:

- the full `orders` row and all items
- customer phone, address and city
- carrier cost rates, cargo payments and cargo expenses
- the full `shop_settings` row

**Proposed fix.** Add one `requireSession()` / `requireRole()` helper in `src/lib/` that calls `auth()` and redirects or throws. Call it on the first line of every page and handler that reads data. Longer term, move queries into a server-only data-access module that performs the check itself, so a new page cannot forget it.
**Effort:** Small

#### F-03 — Any role can permanently delete orders, customers, expenses and cargo shipments

> **Status: fixed in working tree (not committed).** Permanent delete is owner-only; restore is manager+. See §1a for verification and the audit-row residual (F-14).

**Area:** A Access control
**Where:**

- src/app/api/trash/orders/[id]/route.ts:29-46
- src/app/api/trash/customers/[id]/route.ts:29-46
- src/app/api/trash/expenses/[id]/route.ts:29-46
- src/app/api/trash/cargo-shipments/[id]/route.ts:29-46
- UI: src/app/(dashboard)/settings/page.tsx:59 (Trash tab shown to every role) and :476

**What I found.** Each DELETE handler checks only `if (!session)` (line 31), then runs `db.delete(...)` (lines 35-38). There is no role check and no record of who deleted what. Rows without children are destroyed. Rows with children fail on a foreign key (`ON DELETE no action`, drizzle/0000_burly_darkhawk.sql:91-92, drizzle/0002_add_cargo_tables.sql:60-70) and return 500. The soft-delete handlers and the restore PATCH handlers are equally open to every role.

**Proposed fix.** Restrict hard delete to `owner` inside each handler, and write an audit row before deleting (F-14). Consider removing hard delete of financial records entirely and keeping soft delete only.
**Effort:** Small

#### F-04 — Money- and status-changing writes have no role authorisation

> **Status: fixed in working tree (not committed).** Enforced with `roleAtLeast()` per the permission matrix recorded in §1a. See §1a for verification and residuals (F-06, F-12, F-19).

**Area:** A Access control
**Where:** each handler below checks only `if (!session)`.

| Route | File:lines | What any role can change |
|---|---|---|
| `PATCH /api/orders/[id]` | orders/[id]/route.ts:38-67 | fees, paid flags, discount, status, exchange rate |
| `PATCH /api/orders/bulk` | orders/bulk/route.ts:14-38 | status of any number of orders |
| `POST /api/orders` | orders/route.ts:83-133 | create orders |
| `POST`/`PATCH`/`DELETE /api/order-items/[orderId]` | order-items/[orderId]/route.ts:25-119 | price and quantity |
| `POST`/`DELETE /api/cargo-payments/[cargoShipmentId]` | cargo-payments/[cargoShipmentId]/route.ts:41-93 | record or delete payments |
| `POST`/`DELETE /api/cargo-expenses/[cargoShipmentId]` | cargo-expenses/[cargoShipmentId]/route.ts:26-75 | shipment expenses |
| `POST`/`PATCH`/`DELETE /api/cargo-items/[cargoShipmentId]` | cargo-items/[cargoShipmentId]/route.ts:9-134 | weights and per-kg rates |
| `/api/cargo-categories` (+ `[id]`) | cargo-categories/route.ts:22-43, cargo-categories/[id]/route.ts:8-52 | default rates |
| `/api/cargo-shipments` (+ `[id]`) | cargo-shipments/route.ts:77-129, cargo-shipments/[id]/route.ts:97-143 | exchange rate, status |
| `/api/expenses` (+ `[id]`) | expenses/route.ts:86-112, expenses/[id]/route.ts:21-64 | expenses |
| `/api/customers` (+ `[id]`) | customers/route.ts:57-97, customers/[id]/route.ts:21-64 | customers |
| `PATCH /api/settings` | settings/route.ts:34-85 | shop identity and ID prefixes (see F-19) |

(All paths are under src/app/api/.)

**What I found.** Three roles exist (`owner`, `manager`, `staff`; src/validations/user.schema.ts:3), but only `/api/users/*` and `/api/reports` read the role. A staff account can mark every fee paid, delete a customer's payment, or change a shipment's exchange rate, and nothing records it (F-14). The sidebar hides Users and Reports from non-owners (src/components/layout/sidebar.tsx:36-37, 121-123), but that is UI only.

**Proposed fix.** Agree a permission matrix (see section 6), then enforce it with one `requireRole(session, [...])` call at the top of each handler. Start with payments, paid flags, settings and deletes.
**Effort:** Medium

#### F-05 — Stored XSS in print-label windows lets a staff user act with an owner's session

> **Status: fixed in working tree (not committed).** Every interpolated value is HTML-escaped with `escapeHtml()`. See §1a for verification and the CSP residual (F-17).

**Area:** J XSS
**Where:**

- src/components/customers/customer-table.tsx:26-42 (Print button at :103)
- src/components/orders/order-table.tsx:86-103 (Print button at :201)

**What I found.** The Print action does two things:

1. `window.open("", "_blank", ...)` opens an `about:blank` window that shares the app's origin.
2. `win.document.write` inserts `${c.name}`, `${c.phone}`, `${c.city}` or `${o.customerName}` as raw HTML.

React's escaping does not apply here, and customer name is free text up to 255 characters (src/validations/customer.schema.ts:4).

The attack: a staff user sets a customer's name to something like `<img src=x onerror="…">`. When an owner prints that label, the script runs in the app's origin with the owner's cookies. It can then call owner-only APIs, for example `POST /api/users` to create a new owner account.

**Proposed fix.** Build the print document with DOM APIs (`textContent`) or HTML-escape every interpolated value. Better still, render the label with a React component; label templates already exist in src/components/cargo/. Add a CSP (F-17) as a second layer.
**Effort:** Small

#### F-06 — Sessions cannot be revoked; role changes and deletions don't take effect

> **Status: fixed in working tree (not committed).** Session version checked on every `auth()`, 12-hour idle timeout, proxy moved to src/proxy.ts on Node.js. Migration 0009 must be applied before deploying. See §1a.

**Area:** C Authentication and session
**Where:**

- src/lib/auth.ts:47 (`session: { strategy: "jwt" }`) and :52-57 (role copied into the token at sign-in)
- src/app/api/users/[id]/route.ts:95-98 (role/password update) and :131 (delete)
- src/app/api/settings/route.ts:57-58 (self password change)
- src/components/layout/topbar.tsx:103, 114 (`signOut`)

**What I found.** The session is a self-contained encrypted JWT. It lasts 30 days and is re-issued on activity (node_modules/@auth/core/lib/init.js:38, 75-76), and `auth()` never re-reads the `users` table. As a result:

- A deleted user stays signed in.
- A demoted owner keeps owner rights, because handlers read `session.user.role` from the token.
- Changing a password after a suspected compromise does not sign the attacker out.
- `signOut` only clears the cookie in that one browser (node_modules/@auth/core/lib/actions/signout.js:13-28); a copied cookie keeps working until it expires.

**Proposed fix.**

1. Add a `sessionVersion` integer column to `users` and put it in the JWT at sign-in.
2. In the shared session helper, reload the user by id. Reject the session if the user is missing or the version differs, and take `role` from the database, not the token.
3. Increment the version on delete, role change, password change and "sign out everywhere".
4. Shorten `session.maxAge` to hours rather than 30 days.

**Effort:** Medium

#### F-07 — No rate limiting or lockout on login; username enumeration by timing

> **Status: fixed in working tree (not committed).** In-memory limits on failed sign-ins, constant-time miss via a dummy bcrypt hash, one 8-character password minimum. See §1a.

**Area:** H Rate limiting
**Where:** src/lib/auth.ts:21-44; src/app/api/auth/[...nextauth]/route.ts:1-2; src/validations/user.schema.ts:13, 27 (6-character minimum).

**What I found.**

- Nothing in the app limits sign-in attempts per IP or per username, and no proxy config in the repo does either.
- auth.ts:33 returns immediately when the username doesn't exist, but runs bcrypt (cost 12) when it does. The difference in response time tells an attacker which usernames are valid.
- Accounts created or reset by the owner may have 6-character passwords, which makes online guessing realistic.
- No write endpoint is rate limited either.

**Proposed fix.** Add per-IP and per-username attempt limits with backoff on `/api/auth/callback/credentials`:

- A Traefik `RateLimit` middleware needs no new npm dependency.
- An in-app limiter would need a store, which is a new dependency — ask before adding one.

Also compare against a dummy bcrypt hash when the user is not found, so timing is constant, and use one stronger minimum password length everywhere.
**Effort:** Medium

#### F-08 — Default owner account `admin` / `admin123`

> **Status: code fixed in working tree (not committed).** The seed has no default password and runs again. Confirming the production `admin` password is still the owner's job. See §1a.

**Area:** I Secrets
**Where:** src/db/seed.ts:44-58; memory/project_shop_manager.md:34 (tracked in git; lists the credentials as a setup step).

**What I found.** The seed creates user `admin` with role `owner` and password `admin123`, and only prints a warning. Nothing forces a password change at first login. I cannot see whether production still uses this password. If it does, anyone can sign in as owner, and F-07 means nothing slows the attempt.

**Proposed fix.** Confirm with the owner that the production `admin` account no longer uses this password. Change the seed to take the initial password from an environment variable (or generate one and print it once). Add a `mustChangePassword` flag enforced after sign-in.
**Effort:** Small

#### F-09 — Money stored and computed as floating point

**Area:** G Money
**Where — schema:**

- src/db/schema/orders.ts:11-16 (exchange_rate, shipping_fee, delivery_fee, cargo_fee, service_fee, product_discount)
- order-items.ts:9 (price)
- expenses.ts:7 (amount)
- cargo-payments.ts:12, 14 (amount, exchange_rate)
- cargo-expenses.ts:13 (amount)
- cargo-items.ts:29-31 (weight_kg and both rates)
- cargo-categories.ts:6-7 (rates)
- cargo-shipments.ts:12 (exchange_rate)

**Where — migrations:** drizzle/0000_burly_darkhawk.sql:18, 30, 44-49; drizzle/0002_add_cargo_tables.sql:4-5, 21, 35-37, 48, 50; drizzle/0005_cargo_expenses.sql:6.

**Where — code:** validators use `z.number()`. Arithmetic is plain JS in src/utils/calculations.ts, src/utils/invoiceCalculations.ts and src/utils/cargoCalculations.ts. cargoCalculations.ts:125-127 adds a 0.01 epsilon specifically to hide float error.

**What I found.** Every monetary column is `double precision` (IEEE-754), which breaks project rule 8. Sums over many rows drift, equality checks need epsilons, and `SUM` over doubles is not exact.

**Proposed fix.** Migrate one table at a time with hand-written migrations, running a reconciliation query before and after each:

- money columns to `numeric(14,2)` or integer minor units
- rates to `numeric(18,6)`

Read `numeric` values as strings in Drizzle, and do arithmetic in integer minor units or with a decimal library. A decimal library is a new dependency, so ask first.
**Effort:** Large

#### F-10 — Revenue and profit have conflicting definitions; percentage service fee counted as money

**Area:** G Money

**Where — "revenue" as shipping + delivery + cargo + service_fee (raw values):**

- src/app/api/dashboard/route.ts:73-74, 99-102
- src/app/api/reports/route.ts:50-58, 71-74, 113-116, 127-130, 135-138
- the same sum in JS: src/app/(dashboard)/customers/[id]/page.tsx:33-35, 88; src/app/(dashboard)/orders/page.tsx:78, 296; src/components/orders/order-table.tsx:89

**Where — "revenue" as the items subtotal instead:** src/utils/calculations.ts:60.

**Where — service fee treated as a rate** when `service_fee_type = 'percent'` (the column default, orders.ts:17):

- src/utils/invoiceCalculations.ts:38-39
- src/utils/calculations.ts:15-20
- src/components/orders/order-detail-client.tsx:345-348
- src/app/api/reports/route.ts:76-81

**Where — three "profit" formulas:**

- src/app/api/dashboard/route.ts:127: revenue minus **all-time** expenses (the expense query at :89 has no date filter, but revenue is date-filtered)
- src/app/api/reports/route.ts:75-87
- src/utils/calculations.ts:31-41

**Where — line amounts:** a null quantity counts as 1 on invoices (invoiceCalculations.ts:11) but as 0 everywhere else (calculations.ts:10; SQL `COALESCE(product_qty, 0)`).

**What I found.** Take an order with a 10 % service fee. The invoice charges 10 % of the items subtotal. The dashboard revenue, reports revenue, customer "total spent", order CSV export and print label add **10 currency units** instead. The dashboard, reports page, account book and customer page therefore show different totals for the same data.

**Proposed fix.** Agree the business definitions of subtotal, service-fee amount, customer total, revenue and profit with the owner. Implement them once in a server-side module with unit tests. Make every SQL aggregate use the same documented formula (or one Postgres view), and delete the other copies.
**Effort:** Medium

#### F-11 — Cargo payment balances depend on each browser's currency setting; most amounts have no currency

**Area:** G Money
**Where:**

- src/hooks/use-currency-prefs.ts:13-31 (localStorage, default `USD`)
- src/components/cargo/cargo-detail-client.tsx:127, 188, 192, 326, 340
- src/utils/cargoCalculations.ts:45-56, 101-131
- Schema: a currency column exists only on cargo_payments (src/db/schema/cargo-payments.ts:13)

**What I found.** `convertPaymentToBase` decides whether a payment needs converting by comparing `payment.currency` with `prefs.currencyCode`, which comes from the viewer's localStorage. Two staff members with different (or default) settings see different paid/partial/unpaid status and balances for the same customer. Orders, order items, expenses and cargo expenses store no currency at all, and the currency symbol shown is also per-browser.

**Proposed fix.** Store the shop's base currency once in `shop_settings`, send it from the server, and use only that value for calculations. localStorage can stay for display-only preferences. Add a currency column (or a documented, enforced "base currency only" rule) to every amount table.
**Effort:** Medium

### MEDIUM

#### F-12 — Financial data restricted in reports is served to every role elsewhere

**Area:** A Access control, E Data exposure
**Where:**

- src/app/api/reports/route.ts:12-16 allows owner and manager only.
- These return the same kinds of data with a session check only:
  - src/app/api/dashboard/route.ts:28-30
  - src/app/api/dashboard/orders/route.ts:27-29
  - src/app/api/dashboard/cargo/route.ts:15-17
  - src/app/api/account/route.ts:9-11
  - src/app/api/expenses/route.ts:9-11, 57-61
- src/components/layout/sidebar.tsx:36 shows Reports to owners only.

**What I found.** The reports handler explicitly blocks staff. A staff user still gets total revenue, profit and cargo owed, every order with its fees (`/api/dashboard/orders`, `/api/account`) and all expense totals. That makes three policies for the same data: API owner+manager, UI owner only, other APIs everyone.

**Proposed fix.** Decide who may see financial aggregates and carrier cost rates. Apply the same `requireRole` to reports, dashboard, account and expense statistics, and align the sidebar with the API.
**Effort:** Small

#### F-13 — No transactions, racy display-number generation, no idempotency

**Area:** G Money and data correctness
**Where:**

- src/app/api/orders/route.ts:96-126 (read prefix → read max → insert order → insert items)
- src/app/api/cargo-shipments/route.ts:90-122 (same pattern)
- src/app/api/customers/route.ts:71-90
- src/app/api/expenses/route.ts:97-106
- src/app/api/settings/route.ts:69-80 (select then insert-or-update)
- src/app/api/cargo-payments/[cargoShipmentId]/route.ts:56-67

`grep "transaction("` over src/ finds nothing.

**What I found.**

- **Partial commits.** If the items insert fails, the order or shipment is left with no items.
- **Duplicate numbers.** Two concurrent creates compute the same next number. For orders, customers and shipments the unique constraint turns one into a 500. `expenses.expense_id` has no unique constraint (src/db/schema/expenses.ts:5), so duplicates are stored.
- **Duplicate records on retry.** The submit button disables while a request is pending (src/components/ui/glass-button.tsx:21). But a 15-second client timeout (src/lib/axios.ts:9) followed by a manual retry creates a second order or a second cargo payment.

**Proposed fix.**

1. Wrap each multi-step create in `db.transaction`.
2. Generate display numbers from a Postgres sequence per prefix, or inside the transaction with a retry on unique violation.
3. Accept a client-generated idempotency key per form submission, stored under a unique constraint, for orders and payments.

**Effort:** Medium

#### F-14 — No audit trail

**Area:** K Logging and audit
**Where:** the whole codebase; there is no audit table in src/db/schema/index.ts:1-11.

**What I found.** Nothing records who created, changed, restored or deleted an order, fee flag, payment, expense, user or setting, or what the values were before and after. `orders.updatedAt` is not even set on a single-order PATCH (src/app/api/orders/[id]/route.ts:55-58). Combined with F-03 and F-04, misuse by any account cannot be detected.

**Proposed fix.** Add an append-only `audit_log` table recording `at`, `user_id`, `role`, `action`, `entity`, `entity_id`, `before` (jsonb), `after` (jsonb) and `ip`. Write to it in the same transaction as each money, status, delete or user change, and deny UPDATE/DELETE on it at the database-role level.
**Effort:** Medium

#### F-15 — Numeric inputs have no upper bounds; dates and some strings unvalidated

**Area:** F Input validation
**Where:**

- src/validations/order.schema.ts:10-13, 19-31, 40
- src/validations/cargo.schema.ts:22-23, 37-39, 53-55, 64-68, 77-79, 92
- src/validations/expense.schema.ts:15
- src/app/api/orders/bulk/route.ts:10

**What I found.** Every amount is `.positive()` or `.min(0)`, so negative values are rejected with a 400 — good. Nothing else is bounded:

- A fee of `1e300`, a 5000 % service fee, a discount larger than the order, or an exchange rate of `1e12` are all accepted and stored.
- Very large doubles can make `SUM` overflow with "value out of range", breaking the dashboard and reports for everyone.
- `orderDate`, `shipmentDate`, `arrivedDate`, `userWithdrawDate`, `departureDate` and `arrivalDate` are plain `z.string()`. Bad values reach Postgres and return 500.
- `productUrl`, order `note` and `orderFrom` have no maximum length.
- The `items` and bulk `ids` arrays are unbounded.

**Proposed fix.**

- Add realistic `.max()` bounds to every amount, rate and quantity; cap percentages at 100.
- Add the date regex already used by the expense and payment schemas.
- Validate URLs as http/https only.
- Put `.max()` on every string and array.

**Effort:** Small

#### F-16 — Open redirect after login

**Area:** C Authentication
**Where:** src/app/(auth)/login/page.tsx:22, 44.

**What I found.** `callbackUrl` is read from the query string and passed to `router.push`. Next.js blocks `javascript:` URLs (node_modules/next/dist/client/components/app-router-instance.js:343-349) but treats an absolute or protocol-relative URL as an external navigation (:231). A link to `/login?callbackUrl=https://evil.example/` sends a freshly signed-in user to a look-alike page, for example one saying "session expired, sign in again".

**Proposed fix.** Accept `callbackUrl` only if it starts with a single `/` (not `//`), or resolve it against `location.origin` and require the same origin. Otherwise fall back to `/dashboard`.
**Effort:** Small

#### F-17 — No security response headers

**Area:** J Headers
**Where:** next.config.ts:5-14 sets headers only for `/sw.js`, and `poweredByHeader` is left at its default (enabled).

**What I found.** The app sets none of: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options or `frame-ancestors`, X-Content-Type-Options, Referrer-Policy. It does send `X-Powered-By: Next.js`. The admin UI can be framed (clickjacking), and there is no CSP to contain F-05. Traefik may add some of these headers; nothing in the repo shows it.

**Proposed fix.** Add a `headers()` rule for all paths with:

- HSTS
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`

Set `poweredByHeader: false`. Add a CSP afterwards; the two inline scripts in src/app/layout.tsx:97-98 will need hashes or nonces.
**Effort:** Small

#### F-18 — Password and role changes for other users need no re-authentication; weak password policy

**Area:** C Authentication
**Where:** src/app/api/users/[id]/route.ts:35-107 (PATCH) and :114-135 (DELETE); src/validations/user.schema.ts:11-14, 25-30 (minimum 6); src/validations/settings.schema.ts:16 (minimum 8 for self-service).

**What I found.** An owner session can reset another owner's password, rename them, demote them or delete them, with no current-password prompt. That includes a session obtained through F-05, F-08 or a copied cookie (F-06). Only changing your own role (:58) and deleting yourself (:127) are blocked. Passwords set by an owner can be 6 characters.

**Proposed fix.** Require the acting owner's current password (checked with bcrypt) for password resets, role changes and deletes of other users, and invalidate the target user's sessions (F-06). Use one password policy for every path.
**Effort:** Small

#### F-19 — Any role can break record creation through ID prefixes

**Area:** F Validation, G Correctness
**Where:**

- src/validations/settings.schema.ts:8-10
- src/app/api/settings/route.ts:34-80 (no role check)
- src/app/api/orders/route.ts:101-106
- src/app/api/cargo-shipments/route.ts:94-99
- src/app/api/customers/route.ts:78-84

**What I found.** Prefixes accept any characters, including `-`, `%` and `_`; only trailing dashes are stripped. Display numbers are computed with `cast(split_part(order_id, '-', 2) as integer)`. How it breaks:

1. Someone sets the order prefix to `SS-A`.
2. The next order is created as `SS-A-00001`.
3. Every order after that evaluates `cast('A' as integer)`, fails, and returns 500 for everyone.

Customer numbering takes the maximum over **all** customers regardless of prefix (customers/route.ts:81-83), so one existing customer id with a non-numeric second part blocks customer creation.

**Proposed fix.** Restrict prefixes to `^[A-Z0-9]{1,10}$`, limit settings changes to owners, and replace `split_part` numbering with sequences (F-13).
**Effort:** Small

#### F-20 — Migration journal timestamps out of order; Drizzle silently skips older entries

**Area:** N Maintainability
**Where:** drizzle/meta/_journal.json; node_modules/drizzle-orm/pg-core/dialect.js:56-62.

**What I found.** `drizzle-kit migrate` reads the newest `created_at` in `drizzle.__drizzle_migrations` and applies only journal entries with a larger `when`. The journal is not in order:

| Journal idx | `when` | Date |
|---|---|---|
| 0 | 1774588193390 | 2026-03-27 |
| 1 | 1743379200000 | 2025-03-31 |
| 2 | 1753420800000 | 2025-07-25 |

Later entries use hand-picked midnight timestamps. Consequences:

- On any database where 0000 was applied before 0001 and 0002 were added, those two were skipped without an error.
- Any future hand-written migration with a `when` below 1786579200000 (2026-08-13) will also be skipped silently.

**Proposed fix.** Read (don't modify) `drizzle.__drizzle_migrations` in production to see what actually ran. From now on, set each new `when` to the current time in milliseconds, and add a check that journal `when` values strictly increase.
**Effort:** Small

#### F-21 — Docker build can bake `.env` into the image

**Area:** I Secrets and configuration
**Where:** Dockerfile:15 (`COPY . .`) and :36 (copies `.next/standalone` into the runner); no `.dockerignore`. A local build shows `.next/standalone/.env` exists.

**What I found.** Next.js standalone output copies `.env` into `.next/standalone`, and the runner stage copies that directory into the final image. Any image built from a working copy that contains `.env` or `.env.local` therefore carries `DATABASE_URL` and `NEXTAUTH_SECRET` in a layer. That includes `docker compose build` run locally (docker-compose.yml:3-4). Coolify normally builds from a git clone, where `.env*` is ignored, so production images are probably clean — not confirmed.

**Proposed fix.** Add a `.dockerignore` that excludes `.env*`, `.next`, `node_modules`, `.git`, `memory` and `.claude`, and supply secrets only at runtime. If an image built with `.env` was ever pushed to a registry, rotate those secrets.
**Effort:** Small

### LOW

#### F-22 — Error responses and logs expose SQL and parameters

**Area:** K Logging
**Where — responses:**

- src/app/api/account/route.ts:86-88
- src/app/api/dashboard/route.ts:150-159
- src/app/api/dashboard/orders/route.ts:133-135
- src/app/api/dashboard/cargo/route.ts:81-83
- src/app/api/reports/route.ts:291-293

**Where — logs:**

- src/app/api/users/route.ts:106
- src/app/api/users/[id]/route.ts:109
- src/app/api/settings/route.ts:82
- src/app/(dashboard)/orders/[id]/page.tsx:13 (a `console.log` on every render)

**What I found.** Drizzle wraps database errors as `DrizzleQueryError`, whose message is `Failed query: <sql>\nparams: <params>` (node_modules/drizzle-orm/errors.js:10-13). Five handlers send that message, and sometimes `cause`, to the browser. Handlers that write `password_hash` log the whole error, so a failed insert or update puts a bcrypt hash in the server logs. I found no log statement that prints a plaintext password, a session token or a request body.

**Proposed fix.** Return a generic message plus a request id, and log the error code and request id instead of the whole error on user and settings routes. Remove the per-render `console.log`.
**Effort:** Small

#### F-23 — Public tracking page: cancelled shipments stay public; full shop row sent to anonymous users

**Area:** E Data exposure
**Where:** src/app/t/[code]/page.tsx:39, 71, 77-111; src/components/cargo/public-tracking-status.ts:11-13.

**What I found.** By design, anyone holding the 12-character code sees the consignee's name, phone, address and city, plus the item note (labelled "Handling note"). The data is correctly narrowed into a DTO. Three problems remain:

- The page closes only for `delivered`. A `cancelled` shipment keeps publishing personal data for as long as the sticker exists.
- The full `shop_settings` row, including internal ID prefixes, is sent to anonymous visitors (:71, :85, :111).
- The code has about 59 bits of entropy. The alphabet has 31 characters, not the 32 stated in src/lib/public-code.ts:10-14. Brute force is still impractical.

**Proposed fix.** Also close the page for `cancelled` (and some period after arrival). Pass only the shop's name, phone and logo to the public components. Make sure staff know the item note is public.
**Effort:** Small

#### F-24 — Weak body handling in DELETE and bag-edit handlers

**Area:** F Input validation
**Where:**

- src/app/api/order-items/[orderId]/route.ts:102-119
- src/app/api/cargo-items/[cargoShipmentId]/route.ts:90-105 and 117-134
- src/app/api/cargo-payments/[cargoShipmentId]/route.ts:76-93
- src/app/api/cargo-expenses/[cargoShipmentId]/route.ts:58-75

**What I found.**

- `await req.json()` runs outside any try/catch, so a malformed body throws an unhandled error (500).
- `itemId`, `paymentId` and `expenseId` are not type-checked.
- The DELETE handlers don't filter `deletedAt IS NULL` and report success even when nothing matched.
- The bag-move and bag-rename branches also update soft-deleted items.

**Proposed fix.** Parse the body with a small zod schema inside the try block, add `isNull(deletedAt)` to the updates, and return 404 when no row changed.
**Effort:** Small

#### F-25 — Child records can be attached to deleted or non-existent parents

**Area:** G Data integrity
**Where:**

- src/app/api/order-items/[orderId]/route.ts:40-47
- src/app/api/cargo-items/[cargoShipmentId]/route.ts:24-36
- src/app/api/cargo-payments/[cargoShipmentId]/route.ts:56-67
- src/app/api/cargo-expenses/[cargoShipmentId]/route.ts:41-49
- src/app/api/cargo-shipments/route.ts:109-121

**What I found.** The parent id comes from the URL and is inserted without checking that the parent exists and isn't soft-deleted. A payment can be recorded against a shipment sitting in the trash. A non-existent id surfaces as a foreign-key error and a 500.

**Proposed fix.** Inside the new transaction (F-13), select the parent with `deletedAt IS NULL` (using `FOR UPDATE` where totals matter) and return 404 if it is missing.
**Effort:** Small

#### F-26 — Query-string parsing edge cases

**Area:** F Input validation
**Where:** src/app/api/orders/route.ts:15-16 (same pattern in customers/route.ts:15-16, expenses/route.ts:15-16, cargo-shipments/route.ts:15-16 and users/route.ts:19-20); src/app/api/users/route.ts:77-81; src/app/api/users/[id]/route.ts:67-76.

**What I found.**

- `Number("abc")` is `NaN`, and `Math.max(1, NaN)` is also `NaN`, so `?page=abc` returns a 500.
- `%` and `_` in search terms act as wildcards.
- The username-exists check uses `ilike`, so `_` matches any character and can report a false conflict.

Every value is a bound parameter, so none of this is SQL injection.

**Proposed fix.** Parse query strings with zod (`z.coerce.number().int().min(1).max(…)`), escape `%` and `_` in search terms, and compare usernames with lower-cased equality.
**Effort:** Small

#### F-27 — Product URL rendered as a link without scheme validation

**Area:** J XSS
**Where:** src/components/orders/order-items-section.tsx:196; src/validations/order.schema.ts:10.

**What I found.** `productUrl` accepts any string and is rendered as `<a href>`. React 19 blocks `javascript:` URLs, so script execution is mitigated. `data:` and look-alike phishing links still get through.

**Proposed fix.** Validate `productUrl` as http/https in the schema and render anything else as plain text.
**Effort:** Small

#### F-28 — CSV export is not escaped

**Area:** J Export
**Where:** src/app/(dashboard)/orders/page.tsx:70-80.

**What I found.** Values are wrapped in quotes without doubling embedded quotes. Cells starting with `=`, `+`, `-` or `@` are not neutralised, so a customer name can inject a spreadsheet formula when the file is opened. The exported total also uses the raw service-fee sum from F-10.

**Proposed fix.** Double embedded quotes, and prefix cells that start with a formula character with `'`.
**Effort:** Small

#### F-29 — Environment validation is never run

**Area:** I Configuration
**Where:** src/env.ts:1-19 (nothing imports it); src/db/index.ts:5; drizzle.config.ts:8.

**What I found.** `env.ts` validates `DATABASE_URL`, `NEXTAUTH_SECRET` (at least 16 characters) and `NEXTAUTH_URL`, but nothing imports it, so a missing or short secret isn't caught at startup. There are no insecure fallback values such as `|| 'dev'`; `DATABASE_URL!` is only a non-null assertion.

**Proposed fix.** Import `env` in src/db/index.ts and src/lib/auth.ts, and pass the secret to NextAuth explicitly.
**Effort:** Small

#### F-30 — Backfilled tracking codes use a non-cryptographic generator

**Area:** E Public code
**Where:** drizzle/0007_cargo_item_public_code.sql:10-12.

**What I found.** Cargo items created before migration 0007 got `upper(substr(md5(random()::text || clock_timestamp()::text || id), 1, 16))`. Postgres `random()` is not a cryptographically secure generator. Predicting codes is unlikely in practice, but these codes are the only thing protecting consignee personal data (F-23).

**Proposed fix.** Either regenerate codes for those older rows with `newCargoItemPublicCode()` (which means reprinting their labels), or explicitly accept the residual risk.
**Effort:** Small

#### F-31 — docker-compose exposes the app port directly

**Area:** I Deployment
**Where:** docker-compose.yml:6-7, 12.

**What I found.** `ports: "3000:3000"` publishes the container on every host interface, and `AUTH_TRUST_HOST=true` trusts forwarded headers. If this file is used on the Coolify host and port 3000 isn't firewalled, the app is reachable over plain HTTP, bypassing Traefik and TLS.

**Proposed fix.** Remove the `ports` mapping (Traefik reaches the container over the Docker network) or bind it to `127.0.0.1`.
**Effort:** Small

#### F-32 — Dependency hygiene: advisories not reachable from this code

**Area:** M Dependencies
**Where:** package.json:33 (axios), :38 (drizzle-orm), :41 (nanoid), :43 (next-auth, which bundles @auth/core 0.41.0).

**What I found.** These have advisories but, as far as I can tell, none is reachable from this code. The reasons are in Appendix B, section M.

**Proposed fix.** On a branch, apply the in-range fixes (`npm audit fix`), then build and smoke-test. Move next-auth to a beta that bundles a patched @auth/core.
**Effort:** Small

---

## 4. Fixes and effort (suggested order)

Each finding in section 3 includes its proposed fix. This table suggests an order of work.

| Order | Finding(s) | Effort | Why this order |
|---|---|---|---|
| 1 | F-01 | Small | Closes published auth-bypass paths |
| 2 | F-02 | Small | Removes reliance on middleware alone; independent of F-01 |
| 3 | F-08 | Small | Confirm the default owner password is gone |
| 4 | F-05 | Small | Removes the staff-to-owner escalation path |
| 5 | F-03, F-04, F-12 | Medium | Needs a permission matrix first (section 6) |
| 6 | F-06 | Medium | Makes role changes and user removal effective |
| 7 | F-07, F-18 | Medium, Small | Login hardening |
| 8 | F-16, F-17, F-19, F-21, F-31 | Small each | Quick hardening |
| 9 | F-14 | Medium | Audit log; should land before or with F-13 |
| 10 | F-13, F-25 | Medium, Small | Transactions, idempotency, parent checks |
| 11 | F-10, F-11 | Medium | Needs the owner to confirm business definitions |
| 12 | F-15, F-24, F-26 | Small each | Validation tightening |
| 13 | F-20 | Small | Check production migration state before the next migration |
| 14 | F-09 | Large | Numeric migration; easier once F-10 has consolidated the formulas |
| 15 | F-22, F-23, F-27, F-28, F-29, F-30, F-32 | Small each | Low-risk cleanup |

---

## 5. Entry-point inventory

**Server actions:** none. `grep` for `"use server"` / `'use server'` over `src/` and `middleware.ts` finds nothing.

**Column meanings:**

- **Auth check** — calls `auth()` and rejects when there is no session, before any database access.
- **Shop-scoped** — N/A throughout: the schema has no shop or owner column, so there is nothing to scope by (Appendix B, section B).
- **Validated** — `yes` = zod schema on the body; `partial` = some input parsed or whitelisted by hand; `no` = input used as-is (still bound as SQL parameters); `—` = the handler takes no input.
- **Role check** is an extra column added for clarity.

### Route handlers (all under `src/app/api/`)

| # | Name | File:line | Auth check | Shop-scoped | Validated | Writes | Role check |
|---|---|---|---|---|---|---|---|
| 1 | GET /api/auth/[...nextauth] | auth/[...nextauth]/route.ts:2 | n/a (Auth.js endpoint) | N/A | yes (library) | no | — |
| 2 | POST /api/auth/[...nextauth] (sign-in/out) | auth/[...nextauth]/route.ts:2 | n/a (sign-in endpoint) | N/A | yes (lib/auth.ts:22) | no DB writes (sets cookie) | — |
| 3 | GET /api/account | account/route.ts:9 | yes | N/A | — | no | none |
| 4 | GET /api/users | users/route.ts:10 | yes | N/A | partial | no | owner |
| 5 | POST /api/users | users/route.ts:59 | yes | N/A | yes | yes | owner |
| 6 | GET /api/users/[id] | users/[id]/route.ts:9 | yes | N/A | no | no | owner |
| 7 | PATCH /api/users/[id] | users/[id]/route.ts:35 | yes | N/A | yes | yes | owner |
| 8 | DELETE /api/users/[id] | users/[id]/route.ts:114 | yes | N/A | no | yes (hard delete) | owner |
| 9 | GET /api/settings | settings/route.ts:9 | yes | N/A | — | no | none |
| 10 | PATCH /api/settings | settings/route.ts:34 | yes | N/A | yes | yes | none |
| 11 | GET /api/orders | orders/route.ts:9 | yes | N/A | partial | no | none |
| 12 | POST /api/orders | orders/route.ts:83 | yes | N/A | yes (unbounded) | yes | none |
| 13 | GET /api/orders/[id] | orders/[id]/route.ts:8 | yes | N/A | no | no | none |
| 14 | PATCH /api/orders/[id] | orders/[id]/route.ts:38 | yes | N/A | yes | yes | none |
| 15 | DELETE /api/orders/[id] | orders/[id]/route.ts:69 | yes | N/A | no | yes (soft) | none |
| 16 | PATCH /api/orders/bulk | orders/bulk/route.ts:14 | yes | N/A | yes | yes | none |
| 17 | GET /api/order-items/[orderId] | order-items/[orderId]/route.ts:9 | yes | N/A | no | no | none |
| 18 | POST /api/order-items/[orderId] | order-items/[orderId]/route.ts:25 | yes | N/A | yes | yes | none |
| 19 | PATCH /api/order-items/[orderId] | order-items/[orderId]/route.ts:56 | yes | N/A | partial (itemId unchecked) | yes | none |
| 20 | DELETE /api/order-items/[orderId] | order-items/[orderId]/route.ts:102 | yes | N/A | no | yes (soft) | none |
| 21 | GET /api/customers | customers/route.ts:9 | yes | N/A | partial | no | none |
| 22 | POST /api/customers | customers/route.ts:57 | yes | N/A | yes | yes | none |
| 23 | GET /api/customers/[id] | customers/[id]/route.ts:8 | yes | N/A | no | no | none |
| 24 | PATCH /api/customers/[id] | customers/[id]/route.ts:21 | yes | N/A | yes | yes | none |
| 25 | DELETE /api/customers/[id] | customers/[id]/route.ts:49 | yes | N/A | no | yes (soft) | none |
| 26 | GET /api/expenses | expenses/route.ts:9 | yes | N/A | partial | no | none |
| 27 | POST /api/expenses | expenses/route.ts:86 | yes | N/A | yes | yes | none |
| 28 | GET /api/expenses/[id] | expenses/[id]/route.ts:8 | yes | N/A | no | no | none |
| 29 | PATCH /api/expenses/[id] | expenses/[id]/route.ts:21 | yes | N/A | yes | yes | none |
| 30 | DELETE /api/expenses/[id] | expenses/[id]/route.ts:49 | yes | N/A | no | yes (soft) | none |
| 31 | GET /api/trash | trash/route.ts:7 | yes | N/A | partial | no | none |
| 32 | PATCH /api/trash/orders/[id] | trash/orders/[id]/route.ts:8 | yes | N/A | no | yes (restore) | none |
| 33 | DELETE /api/trash/orders/[id] | trash/orders/[id]/route.ts:29 | yes | N/A | no | yes (hard delete) | none |
| 34 | PATCH /api/trash/customers/[id] | trash/customers/[id]/route.ts:8 | yes | N/A | no | yes (restore) | none |
| 35 | DELETE /api/trash/customers/[id] | trash/customers/[id]/route.ts:29 | yes | N/A | no | yes (hard delete) | none |
| 36 | PATCH /api/trash/expenses/[id] | trash/expenses/[id]/route.ts:8 | yes | N/A | no | yes (restore) | none |
| 37 | DELETE /api/trash/expenses/[id] | trash/expenses/[id]/route.ts:29 | yes | N/A | no | yes (hard delete) | none |
| 38 | PATCH /api/trash/cargo-shipments/[id] | trash/cargo-shipments/[id]/route.ts:8 | yes | N/A | no | yes (restore) | none |
| 39 | DELETE /api/trash/cargo-shipments/[id] | trash/cargo-shipments/[id]/route.ts:29 | yes | N/A | no | yes (hard delete) | none |
| 40 | GET /api/cargo-categories | cargo-categories/route.ts:9 | yes | N/A | — | no | none |
| 41 | POST /api/cargo-categories | cargo-categories/route.ts:22 | yes | N/A | yes | yes | none |
| 42 | PATCH /api/cargo-categories/[id] | cargo-categories/[id]/route.ts:8 | yes | N/A | yes | yes | none |
| 43 | DELETE /api/cargo-categories/[id] | cargo-categories/[id]/route.ts:37 | yes | N/A | no | yes (soft) | none |
| 44 | GET /api/cargo-shipments | cargo-shipments/route.ts:9 | yes | N/A | partial | no | none |
| 45 | POST /api/cargo-shipments | cargo-shipments/route.ts:77 | yes | N/A | yes (dates unchecked) | yes | none |
| 46 | GET /api/cargo-shipments/[id] | cargo-shipments/[id]/route.ts:9 | yes | N/A | no | no | none |
| 47 | PATCH /api/cargo-shipments/[id] | cargo-shipments/[id]/route.ts:97 | yes | N/A | yes | yes | none |
| 48 | DELETE /api/cargo-shipments/[id] | cargo-shipments/[id]/route.ts:128 | yes | N/A | no | yes (soft) | none |
| 49 | POST /api/cargo-items/[cargoShipmentId] | cargo-items/[cargoShipmentId]/route.ts:9 | yes | N/A | yes | yes | none |
| 50 | PATCH /api/cargo-items/[cargoShipmentId] | cargo-items/[cargoShipmentId]/route.ts:51 | yes | N/A | partial | yes | none |
| 51 | DELETE /api/cargo-items/[cargoShipmentId] | cargo-items/[cargoShipmentId]/route.ts:117 | yes | N/A | no | yes (soft) | none |
| 52 | GET /api/cargo-payments/[cargoShipmentId] | cargo-payments/[cargoShipmentId]/route.ts:9 | yes | N/A | no | no | none |
| 53 | POST /api/cargo-payments/[cargoShipmentId] | cargo-payments/[cargoShipmentId]/route.ts:41 | yes | N/A | yes | yes | none |
| 54 | DELETE /api/cargo-payments/[cargoShipmentId] | cargo-payments/[cargoShipmentId]/route.ts:76 | yes | N/A | no | yes (soft) | none |
| 55 | GET /api/cargo-expenses/[cargoShipmentId] | cargo-expenses/[cargoShipmentId]/route.ts:9 | yes | N/A | no | no | none |
| 56 | POST /api/cargo-expenses/[cargoShipmentId] | cargo-expenses/[cargoShipmentId]/route.ts:26 | yes | N/A | yes | yes | none |
| 57 | DELETE /api/cargo-expenses/[cargoShipmentId] | cargo-expenses/[cargoShipmentId]/route.ts:58 | yes | N/A | no | yes (soft) | none |
| 58 | GET /api/dashboard | dashboard/route.ts:28 | yes | N/A | partial | no | none |
| 59 | GET /api/dashboard/orders | dashboard/orders/route.ts:27 | yes | N/A | partial | no | none |
| 60 | GET /api/dashboard/cargo | dashboard/cargo/route.ts:15 | yes | N/A | partial | no | none |
| 61 | GET /api/reports | reports/route.ts:8 | yes | N/A | partial | no | owner, manager |

### Server components that read the database

| Name | File:line | Auth check | Shop-scoped | Validated | Writes | Role check |
|---|---|---|---|---|---|---|
| (dashboard) layout | src/app/(dashboard)/layout.tsx:9 | yes (:10-11) | N/A | — | no | none |
| /orders/[id] page | src/app/(dashboard)/orders/[id]/page.tsx:11 | **no** (middleware only) | N/A | no | no | none |
| /customers/[id] page | src/app/(dashboard)/customers/[id]/page.tsx:16 | **no** (middleware only) | N/A | no | no | none |
| /cargo/[id] page | src/app/(dashboard)/cargo/[id]/page.tsx:12 | **no** (middleware only) | N/A | no | no | none |
| /t/[code] page | src/app/t/[code]/page.tsx:27 | no (public by design; the code is the credential) | N/A | no | no | n/a |

---

## 6. Things I could not determine

1. **Whether the Next.js bypass advisories work against this app (F-01).** I didn't read the advisory text or try a request. To be sure: read GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6 and GHSA-492v-c6pp-mqqv, then test against a local `next build && next start` with no cookie, requesting `/orders/<real id>` in the prefetch/segment form each advisory describes.
2. **The intended permission model.** Nothing in the repo says what `manager` and `staff` may do. Open questions: should staff see revenue, profit and carrier cost rates; record or delete payments; change settings; purge the trash? The reports handler (owner+manager) and the sidebar (owner only) already disagree. F-03, F-04 and F-12 need the owner's answer.
3. **Intended tenancy.** CLAUDE.md talks about "shop owners" and about inventory and invoicing. The schema is single-tenant, with no inventory tables and no invoice table. I assumed one deployment per shop. If several shops are meant to share one database, every entry point in section 5 becomes an IDOR and item B becomes CRITICAL.
4. **Production facts I can't see:**
   - whether `NEXTAUTH_URL` is https (this controls the cookie's `Secure` flag)
   - whether Traefik adds security headers, HSTS or rate limiting
   - whether the `admin`/`admin123` account still exists
   - whether Coolify builds with the Dockerfile or with docker-compose, whether its build context ever contains `.env`, and whether port 3000 is reachable from outside
5. **Which migrations production actually applied (F-20).** Needs a read-only query of `drizzle.__drizzle_migrations`.
6. **Business definitions of revenue, profit and service fee (F-10).** My reading comes from src/utils/invoiceCalculations.ts, which treats `serviceFee` as a percentage when `serviceFeeType` is `percent`. The owner needs to confirm what the dashboard's "revenue" is supposed to include.
7. **Whether the cargo-item note is meant to be public (F-23).** The public view labels it "Handling note", which suggests it is.
8. **How the middleware file is detected in production.** `middleware.ts` sits at the repo root while the app lives in `src/app`. Next.js's detection code in node_modules/next/dist/build/index.js:615-634 scans the app directory's parent (`src/`). The local Turbopack build did compile the root file (.next/server/middleware-manifest.json lists it with this matcher). Checking the production build output would confirm it is picked up there too. Next 16 also marks the `middleware` name as deprecated in favour of `proxy`.
9. **Reachability of the `sharp` / image-optimiser advisories.** `next/image` isn't used and no remote image patterns are configured, so `/_next/image` should only process local `/public` files. I did not test that endpoint.
10. **Sibling applications on the same site.** With `SameSite=Lax` cookies, other apps on subdomains of the same registrable domain (common on a Coolify host) are treated as same-site. That weakens CSRF protection. I don't know the production domain layout.
11. **Service-worker caching of the signed-in page shell.** public/sw.js:7-11 pre-caches `/` at install, and :51-53 serves it when offline. If `/` resolved to the signed-in dashboard at install time, a shared device could show the previous user's name and role offline. I didn't test this in a browser, so it isn't listed as a finding.
12. **Auth.js logging of failed sign-ins.** I found no application log that prints credentials. I didn't trace every Auth.js internal logger path.

---

## Appendix A — System map (Step 1)

### Route tree (`src/app`)

**Pages**

| Path | File | Type |
|---|---|---|
| `/` | page.tsx | server; redirects to `/dashboard` |
| `/login` | (auth)/login/page.tsx | client |
| `/t/[code]` | t/[code]/page.tsx (+ not-found.tsx) | server; public; `dynamic = "force-dynamic"` |
| `/dashboard` | (dashboard)/dashboard/page.tsx | client |
| `/account` | (dashboard)/account/page.tsx | client |
| `/customers` | (dashboard)/customers/page.tsx | client |
| `/customers/[id]` | (dashboard)/customers/[id]/page.tsx | server |
| `/orders` | (dashboard)/orders/page.tsx | client |
| `/orders/[id]` | (dashboard)/orders/[id]/page.tsx | server; renders OrderDetailClient |
| `/cargo` | (dashboard)/cargo/page.tsx | client |
| `/cargo/[id]` | (dashboard)/cargo/[id]/page.tsx | server; renders CargoDetailClient |
| `/expenses` | (dashboard)/expenses/page.tsx | client |
| `/reports` | (dashboard)/reports/page.tsx | client |
| `/users` | (dashboard)/users/page.tsx | client |
| `/settings` | (dashboard)/settings/page.tsx | client |

**Layouts:** app/layout.tsx (root; inline theme and service-worker scripts) and (dashboard)/layout.tsx (server; calls `auth()`, loads shop settings). Each dashboard route has a `loading.tsx`. app/manifest.ts serves `/manifest.webmanifest`.

**Route handlers:** 29 files, 61 method handlers (section 5).

**Server actions:** none.

### Database

- Drizzle ORM 0.45.1 over postgres-js 3.4.8.
- The connection is created once in src/db/index.ts:5-19 from `DATABASE_URL` (cached on `globalThis` outside production).
- 11 tables defined in src/db/schema/*.ts.
- Migrations are hand-written SQL in drizzle/*.sql with a manually edited drizzle/meta/_journal.json.

### Authentication

- Auth.js through next-auth 5.0.0-beta.30 (bundles @auth/core 0.41.0), Credentials provider, bcryptjs 3.0.3.
- Configured in src/lib/auth.ts.
- Session strategy is JWT, stored in an httpOnly cookie.
- Server side, the session is read with `auth()` in every route handler, in (dashboard)/layout.tsx and in middleware.ts.
- Client side, it is read through `SessionProvider` (src/components/providers.tsx:38) and `useSession()` (sidebar, topbar, command palette, users and dashboard pages).

### Exact installed versions (`npm ls`)

| Package | Version |
|---|---|
| next | 16.2.1 |
| react / react-dom | 19.2.4 |
| drizzle-orm | 0.45.1 |
| drizzle-kit (dev) | 0.31.10 |
| next-auth | 5.0.0-beta.30 |
| @auth/core (bundled) | 0.41.0 |
| postgres | 3.4.8 |
| bcryptjs | 3.0.3 |
| zod | 4.3.6 |
| @tanstack/react-query | 5.95.2 |
| axios | 1.13.6 |

### middleware.ts

**Location.** A `middleware.ts` exists at the repository root. Next 16 renamed this file convention to `proxy` and marks `middleware` as deprecated (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11). It is compiled into the current build (.next/server/middleware-manifest.json).

**What it does:**

1. Wraps `auth()` (middleware.ts:4).
2. A visitor who isn't signed in and requests anything other than `/login*`, `/api/auth*` or `/t/*` is redirected to `/login?callbackUrl=<path>` (:16-20).
3. A signed-in user who requests `/login*` is redirected to `/dashboard` (:22-24).

**Matcher (:29-33):** everything except `_next/static`, `_next/image`, `favicon.ico`, `icons/`, `sw.js`, `manifest.webmanifest` and `browserconfig.xml`.

### Deployment

Dockerfile (node:22-alpine, standalone output, runs as a non-root user) and docker-compose.yml. CLAUDE.md says Coolify behind Traefik; no Traefik configuration is in the repo.

---

## Appendix B — Checklist results, item by item

### A. Server action and route handler access control

- **Server actions:** not applicable — none exist.
- **Route handlers:** all 59 non-Auth.js method handlers start with `const session = await auth(); if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });` before any database access. Example: src/app/api/cargo-payments/[cargoShipmentId]/route.ts:45-46. The per-method list is in section 5.
- **Writes with no authentication:** none. Writes with no **authorisation** (role) check: 35 of the 38 write handlers — every write except the three `/api/users` writes (F-03, F-04).
- **Auth only in a parent page or layout:** yes, for three pages (F-02). Not applicable to server actions.
- **Role checks that do exist:** users/route.ts:13, 62; users/[id]/route.ts:15, 41, 120 (owner); reports/route.ts:13-16 (owner or manager).

### B. Tenant / shop isolation (IDOR)

- **Not applicable in the multi-tenant sense.** No table has a shop or owner column (src/db/schema/*.ts). `shop_settings` is one row with id `singleton` (shop-settings.ts:4). Every query reads the whole table, so one deployment is one shop, and any signed-in user can read or change any record.
- **Handlers that load a record by id** (none scoped by an owner, only by `deletedAt`):
  - orders/[id] GET/PATCH/DELETE
  - customers/[id] ×3, expenses/[id] ×3, cargo-shipments/[id] ×3
  - cargo-categories/[id] ×2, users/[id] ×3
  - trash/*/[id] ×8
  - order-items, cargo-items, cargo-payments and cargo-expenses (parent id plus child id)
  - the three `[id]` pages and `/t/[code]`
- **Child records are scoped to their parent,** e.g. order-items/[orderId]/route.ts:84-89 and cargo-payments/[cargoShipmentId]/route.ts:90. That prevents mixing records across orders, but not across users, because there is no ownership.
- **Shop id from session vs. request:** not applicable — there is no shop id. The role-based equivalent of IDOR is covered by F-03, F-04 and F-12.
- **Public capability route:** `/t/[code]` is gated by an unguessable code (src/lib/public-code.ts:14-18); see F-23 and F-30.

### C. Authentication and session

- **Where the session lives:** an httpOnly cookie, `authjs.session-token` (`__Secure-authjs.session-token` over https). Nothing is in localStorage or sessionStorage; localStorage holds only theme and currency preferences.
- **Cookie options** (Auth.js defaults; src/lib/auth.ts sets no cookie overrides):

  | Option | Value | Source |
  |---|---|---|
  | httpOnly | true | node_modules/@auth/core/lib/utils/cookie.js:48-56 |
  | SameSite | lax | same |
  | path | `/` | same |
  | Secure | only when the configured URL is https | same; lib/init.js:69 |
  | Lifetime (maxAge) | 30 days | lib/init.js:38, 75 |

- **JWT:**
  - Encrypted (JWE, `dir` + `A256CBC-HS512`; node_modules/@auth/core/jwt.js:46-47).
  - The key comes from `AUTH_SECRET` or `NEXTAUTH_SECRET` (node_modules/next-auth/lib/env.js).
  - Issued by the Auth.js route handler at sign-in.
  - Valid for 30 days and re-issued at most every 24 hours on activity (lib/init.js:76).
  - No refresh-token rotation and no server-side session store.
- **Logout:** clears the cookie only; nothing is invalidated server-side (F-06).
- **Password hashing:** bcryptjs, cost 12 (users/route.ts:87, users/[id]/route.ts:88, settings/route.ts:57, seed.ts:51). Adequate.
- **Changes without re-authentication:** yes — an owner can change another user's password, role or username (F-18). Changing your own password does require the current one (settings/route.ts:54-55). There is no email field.
- **Role enforcement:** only in the handlers listed under A. The UI filters navigation in sidebar.tsx:121-123 and command-palette.tsx:27-29. The `users.master_password_hash` column (users.ts:9) is never read or written.

### D. Middleware

- **Version and CVE-2025-29927:** next 16.2.1. That CVE was fixed in 14.2.25 and 15.2.3, so this repo is **not** vulnerable to it. It **is** listed as affected by later middleware-bypass advisories (F-01).
- **Protected paths:** everything the matcher covers except `/login*`, `/api/auth*` and `/t/*`.
- **Is the same check repeated behind middleware?**
  - Every `/api` route handler: yes.
  - Client pages (/dashboard, /account, /customers, /orders, /cargo, /expenses, /reports, /users, /settings): they render no data on the server and fetch through the checked APIs — effectively yes.
  - (dashboard)/layout.tsx: yes, but only at layout level.
  - `/orders/[id]`, `/customers/[id]`, `/cargo/[id]`: **no — middleware is the only defence** (F-02, HIGH).
- **Outside the matcher** (middleware.ts:31): `/_next/static/*`, `/_next/image` (image optimiser, public by design), `/favicon.ico`, `/icons/*`, `/sw.js`, `/manifest.webmanifest` (app/manifest.ts, public) and `/browserconfig.xml`. None serves private data today.
- **Prefix matching is a trap:** the matcher exclusions and the public allow-list are both prefix matches. A future route beginning with `/login`, `/api/auth`, `/t/`, `/icons/`, `/sw.js` or `/favicon.ico` would silently be public.

### E. Server / client boundary

**Server-to-client props:**

| Source | Data passed | Receives it |
|---|---|---|
| (dashboard)/layout.tsx:16-17 | session (id, name, email = username, role, expires) | Providers |
| (dashboard)/layout.tsx:16-17 | full `shop_settings` row | DashboardShell |
| orders/[id]/page.tsx:53 | full `orders` row; full `order_items` rows; customer narrowed to id, name, customerId, phone, city, platform, address; full `shop_settings` row | OrderDetailClient |
| cargo/[id]/page.tsx:93-101 | full `cargo_shipments` row; narrowed items and payments (including carrier cost rates); full `cargo_expenses` rows; full `shop_settings` row | CargoDetailClient |
| customers/[id]/page.tsx:44 | full customer row | CustomerStats (a server component, not a client boundary) |
| t/[code]/page.tsx:77-111 | narrowed tracking DTOs (good) plus the full `shop_settings` row | public client components (F-23) |

- **Fields users shouldn't see:** no password hash, token or other shop's data crosses to the client.
  - src/lib/auth.ts:27-31 and settings/route.ts:51 select the full users row, including `password_hash` and `master_password_hash`, but use it server-side only.
  - The users API responses list their fields explicitly.
  - Sensitive business data that reaches every role: carrier cost rates, order notes and full financials (F-12).
- **Full database rows returned without narrowing:**
  - GET orders/[id]
  - GET customers and customers/[id]
  - GET expenses and expenses/[id]
  - GET trash (four tables)
  - GET and PATCH settings
  - GET cargo-categories and cargo-expenses
  - every POST/PATCH `.returning()`

  None contains secrets today, but any sensitive column added later would leak automatically.
- **`NEXT_PUBLIC_`:** only `NEXT_PUBLIC_APP_URL` (src/hooks/use-public-origin.ts:23), a public base URL used for QR links. Safe.
- **Database client or secrets reachable from client code:** none. `src/db` is imported only by route handlers, server pages, the dashboard layout, src/lib/auth.ts and the seed. src/types/index.ts:2-14 imports the schema with `import type`, which is erased at build. (middleware.ts → src/lib/auth.ts → `db` does put the Postgres client into the middleware bundle, but that runs server-side.)

### F. Input validation

- **Zod coverage:** present on every JSON-body create and update handler (section 5).
- **Entry points with no validation:**
  - every `[id]` GET and DELETE handler
  - trash PATCH and DELETE
  - DELETE on order-items, cargo-items, cargo-payments and cargo-expenses (F-24)
  - query strings on list, dashboard and reports routes are parsed by hand (F-26)
- **FormData:** not applicable. There are no server actions or FormData handlers; every body is JSON sent by axios or fetch.
- **Money and quantity:** every field rejects negatives with a 400 (e.g. order.schema.ts:26-31, cargo.schema.ts:77, expense.schema.ts:15), but none has an upper bound (F-15). A negative value can't be stored through the API; an absurdly large one can, and it can break aggregate queries.
- **Raw SQL built from user input:** none. User values inside `sql` templates are bound parameters (e.g. dashboard/route.ts:23-24, reports/route.ts:25-26). The only `sql.raw` calls take the hard-coded strings `date` or `timestamptz`, and sort columns come from whitelists.

### G. Money and data correctness

- **Column types:** every monetary and rate column is `double precision`; `order_items.product_qty` is `integer` (F-09).
- **Money as JS float:** everywhere, including src/utils/*.ts, order-detail-client.tsx:333-359 and the dashboard handlers' `Number()` conversions (F-09, F-10).
- **Currency stored with the amount:** only `cargo_payments.currency` (F-11).
- **Multi-step operations without a transaction:** POST orders, POST cargo-shipments, the settings upsert and all display-number generation (F-13). There is no stock or inventory model and no invoice table, so "create invoice + adjust stock + record payment" doesn't exist as an operation here. Recording a cargo payment is a single insert.
- **Double submission:** buttons disable while a request is pending, but there is no server-side idempotency, so a retry creates duplicates (F-13).
- **Editing an invoice after issue:** invoices are rendered in the browser (src/components/invoice/*, src/components/cargo/*InvoiceTemplate.tsx) from live order data. Orders stay editable and deletable at any status, and nothing is recorded (F-14). A re-generated invoice can silently differ from the one already sent.

### H. Rate limiting and abuse

- **Rate limiting:** none. Login, writes and everything else are unthrottled; there is no lockout or backoff (F-07). There is no password-reset flow.
- **Webhooks:** not applicable — none exist.

### I. Secrets and configuration

- **Env files in git history:** `git log --all --name-only -- .env .env.local .env.production` printed nothing, so no env file was ever committed. `.gitignore` contains `.env*`.
- **Environment variables read by the app:**

  | Variable | Read at | Used for |
  |---|---|---|
  | `DATABASE_URL` | db/index.ts:5, drizzle.config.ts:8, seed.ts:16 | Postgres connection |
  | `NEXTAUTH_SECRET` / `AUTH_SECRET` | next-auth/lib/env.js | JWT encryption key |
  | `NEXTAUTH_URL` / `AUTH_URL` | next-auth/lib/env.js | canonical URL, cookie `Secure` flag, redirects |
  | `AUTH_TRUST_HOST` | docker-compose.yml:12 | trust proxy headers |
  | `NODE_ENV` | db/index.ts:17, env.ts:7 | dev-only client caching |
  | `NEXT_PUBLIC_APP_URL` | use-public-origin.ts:23 | public origin for QR links |
  | `PORT`, `HOSTNAME`, `NEXT_TELEMETRY_DISABLED` | Dockerfile:17, 26, 43-44 | container runtime |

  Local `.env` and `.env.local` define `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` and `AUTH_TRUST_HOST`. Their values were not viewed for this report.
- **Hard-coded credentials:** the seed password `admin123` (F-08). No keys, tokens or connection strings in source.
- **Fallback defaults for secrets:** none found. F-29 notes that env validation never runs.

### J. Headers, XSS and caching

- **Security headers:** none are set (F-17).
- **`dangerouslySetInnerHTML`:**
  - app/layout.tsx:97 — static theme script, safe
  - app/layout.tsx:98 — static service-worker registration, safe
  - components/ui/qr-code.tsx:58 — SVG produced by the `qrcode` library from a tracking URL, safe
  - The equivalent sink `document.write` at customer-table.tsx:29 and order-table.tsx:90 is exploitable (F-05).
- **User-controlled `href` / `src`:**
  - order-items-section.tsx:196 — `productUrl` in `href` (F-27).
  - `shop.logoUrl` in `<img src>` — sidebar.tsx:55, public-tracking-header.tsx:21 and nine invoice/label templates. It is validated as a URL (settings.schema.ts:7), and `<img>` doesn't execute `javascript:`. Any role can still point the public page's logo at an outside host, which then sees visitor IP addresses.
  - public-tracking-view.tsx:262 — `tel:${phone}`; the fixed `tel:` prefix prevents scheme injection.
- **Caching of authenticated data:** no problems found.
  - The only segment config export is `/t/[code]` `dynamic = "force-dynamic"`, which is correct.
  - Every GET handler calls `auth()`, which reads cookies, so it is rendered per request.
  - There is no `fetch` caching, `unstable_cache`, `"use cache"` or `revalidate` export.
  - The service worker skips `/api/*`, `/_next/*` and RSC requests (public/sw.js:37-46). The pre-cached `/` shell is listed in section 6.

### K. Logging and audit trail

- **Audit log:** none exists (F-14).
- **Logs that could leak secrets:** none print a session token, a plaintext password or a request body. Error logs on user and settings writes can include a bcrypt hash inside the Drizzle error message (F-22).

### L. File upload

- **Not applicable.** There are no upload endpoints and no multipart or FormData handling. The "Import CSV" buttons (e.g. src/app/(dashboard)/orders/page.tsx:109-111) have no click handler. `logoUrl` is a URL string, not an upload.

### M. Dependencies (`npm audit --omit=dev`: 11 vulnerabilities — 3 critical, 6 high, 2 moderate)

**Reachable from application code:**

- **next 16.2.1** (critical, direct): the middleware/proxy-bypass and Server Components DoS advisories apply to this App Router app (F-01). Several others do not apply:
  - Windows RCE — the container runs Linux
  - Server Actions DoS/SSRF — no server actions
  - rewrites SSRF — no rewrites
  - CSP-nonce and `beforeInteractive` XSS — neither is used
  - Pages Router i18n bypass — App Router, no i18n

**Not reachable:**

| Package | Severity | Dependency | Why not reachable |
|---|---|---|---|
| @auth/core 0.41.0 | critical | transitive (next-auth) | advisories cover the email provider, OAuth cookie binding and `getToken` Bearer parsing; the app uses credentials only and never calls `getToken` |
| axios 1.13.6 | high | direct | advisories target the Node HTTP adapter, proxies and prototype-pollution gadgets; axios runs only in the browser with a fixed `/api` base URL |
| drizzle-orm 0.45.1 | high | direct | identifier-escaping flaw; all identifiers are static, and `sql.raw` gets only hard-coded cast names |
| nanoid 5.1.7 | high | direct, plus a copy under next | negative or zero size; sizes are fixed (default and 12) |
| form-data | high | transitive (axios) | Node multipart only |
| postcss | high | transitive (next) | build time only |
| sharp 0.34.5 | high | transitive (next) | image optimiser; no `next/image` use and no remote patterns (see section 6) |
| follow-redirects | moderate | transitive (axios) | Node only |
| baseline-browser-mapping | moderate | build tooling | not in the runtime |

### N. Architecture and maintainability

**Structure.** Organised by layer at the top level, with feature sub-folders only inside `components/`:

| Folder | Contents |
|---|---|
| `src/app` | pages and `api/` handlers |
| `src/components/<feature>`, `ui/`, `layout/` | React components |
| `src/hooks` | one TanStack Query hook file per resource |
| `src/lib` | auth, axios, query client, helpers |
| `src/utils` | money and date calculations, image helpers |
| `src/validations` | zod schemas per resource |
| `src/db` | client and schema |
| `src/types`, `src/contexts` | shared types, theme context |

**Where business logic lives.** There is no domain or service layer:

- Queries, aggregation SQL and display-number generation are written inline in route handlers and server pages.
- Money calculations live in `src/utils/*` and inline in large client components (order-detail-client.tsx:333-400, cargo-detail-client.tsx:188-192).
- The three detail pages and `/t/[code]` query the database directly.

**Files over 400 lines:**

| File | Lines |
|---|---|
| src/app/(dashboard)/settings/page.tsx | 1121 |
| src/components/orders/order-detail-client.tsx | 1020 |
| src/components/cargo/cargo-items-section.tsx | 870 |
| src/components/cargo/cargo-detail-client.tsx | 485 |
| src/components/dashboard/PriceCalculator.tsx | 441 |

**Logic implemented more than once:**

1. **Service fee as a percentage:** reports/route.ts:76-81 (SQL); utils/calculations.ts:15-20; utils/invoiceCalculations.ts:38-39; order-detail-client.tsx:345-348.
2. **Fee total using the raw service fee:** dashboard/route.ts:73, 99-102; reports/route.ts:50-58, 71-74, 113-116, 127-130, 135-138; customers/[id]/page.tsx:35, 88; orders/page.tsx:78, 296; order-table.tsx:89.
3. **Items subtotal (price × qty):**
   - SQL: account/route.ts:47-51, dashboard/orders/route.ts:92-96, reports/route.ts:78
   - TS: utils/calculations.ts:7-11, utils/invoiceCalculations.ts:10-12, 37 (null qty counts as 1), order-detail-client.tsx:333
4. **Profit:** dashboard/route.ts:127; reports/route.ts:75-87; utils/calculations.ts:31-41.
5. **Cargo weight × rate:** cargo-shipments/route.ts:51-54; dashboard/cargo/route.ts:10-13; utils/cargoCalculations.ts:3-7, 110; CargoInvoiceTemplate.tsx:115; CargoOrderInvoiceTemplate.tsx:32, 142.
6. **Display-number generation:** orders/route.ts:96-106; customers/route.ts:71-84; cargo-shipments/route.ts:90-99; expenses/route.ts:97-100.
7. **Cargo shipment detail query, copied nearly verbatim:** api/cargo-shipments/[id]/route.ts:18-92 and (dashboard)/cargo/[id]/page.tsx:15-90. The customer-coalesce join is repeated a third time in t/[code]/page.tsx:33-67.
8. **Date-filter SQL builder:** dashboard/route.ts:8-58 and dashboard/orders/route.ts:9-55.
9. **Order column select list:** account/route.ts:17-55 and dashboard/orders/route.ts:61-113.
10. **Trash restore and delete handlers:** four near-identical files under api/trash/.
11. **Print label via `document.write`:** customer-table.tsx:26-42 and order-table.tsx:86-103.
12. **Stock adjustment:** not applicable — there is no inventory model.

**Server state on the client.** Three patterns are mixed:

- **TanStack Query v5** hooks (`src/hooks/use-*.ts`, axios, `invalidateQueries` after mutations) for list pages, dashboard, reports, users and settings.
- **`router.refresh()`** after mutations on server-rendered detail pages (cargo-*-section.tsx, order-items-section.tsx, cargo-detail-client.tsx:180, order-detail-client.tsx:319), combined with local `useState` copies synced from props (order-detail-client.tsx:307).
- **Hand-rolled `fetch` + `useState`/`useEffect`** in the settings Trash panel (settings/page.tsx:443-479).

There is no `revalidatePath` or `revalidateTag`, since there are no server actions. Because the patterns are mixed, a change made through a Query hook doesn't refresh a server-rendered page, and a `router.refresh()` doesn't update Query caches.

**The three places where a change is most likely to silently break something else:**

1. **Access control is implicit.** Detail pages rely on middleware and a layout (F-02). The public allow-list and matcher use string prefixes (middleware.ts:8-14, 31). Role checks are hand-copied into six handlers. A new data-reading page, any route under `/t/`, or a new handler copied from one of the 53 that have no role check silently exposes data, and no test or build step fails.
2. **Money formulas are duplicated with different definitions** across SQL and TypeScript (F-10, list above). Changing the service-fee, discount or cargo rule in one place leaves the dashboard, reports, invoices, CSV export and customer page disagreeing, with no error anywhere.
3. **Migrations and display numbers depend on hand-maintained conventions.** Hand-written SQL with a hand-edited journal whose timestamps must strictly increase can skip a migration silently (F-20). Number generation parses strings with `split_part` using prefixes any user can edit (F-19). A migration can be skipped, or a settings change can stop all order creation, and neither is caught at build time.
