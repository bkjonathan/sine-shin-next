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

_Added 2026-09-11, after remediation began. F-01 to F-08 were committed by the owner in `6fcf5c8`, and the quick hardening batch, the F-09 report, F-10, F-11, F-12 and F-14 in `a201508`. F-13 is in the working tree and **not committed**. The per-finding "(WT)" / "not committed" labels were written before those commits._

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
  - **Residual:** the counts live in process memory, so they reset on restart or redeploy and aren't shared if more than one replica ever runs. If port 3000 is reachable without Traefik (F-31), a client can forge `X-Forwarded-For` and dodge the limits — fix F-31. There is deliberately no per-username limit across addresses, because it would let anyone lock the owner out. F-18's one-password-policy part is done here; its re-authentication part is done under F-18 below. (Found while doing F-18: sign-in records a failure only after the database lookup and bcrypt, so simultaneous wrong sign-ins for one key can all start before the limit is reached. Not changed; the F-18 password check counts each attempt before checking it.)
- **F-08 — code fixed in working tree; production check still needed.**
  - **No default password.** src/db/seed.ts takes the owner password from `SEED_OWNER_PASSWORD` (refused under 8 characters) or generates a random 20-character one and prints it once. The credentials line in memory/project_shop_manager.md is replaced.
  - **The seed was also broken.** It imported `dotenv/config`, which isn't a dependency, so `npm run db:seed` failed with `Cannot find module`. The import is removed; pass `DATABASE_URL` in the environment, as the script's own usage line says. (Adding `dotenv` back would be a new dependency.)
  - **Verified** by `tests/f08-seed-owner-password.test.mjs`: it runs the real seed against the throwaway database, signs in with the generated and the provided password, confirms the old default is refused, and checks that no tracked file other than this report still contains it. Before the fix the seed couldn't load and the default was still tracked. Full suite F-01–F-08: 88 tests pass.
  - **Still needs the owner:** confirm the production `admin` account doesn't use the old default — it stays in git history, so treat it as public. No `mustChangePassword` flag yet (decision pending). A generated password that was printed to a terminal or CI log should be changed after first sign-in.
- **Quick hardening batch — F-16, F-17, F-19, F-21, F-31 fixed in working tree.** Verified on a local build backed by the throwaway database. Each new test failed before its fix, except F-21's Docker probe, which was deliberately not run on the pre-fix tree because it would have copied the real `.env` into the local build cache. Full suite F-01–F-31: 104 tests pass.
  - **F-16.** `safeRedirectPath()` (src/lib/utils.ts) keeps `callbackUrl` only if it is a relative path that resolves to the same origin. It uses the browser's own URL parser, so `//host`, `/\host` and tab/newline tricks fall back to `/dashboard`. The login page redirects only through it.
  - **F-17.** next.config.ts sends `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `X-Frame-Options: DENY` on every route, proxy redirects included, and sets `poweredByHeader: false`. HSTS omits `includeSubDomains` because other apps may share the domain (§6 item 10); browsers ignore HSTS over plain HTTP, so local development is unaffected. **Residual:** no Content-Security-Policy yet — it needs hashes or nonces for the two inline scripts in app/layout.tsx and for the print-label popup (F-05).
  - **F-19.** ID prefixes must be 1–20 letters or digits after trimming, uppercasing and stripping trailing dashes (src/validations/settings.schema.ts); the settings form uses the same schema. With F-04's owner-only settings, the prefix part of F-19 is done. **Residual:** numbering still uses `split_part` + `max` (F-13), and customer numbering still scans every customer regardless of prefix. An existing prefix that doesn't fit must be changed before the settings form will save again.
  - **F-21.** `.dockerignore` excludes `.env*`, `node_modules`, `.next`, `.git`, `memory`, `.claude`, `tests` and this report. Checked by asking Docker what it would send (a bind-mounted listing; no image is created): secrets and local artefacts are absent, and everything the Dockerfile needs is present. Excluding `node_modules` also stops the local macOS modules from overwriting the Linux ones installed by `npm ci`. **Not done:** the full image was not built (that needs a network `npm ci`). If an image built with `.env` was ever pushed to a registry, rotate those secrets.
  - **F-31.** docker-compose.yml publishes `127.0.0.1:3000:3000`, so the port isn't reachable from other hosts. Checked with `docker compose config`, run so that it doesn't read `.env`. **Still unknown:** whether Coolify uses this file or its own port settings (§6 item 4).
- **F-09 — not fixed; read-only groundwork added.** Deliberately deferred: it is the largest change in this report, it rewrites real financial rows, and it depends on F-10's formula definitions and F-11's base currency (both since settled — see below).
  - **Precision report.** `scripts/f09-money-precision-report.mjs` covers all 18 `double precision` columns (9 money amounts, 7 rates, 2 weights). For each it reports: NaN/±Infinity, which a `numeric` column can't hold; negatives; the largest value and the integer digits it needs; the most decimals used; how many values rounding to the proposed scale would change, and by how much at most; and the column total as stored vs after rounding. It also counts orders by `service_fee_type`, for F-10. The session is set read-only, all queries run in a `READ ONLY` transaction, and only aggregates are printed.
  - **Verified** by `tests/f09-precision-report.test.mjs` against the throwaway database. Seeded values — 10.005, 0.1 + 0.2, NaN, Infinity, a negative, a 12-digit amount and 1/3 — are each reported correctly, inside a transaction that is rolled back. A write through the script's connection is refused, and the command-line run doesn't print the database password.
  - **Next:** run it against production with `DATABASE_URL=… node scripts/f09-money-precision-report.mjs`. F-10's definitions and F-11's base currency (THB) are settled. Then choose between `numeric` and integer minor units, and pick precision and a rounding rule.
- **F-10 — fixed in working tree; definitions agreed with the owner on 2026-09-11** (answers §6 item 6).
  - **Definitions** (src/lib/order-money.ts):
    - _Items subtotal_ = Σ price × quantity over non-deleted items. No quantity counts as 1; no price counts as 0.
    - _Service fee_ = that percentage of the items subtotal for "percent"/"%"; otherwise the amount itself.
    - _Order total_ = items + shipping + delivery + cargo + service fee. Every fee is charged, including fees ticked "Shop" and a cargo fee ticked "Excluded". _Revenue_ = Σ order totals.
    - _Shop income_ = service fee + purchase discount + each fee ticked "Shop".
    - _Profit_ = shop income − expenses dated in the same period.
    - "Excluded" only removes a cargo fee from the cargo statistics.
  - **One implementation.** src/lib/order-money.ts (TypeScript) and src/lib/order-money-sql.ts (SQL fragments) now hold the only formulas. They replace 11 copies across the reports, dashboard, dashboard-orders, account and order-list APIs, the Dashboard and Account calculations, the order page, the order table, the orders CSV and grid, the customer page, and the invoice and receipt totals.
  - **What the owner will see change:**
    - Revenue includes the value of items. It was fees only, with percentage service fees added as if they were money.
    - Dashboard "Net profit" subtracts the period's expenses; it subtracted none before. Reports profit and `/api/dashboard` profit now use expenses from the same period only (`/api/dashboard` used all-time expenses).
    - The order page Total no longer subtracts "Shop" fees, and its Profit includes them.
    - A cargo fee ticked both "Shop" and "Excluded" now counts as shop income.
    - Customer "total spent", the order list, the CSV export and the print label show the full order total.
    - An item with no quantity counts as 1 everywhere, including the quantity printed on invoices (invoice amounts already did this).
  - **Verified** by `tests/f10-order-money.test.mjs`:
    - worked examples of each definition
    - a guard that fails if any of the old formulas reappears
    - SQL and TypeScript agree order by order on a fixture in the throwaway database
    - live checks of reports, the dashboard, `/api/dashboard`, the order list, account and the customer page against hand-checked totals: revenue 1,651, shop income 230, expenses in range 75.5, profit 154.5

    Before the fix, the live check saw reports revenue of 160 and an items subtotal of 800 (the item with no quantity counted as 0). Full suite: 117 tests pass.
  - **Residual:**
    - Amounts are still floating point (F-09).
    - Cargo-shipment money (carrier and receiver owed) is a separate calculation and is unchanged.
    - Reports filter orders by `order_date` only but group months by `coalesce(order_date, created_at)`.
    - The create-order form's live preview still treats an empty quantity as 0 while typing.
    - Nothing was checked in a browser.
- **F-11 — fixed in working tree; migration 0010 must run first; decisions agreed with the owner on 2026-09-12.**
  - **Decisions:**
    - base currency THB (฿), exchange currency MMK (Ks)
    - receiver payments in THB or MMK; carrier payments in THB only, because balances count them at face value
    - the base currency code is locked once any order, expense, cargo shipment, cargo payment, cargo expense or cargo category exists (soft-deleted rows count, since they can be restored)
    - the default exchange rate is shop-wide and set by the owner
  - **Settings on the server.** drizzle/0010_shop_currency.sql adds five columns to `shop_settings`:
    - `currency_code`, `currency_symbol`, `exchange_currency_code`, `exchange_currency_symbol` (defaults THB, ฿, MMK, Ks)
    - `default_exchange_rate`, a `numeric(18,6)` (not a float) with default 1

    The statements use `ADD COLUMN IF NOT EXISTS`, and the journal `when` is later than 0009's. src/lib/currency.ts maps a settings row to the currency prefs the pages use, falling back to those defaults.
  - **Calculations.** The cargo page computes balances from the shop row it renders on the server (`shopCurrency(shop)`), not from a client hook. `useCurrencyPrefs()` now reads `/api/settings`, so every browser shows the same symbols and pre-fills the same rate; nothing currency-related is kept in localStorage. The new-shipment form now applies the default rate once settings load; before, it captured 1 before the browser prefs had loaded.
  - **Enforcement.**
    - `POST /api/cargo-payments/:id` trims and uppercases the currency, then returns 400 unless it is the base currency (or, for a receiver, the exchange currency). The payment form offers only those choices.
    - `PATCH /api/settings` (owner only) requires 3-letter codes, 1–10 character symbols and a positive rate below 10¹². It returns 400 if the base and exchange codes match, and 409 if the base code changes while money is recorded.
    - On the Settings page the currency fields are now part of the shop-settings form, with one Save button.
  - **"Base currency only" rule.** This answers the finding's "most amounts have no currency" part. Every amount column is in `currency_code`, as documented in the migration and src/db/schema/shop-settings.ts. It is enforced because cargo payments are the only place a currency can be entered, and the lock stops stored amounts being relabelled. No currency column was added to other tables.
  - **Verified** by `tests/f11-shop-currency.test.mjs`:
    - unit tests of the helpers
    - a guard against currency in localStorage and hard-coded payment currencies
    - live checks of the settings API: defaults, validation, owner-only access, and the lock both before and after money exists
    - live checks of the payments API and of the server-rendered cargo page

    Fixture: a receiver owes 500 THB and paid 20,000 MMK at 100 plus 300 THB. Before the fix, all 8 checks failed. The page showed "Receiver Owed $ 500 · Balance $ 297" with a "Paid $ 203 of $ 500" badge, and a carrier payment in USD was accepted (201). After the fix the balance is 0, the badge says paid in full, and USD is refused. Full suite, run with `--test-concurrency=1` (F-11 changes shared settings): 125 tests pass. `tsc --noEmit` is clean and `next build` passes.
  - **Deploy order matters.** Apply 0010 to production _before_ the new image goes live. The dashboard layout selects every `shop_settings` column, so until the columns exist every dashboard page fails. Old code doesn't read them, so running 0010 early is safe; run its statements by hand (F-06 note, F-33). Then the owner should open Settings and set **Default Exchange Rate**: it starts at 1, and rates saved in individual browsers are no longer read.
  - **What the owner will see change:**
    - Every browser shows ฿ and the owner's default rate.
    - A receiver payment recorded in THB counts at face value for everyone.
    - The payment form offers MMK/THB for receivers and fixes carriers to THB.
    - Settings has one Save button.
  - **Residual:**
    - Existing payment rows are not rewritten. Carrier payments stored as "USD" (the old form default) were always counted at face value, but their receipts still print "USD". A receiver payment with a code other than THB/MMK is still converted at its rate, as before. Check production read-only: `select party_type, currency, count(*) from cargo_payments group by 1, 2`.
    - The exchange currency code is not locked. Changing it relabels the "total with exchange" on existing invoices without converting it.
    - The lock check and the update are not one transaction (F-13).
    - The Settings form is still shown to every role; non-owners get 403 when saving (F-04 residual).
    - Amounts are still floating point (F-09). The default rate is stored as numeric but read as a JS number.
    - Only the dashboard, Expenses, Reports, Account Book and customer pages were checked in a browser (during F-12, below). The cargo payment form and the Settings currency fields were not.
  - **Follow-up, found while checking F-12 in a browser.** The claim above that every browser shows ฿ was not true at first. Five displays never read the currency setting; they used a fixed "$": the dashboard's Net profit and Revenue chips (`formatCurrency()` defaults to "$"), order totals on the customer page, the customer's "Total Spent" card, and deleted-expense amounts in Settings → Trash. All five now use the shop's symbol; the customer page reads it on the server. `tests/f11-shop-currency.test.mjs` now also fails on a `formatCurrency()` call without a symbol or a literal "$" before an amount; it flags all four affected files as they were at HEAD. F-10's customer-page check matched the old "$1546.00" format and now checks the amount only.
- **F-12 — fixed in working tree; policy agreed with the owner on 2026-09-12** (answers the read half of §6 item 2).
  - **Policy.** Shop-wide money summaries are for managers and the owner: revenue, shop income, profit, expense totals, and cargo carrier-cost and receiver-revenue totals. The rule is one constant, `FINANCIAL_SUMMARY_ROLE` in src/lib/roles.ts. Only summaries are restricted for now: staff keep the individual records they work with — orders (including buy price and per-order profit), expenses, and cargo rates, amounts owed and per-shipment profit.
  - **Server.**
    - `/api/reports` (same rule as before, now from the shared constant), `/api/dashboard` and `/api/account` return 403 to staff.
    - For staff, three shared endpoints drop only their totals and keep their records: `/api/dashboard/orders` omits `meta.expensesTotal`, `/api/dashboard/cargo` omits `stats.carrier_owed` and `receiver_owed`, and `/api/expenses` omits `meta.stats`.
    - The role hierarchy moved to `hasRole()` in src/lib/roles.ts, so route handlers (through `roleAtLeast`) and client components share it. It also rejects inherited property names such as `toString`.
  - **UI (what gets rendered; the APIs are the access control).**
    - The sidebar shows Reports to managers and the owner (it was owner only) and Users to the owner.
    - For staff, the dashboard hides Net profit, Revenue, the Financial Overview cards, the cargo cost/revenue/profit cards and the Account Book button. The Expenses page hides the total, this-month and average cards.
    - Reports and the Account Book show "Not available for your role" to staff, without calling their APIs.
  - **Verified** by `tests/f12-financial-summaries.test.mjs`:
    - unit tests of the role hierarchy
    - for each role, the three summary-only endpoints (403 for staff, 200 otherwise)
    - the three shared endpoints (records for everyone, totals for managers and the owner only)
    - the server-rendered dashboard, Reports, Account Book and Expenses pages

    Before the fix, all 5 failed: `/api/dashboard` returned 200 to staff, dashboard orders sent staff the expense total, and the dashboard showed staff the money cards. Full suite (`--test-concurrency=1`): 130 tests pass. `tsc --noEmit` is clean and `next build` passes.
  - **What the owner will see change:**
    - Managers now see Reports in the sidebar.
    - Staff no longer see money cards on the dashboard or the Expenses page, and can't open Reports or the Account Book.
  - **Residual:**
    - **Not a hard barrier.** Staff can still add up the order, expense and cargo records they are allowed to list, and they still see buy prices, carrier rates and per-order or per-shipment profit. Hiding margins from staff would change the agreed write permissions, since staff enter those values. Not done, by decision.
    - A customer's "Total spent" is per customer and stays visible to staff.
    - The sidebar and page gates read the session loaded with the page. A demoted manager keeps seeing the links until the next full page load, but the APIs refuse them on the next request (F-06).
    - `useDashboardStats()` in src/hooks/use-settings.ts, the only caller of `/api/dashboard`, is unused.
  - **Checked in a browser.** Headless Chrome (Playwright) ran against a local `next build && next start` on the throwaway database, with a small fixture that was removed afterwards. It loaded the dashboard, Expenses, Reports, Account Book and a customer page as staff, manager and owner:
    - no failed API call, console error or error toast for any role
    - staff saw no money cards or totals, no Reports link, and "Not available for your role" on Reports and the Account Book
    - managers and the owner saw every summary, matching the fixture (revenue ฿1,150, profit ฿55, carrier cost ฿300, receiver revenue ฿500)
    - only the owner saw the Users link

    This check also found the hard-coded "$" displays recorded under F-11's follow-up.
- **F-13 — fixed in working tree; migration 0012 must run first; decisions agreed with the owner on 2026-09-12.**
  - **Decisions.**
    - Display numbers stay "highest existing + 1": if the top-numbered record is permanently deleted, its number is given out again, as before.
    - Retry protection covers every create that records money or a numbered record: orders, order items, cargo shipments, cargo items, cargo payments, cargo expenses, expenses and customers. Cargo categories (owner setup) and users (usernames are unique) are left out.
  - **Numbers.** `nextDisplayNumber()` (src/lib/display-number.ts) runs inside the create's transaction, after taking a transaction-level advisory lock for that table. A second create of the same kind waits there until the first commits, then sees its number. Only `PREFIX-digits` IDs count, so one malformed stored ID no longer makes every later create fail. As before, orders and shipments count per prefix, and customers and expenses count every ID.
  - **Retries.**
    - `createOnce()` (src/lib/idempotency.ts) runs all eight creates. When the request has an `Idempotency-Key` header, it claims the key in the same transaction as the create and stores the reply with it (drizzle/0012_idempotency_keys.sql).
    - A retry with the same key waits for the first attempt to finish, then gets the stored reply (201, `Idempotent-Replayed: true`) and nothing new is saved. If the first attempt rolled back, its key went with it and the retry creates the record.
    - The same key with different values, or on another endpoint, gets 422. Keys are per user, 16–100 characters, and deleted after 24 hours.
    - A create refused inside the transaction, such as a payment in a disallowed currency, rolls its key back too, so the corrected form can be saved.
    - In the browser, the eight create hooks send one key per submission (src/hooks/use-idempotency-key.ts). A hook keeps its key only while the outcome is unknown (no reply, or 502/503/504 from the proxy) and takes a new one once the app has answered. Requests without a key still work as before.
  - **Settings and the currency lock.** `PATCH /api/settings` locks the settings row (`FOR UPDATE`) and checks and saves in one transaction; a first save uses `ON CONFLICT`, so two first saves no longer collide. When the base currency changes, it locks the six money tables in SHARE mode before looking for money records: a record still being saved is waited for and counted, and none can be added until the change commits. Cargo payments read the settings row `FOR SHARE` inside their transaction, so their currency check can't pass against a currency that is being changed. This closes F-11's "lock check and update are not one transaction" residual, F-14's "display-number races and idempotency are unchanged", and the numbering part of F-19's residual.
  - **Verified** by `tests/f13-transactions-idempotency.test.mjs`:
    - a unit test of when the browser keeps a key, and a guard that the eight routes use `createOnce`, the eight hooks send a key, and no route computes numbers itself
    - live checks on the throwaway database:
      - 8 simultaneous creates each of orders, customers, expenses and shipments get distinct numbers
      - a malformed stored order or customer ID doesn't block the next create
      - a retried order returns the saved order and its one item; a changed retry gets 422; three simultaneous retries save one order
      - another user's identical key creates their own order; malformed keys get 400
      - each of the other seven creates returns the saved record on retry
      - a refused payment and a failed cargo item don't use up their keys
      - five simultaneous first-time settings saves all succeed and leave one row
      - a base-currency change waits for an order still being saved, then returns 409

    Before the fix all 12 checks failed. 8 simultaneous orders gave two 201s and six 500s (`orders_order_id_unique`); the malformed order ID gave a 500 (`invalid input syntax for type integer`); a retried order and a retried order item each saved a second record, and so did a changed retry; malformed keys were accepted; 4 of 5 first-time settings saves failed on `shop_settings_pkey`; and the currency change returned 200 while the order was still uncommitted. (The refused-key check failed only because that change had gone through; it guards the rollback. The lock step now puts the currency back at once if a build accepts the change.) After the fix all 12 pass. The F-14 guard also accepts `createOnce` as an audited write. Full suite (`--test-concurrency=1`): 155 tests pass. `tsc --noEmit` is clean and `next build` passes.

    Also checked in headless Chrome, as staff on the Expenses page. The first Record Expense reached the server and its reply was dropped, and the form stayed open. The second click sent the same key, got the saved EXP-00001 back and closed the form. The next expense used a new key (EXP-00002), and the database held exactly those two. The only other failed requests were six Next.js link prefetches (`ERR_ABORTED`), and the only console error was the dropped request.
  - **Deploy order.** Apply 0012 before or together with the new image. The new browser code sends a key with every create, and until the table exists each of those creates returns 500. Old code doesn't use the table, so running 0012 early is safe; run its statements by hand (F-06 note, F-33).
  - **What the owner will see change:**
    - Nothing in normal use.
    - Saving again after a timeout no longer creates a second order, payment, expense or item; the form closes as if the first save had worked.
    - A form changed and saved again after a timeout shows "This form was already saved with different values…" once.
  - **Residual:**
    - After that 422, saving again creates the changed values as a new record, so the first one may need deleting. Keeping the key instead would block a deliberate new record from the same form until a reload.
    - `expenses.expense_id` still has no unique constraint. The app can no longer create duplicates, but production may already hold some. Check read-only before adding one: `select expense_id, count(*) from expenses where expense_id is not null group by 1 having count(*) > 1`.
    - A retry more than 24 hours after the first attempt isn't recognised. Stored replies (the created record) are kept outside the audit log for up to 24 hours.
    - Creates of one numbered kind now run one at a time from the lock until commit, so a slow order create delays the next one. Not measured; at shop scale it shouldn't be noticeable.
    - Customers still count across every prefix (F-19 residual, unchanged).
    - F-25 (parent checks) is still open. `createOnce` lets a create return a 404 from inside its transaction, which F-25 needs.
    - Only the expense form was checked in a browser; the other seven forms use the same hook helper.
- **F-14 — fixed in working tree; migration 0011 must run first; decisions agreed with the owner on 2026-09-12.**
  - **Decisions.** Record every change to shop data, permanently, and never store password hashes. An owner-only Settings → Activity page shows the log.
  - **How changes are recorded.** drizzle/0011_audit_log.sql adds an `audit_log` table and a trigger on all 11 business tables.
    - Each `audit_log` row holds the time, user id, role, client IP, database user, action, table, row id, and the whole row `before` and `after` as JSON.
    - The trigger (`AFTER INSERT OR UPDATE OR DELETE`) runs inside the same transaction as the change: a change can't be saved without its row, and a rolled-back change leaves none.
    - Password hashes are stripped; a password change shows as `password_changed: true`. An update that changed nothing isn't recorded.
  - **Who made the change.** Every route handler write now runs inside `withAudit(req, session, tx => …)` (src/lib/audit.ts). It opens a transaction and sets `app.user_id`, `app.user_role` and `app.client_ip` for it; the address comes from F-07's `clientIp()`. All 22 route files that write were converted, and the test fails if any route writes with `db` directly. A change made outside the app (psql, a script, a migration) is still recorded, with the database user and no app user.
  - **Append-only.** Triggers on `audit_log` refuse UPDATE, DELETE and TRUNCATE.
  - **Side effects of the transactions.** Creating an order or a shipment together with its items is now all-or-nothing. `PATCH /api/orders/:id` now sets `updated_at`. Display-number races and idempotency (F-13) are unchanged.
  - **Viewer.**
    - `GET /api/audit-log` (owner only): newest first, 50 per page, filterable by table and record id.
    - Settings → Activity (owner only): labels each entry Created, Changed, Moved to trash, Restored or Deleted permanently, and lists changed fields as old → new.
  - **Verified** by `tests/f14-audit-log.test.mjs`:
    - unit tests of the entry formatting
    - a guard that all 22 writing route files use `withAudit`
    - live checks on the throwaway database:
      - a recording trigger exists on all 11 tables
      - a customer created by staff, edited, trashed and restored by a manager, then permanently deleted by the owner, with the right user, role and client address on each row
      - an order and its item attributed to the same user, and `updated_at` set on edit
      - a password reset leaves no hash anywhere in the log
      - a write that fails on a foreign key leaves no row
      - a direct SQL change is recorded without an app user
      - UPDATE, DELETE and TRUNCATE on the log are refused
      - the API and page are owner-only

    Before the fix all 13 checks failed; after it all pass. Full suite (`--test-concurrency=1`): 143 tests pass. `tsc --noEmit` is clean and `next build` passes.

    Also checked in headless Chrome: the owner's Activity tab listed a customer's creation, its phone and city change (old → new), and the move to trash, with who did each, their role and address. A manager had no Activity tab. Neither role saw a failed request or console error.
  - **Deploy order.** Apply 0011 to production before or together with the new image. Without it, writes still work but nothing is recorded and the Activity page returns 500. Run its statements by hand (F-06 note, F-33): `db:push` would create the table but not the triggers. The trigger syntax needs Postgres 11 or later.
  - **Residual:**
    - The app's database role owns `audit_log`, so that role (or anyone with its password) could drop the append-only triggers. A hard guarantee needs the app to connect as a separate role without ownership or DDL rights; not done, because it needs access to the production database (§6 item 4).
    - Rows are kept forever and include customer details, even after a customer is permanently deleted. Removing old rows needs a deliberate admin step (drop the guard trigger, delete, recreate it). There is no retention policy yet.
    - A `TRUNCATE` of a business table isn't recorded, because row triggers don't fire for it.
    - The client address can be forged if port 3000 is reachable without Traefik (F-31).
    - Reads aren't logged, so there's no record of who viewed what.
    - Tests seed data with direct SQL, so throwaway databases accumulate log rows that can't be removed.
- **F-15 — fixed in working tree; decisions agreed with the owner on 2026-09-12.**
  - **Decisions.**
    - Any single amount is at most 1,000,000,000: fees, item prices, purchase discounts, per-kg rates, payments and expenses. That fits a receiver payment of about 10 million baht recorded in kyat.
    - A percentage service fee is at most 100%.
    - An item's product link may be any text up to 2,000 characters, because staff paste share text and app links. React 19 already refuses to run `javascript:` links (checked in react-dom).
    - There is no check that a purchase discount is within the items.
  - **Limits.** src/validations/limits.ts holds them, and every request schema uses them:
    - amounts ≤ 1,000,000,000; exchange rates ≤ 1,000,000, including the shop's default rate (it was < 10¹²); weights ≤ 100,000 kg; quantities ≤ 1,000,000
    - dates must be real calendar dates written YYYY-MM-DD; a blank date (`""` from an empty date input) is saved as no date
    - order notes and product links ≤ 2,000 characters, the order source ≤ 100, IDs ≤ 36, and the three password-change fields ≤ 128, like every other password field since F-07
    - lists ≤ 500 entries: an order's or shipment's items, and the IDs in a bulk status change
    - the logo URL must start with http:// or https://

    The forms use the same schemas, so they show these messages before anything is sent.
  - **Percentage fee.** Creating an order checks it in the schema. The order page saves the fee and its type one at a time, so `PATCH /api/orders/:id` checks the result against the stored fee or type, inside the update's transaction with the row locked. An order already over 100% can still have its other fields edited.
  - **Blank dates were a live bug.** On the build before this fix, an order created with the date left blank, or a shipment with blank departure and arrival dates, returned 500 (`invalid input syntax for type date: ""`). They now save with no date.
  - **Verified** by `tests/f15-input-limits.test.mjs`:
    - a unit test of the date check
    - a guard that every number, string and list in the request schemas has a maximum, and that no date field accepts any text
    - live checks on the throwaway database:
      - two orders with a fee of 1e308 are refused, and the dashboard still loads
      - 17 values over their limits are refused with 400; an order, a payment and an expense at the limits save
      - impossible dates are refused with 400, 29 February 2024 saves, and blank dates as the forms send them save as no date
      - the 100% cap on create and on single-field edits, including the legacy `%` type, while other edits of an order already over 100% still save
      - over-long text, a 37-character customer ID, 501 items and 501 bulk IDs are refused, a 2,000-character pasted share link saves, and a `javascript:` logo is refused

    Before the fix all 8 checks failed. The two 1e308 fees were stored and `/api/dashboard` then returned 500 (`value out of range: overflow`). The over-limit amounts, rates and weights were stored. A 3e9 quantity, the impossible dates and the 37-character customer ID returned 500 (`out of range for type integer`, `date/time field value out of range`, `value too long for type character varying(21)`). A 101% service fee, the over-long text, 501 items, 501 bulk IDs and the `javascript:` logo were all accepted. The blank-date 500s were confirmed with two direct requests to that build, because the test step stopped at its first failure. After the fix all 8 pass. Full suite (`--test-concurrency=1`): 163 tests pass. `tsc --noEmit` is clean and `next build` passes.

    Also checked in headless Chrome, as staff:
    - a shipment created from the form with both dates blank saved, and the form sent them as `null`
    - an expense of 1,000,000,001 showed "Must be 1,000,000,000 or less" and was never sent
    - on an order page, switching a fee of 500 to % returned 400, showed "A percentage service fee can be at most 100%" and put the toggle back on ฿, with the order unchanged

    There were no other console errors or failed requests.
  - **What the owner will see change:**
    - Orders and shipments can be saved with their dates left blank.
    - Forms show a message instead of saving an amount over 1,000,000,000, a rate over 1,000,000 or an impossible date.
    - On the order page, switching a service fee above 100 to % is refused with a message; change the number first.
  - **Residual:**
    - A record already holding a value over a new limit can't be saved from a form that sends that value back, such as the item or expense edit forms, until the value is corrected. The order and shipment pages save one field at a time, so their other fields still save. Check production first: `scripts/f09-money-precision-report.mjs` reports each money column's largest value.
    - Amounts still accept any number of decimal places; precision and rounding belong to F-09.
    - A purchase discount larger than the items is still accepted (by decision), and there are no cross-record rules such as a payment larger than what is owed.
    - A value refused only by the server, such as an inline edit on the order or shipment page, shows "Validation failed" rather than the specific limit. The percentage rule is the exception.
    - IDs are capped at 36 characters, but `orders.customer_id`, `order_items.order_id` and `cargo_items.category_id` are `varchar(21)` in the database built from migrations. If production has 36-character customer IDs (src/db/schema/cargo-items.ts says `customers.id` mixes nanoids and legacy UUIDs), creating an order for such a customer fails with 500. Not certain: `customers.id` is `varchar(21)` in the throwaway database, so it needs a read-only check of production (F-33).
    - Query-string parsing (F-26) and the unvalidated DELETE bodies (F-24) are unchanged.
- **F-18 — fixed in working tree; no migration; decisions agreed with the owner on 2026-09-12.** The password-minimum part was done under F-07; this closes the re-authentication part.
  - **Decisions.**
    - A password reset, a role change and deleting a user ask for the acting owner's own password, every time. Nothing is remembered between changes.
    - Creating a user and renaming one don't ask (the audit's proposed scope).
  - **Server.**
    - `verifyOwnPassword(session, password)` in src/lib/auth.ts loads the signed-in user's hash and checks the password with bcrypt. It returns 400 when the password is missing or wrong. After 5 wrong entries for that account within 15 minutes it returns 429 ("Too many incorrect password attempts") for 15 minutes, even for the right password. A correct entry clears the count.
    - Each attempt is counted before the bcrypt check, so simultaneous guesses can't all start before the limit is reached: 20 at once get five 400s and fifteen 429s.
    - `PATCH /api/users/:id` calls it whenever the body sets a password or a role, before anything is saved. `DELETE /api/users/:id` now reads an optional JSON body (`deleteUserSchema`) and calls it before deleting. Both schemas accept `currentPassword` up to 128 characters.
    - The check is always against the acting owner, never the account being changed, and it applies to the owner's own account too. **Correction to Appendix B §C:** before this fix an owner could set their own password through `PATCH /api/users/<own id>` without the current one, which skipped the check in Settings.
    - `PATCH /api/settings` (changing your own password) uses the same helper, so its wrong entries count toward the same limit; otherwise either route could be used to guess the password behind a stolen session. Its messages are unchanged, except that a missing user row now gets 400 instead of 404.
  - **UI.**
    - Users → Edit shows "Your current password" only once the role or the new-password field changes, and won't send those changes without it. A rename alone saves as before.
    - Delete, in the table and grid views, opens a small dialog asking for the owner's password instead of the browser's `confirm()`. A wrong password shows "Current password is incorrect" and keeps the dialog open.
    - The create form's password placeholder said "Min 6 characters"; it now shows the real minimum (8).
  - **Verified** by `tests/f18-reauth.test.mjs`:
    - a schema test: `currentPassword` up to 128 characters on update and delete
    - live checks on the throwaway database, each with its own owner account:
      - a reset, a role change and a delete are refused without the owner's password or with a wrong one, and the reset also with the target's own password; nothing changes, and each succeeds with the right password
      - an owner's own reset from Users is refused without the current password
      - renaming and creating still don't ask
      - four mistakes followed by the right password succeed, twice in a row
      - three wrong entries through Users plus two through Settings block both routes with 429, even for the right password; another owner is unaffected
      - 20 simultaneous wrong entries give exactly five 400s and fifteen 429s

    Before the fix, on a build of the unfixed code, every check failed except the by-decision one. A reset, a role change, a delete and an owner's own reset each returned 200 with no password; the first wrong entry in the limit check was accepted; 20 simultaneous wrong entries all returned 200; and `deleteUserSchema` didn't exist. (The simultaneous-entries check was added after the first run and run against the same unfixed server.) The F-06, F-07 and F-14 tests now give their owner a known password and send it; F-07's 7-character reset sends it so its 400 can only come from the length rule. After the fix all pass. Full suite (`--test-concurrency=1`): 172 tests pass. `tsc --noEmit` is clean and `next build` passes.

    Also checked in headless Chrome as an owner (17 checks):
    - the edit form shows no password field until the role changes, and stops an empty password without sending anything
    - a wrong password shows "Current password is incorrect", keeps the form open and leaves the role unchanged; the right one saves and closes
    - a rename saves without asking
    - the delete dialog names the user, stops an empty password without sending anything, keeps the user after a wrong password and deletes after the right one; the grid view opens the same dialog

    The only console errors were the two expected 400s, and the only failed requests were Next.js link prefetches (`ERR_ABORTED`).
  - **What the owner will see change:**
    - Changing someone's role or password, or deleting a user, asks for your own password each time.
    - Delete uses a dialog instead of the browser's confirm box.
    - After 5 wrong passwords in 15 minutes, counting the Users page and the Settings password change together, both refuse for 15 minutes. Sign-in isn't affected.
  - **Residual:**
    - **By decision, creating a user doesn't ask.** A stolen owner session can still create a second owner account with a password of the attacker's choosing, sign in as it, and pass every check with that password. Asking for the password on create too would close this.
    - Renaming doesn't ask either, so a stolen session can change another owner's sign-in name; that owner can't sign in until told the new one.
    - The count is kept in process memory, like F-07's: a restart clears it and replicas wouldn't share it. It's per account, so anyone holding an owner's session can block that owner's Users-page changes and Settings password change for 15 minutes (not their sign-in).
    - Refused attempts aren't in the audit log: F-14 records row changes, and a refused change writes none.
    - A browser that has saved the owner's password can fill the field in, so an unattended signed-in browser is only partly covered; a copied session cookie is covered.
- **F-20 — fixed in working tree; no migration; production still to be checked with the new report.**
  - **How Drizzle decides.** Confirmed in drizzle-orm 0.45.1 (pg-core/dialect.js:56-71), which `drizzle-kit migrate` 0.31.10 calls. It reads only the newest `created_at` in `drizzle.__drizzle_migrations`, then runs every journal entry with a later `when`, in journal order, in one transaction. File hashes are recorded but never compared.
  - **0001 and 0002 keep their dates.** Both were written with 2025 for 2026; their files were committed on 2026-03-31 (`edbbdf0`) and 2026-07-26 (`2f8a630`). Re-dating them isn't safe, because to migrate a database that recorded only 0000 looks the same as one that recorded 0000–0002 and nothing later. The first would get 0001 and 0002; the second would re-run 0002, whose `CREATE TABLE` has no `IF NOT EXISTS`, and fail. Left as they are, no database's next migrate changes.
  - **Correction to the finding.** With today's migrations, a database that recorded only 0000 or 0001 doesn't end up silently without 0002: its next migrate skips 0002, fails at 0003 (which alters a 0002 table) and rolls back. The silent skip was real while 0001 or 0002 was the newest migration. This is reasoned from the SQL, not run against such a database.
  - **Journal check.** scripts/check-migration-journal.mjs refuses a journal where:
    - an entry isn't dated later than every entry before it
    - an entry has no .sql file, or a .sql file has no entry
    - `idx` isn't 0, 1, 2, … in order, `when` isn't an integer, or a tag repeats

    0001 and 0002 are allowed at exactly their current values only. npm runs the check as `prebuild` and `predb:migrate`, so a mis-dated migration fails `npm run build` (the Docker build included) and stops `npm run db:migrate` before drizzle-kit starts.
  - **Production report.** `DATABASE_URL=… node scripts/f20-migration-state-report.mjs` opens a read-only session, as the F-09 report does. For each migration it shows:
    - whether it's recorded (a row with the same file hash)
    - whether its changes are present (a schema check of what it creates or alters)
    - whether `drizzle-kit migrate` would run it

    It also lists recorded rows that match no file, and warns when migrate would run migrations whose changes already exist.
  - **Verified** by `tests/f20-migration-journal.test.mjs`:
    - The check refuses an entry dated 1 ms before 0012 or at the same time, a new entry with a legacy date, an edited 0001 date, a missing or extra .sql file, a wrong `idx`, a string `when` and a repeated tag. It accepts this journal, and this journal plus an entry dated now.
    - package.json runs the check before `build` and `db:migrate`; it passes on this journal; no entry is dated in the future.
    - drizzle-orm's own `migrate()`, run with a stand-in session, runs an extra migration dated 1 ms after the newest recorded one and skips, without an error, one dated 1 ms before. For every "recorded through entry k" state it runs exactly the entries after k; a database stuck at 0000 or 0001 would skip through 0002.
    - The report, on the throwaway database, inside a transaction that is rolled back:
      - with no migrations table, migrate would run all 13, and every migration's changes are already present
      - with 0000–0004 recorded plus one edited row, it shows 0000–0004 recorded and migrate running 0005–0012 (the same list drizzle's own migrator gives), all eight clashing, and the edited row matching only 0003's date
    - The report's connection refuses writes, and the command runs without printing the password.

    Before the fix, 5 of 6 failed: there was no check, no report and no npm hook. The migrator test passed, because it documents drizzle's existing behaviour. On a copy of drizzle/ with an extra entry dated 1 ms before 0012, the check exits 1 and names that entry; on the real folder it exits 0. `npm run build` now prints the check's result before `next build` runs, and the build passes. `tests/f21-docker-context.test.mjs` now also requires `scripts` and `drizzle` in the Docker build context. Full suite (`--test-concurrency=1`): 178 tests pass.
  - **Still needs the owner.** Run the report against production before the next migration. A working note from 2026-08-12 says production recorded only 0000–0004 and later migrations were applied by hand. If that still holds, `db:migrate` there would try to re-run 0005 onwards, fail and roll back, so keep applying migrations by hand (F-06 deploy note) until the report says otherwise. Recording the hand-applied migrations in the table would be a write to production and wasn't done.
  - **Residual:**
    - Hand-written entries must still be dated with `Date.now()`. An entry dated in the future passes the check, but the next generated migration then fails the build until the date is fixed. The F-20 test also fails on a future date.
    - Each schema check in the report looks at one distinctive change per migration, not all of it. A new migration shows "not checked" until a check is added.
    - F-33 is unchanged: a database built only from migrations still lacks columns the code uses.
- **F-22 — fixed in working tree; no migration.**
  - **Responses.** `/api/dashboard`, `/api/dashboard/orders`, `/api/dashboard/cargo`, `/api/reports` and `/api/account` now answer a failure with only `{ "error": "Internal server error" }`, like the other route handlers. Before, a `dateFrom` that isn't a date was enough to get the full SQL and the values sent back from the first four, and `/api/dashboard` also sent the Postgres error. `/api/account` reads no query parameters, so it wasn't reproduced there.
  - **Logs.** src/lib/log-redaction.ts replaces a database error passed to `console.*` with a copy for printing:
    - drizzle's "Failed query" keeps the SQL and says how many values were withheld, instead of listing them
    - the Postgres error keeps its code, table, column, constraint, routine and message, but not `detail`; a NOT NULL or CHECK violation puts the whole failing row there, password hash included
    - a class 22 (data exception) message is withheld too, because it can quote the input, e.g. `invalid input syntax for type date: "…"`
    - the stack is kept, and the original error isn't changed, so code that handles it still sees everything

    src/instrumentation.ts installs it when the server starts, on `console.error`, `warn`, `log`, `info` and `debug`. That covers the route handlers' `console.error(label, err)` calls and also the errors Next.js logs itself for the 20 database-using handlers without try/catch: Next's `Log.error` looks up `console.error` when it logs (node_modules/next/dist/build/output/log.js), so it goes through the redaction.
  - **Removed** the `console.log` on every render of the order page.
  - **Not done: a request id.** The proposed fix returned one with each 500. Only these five handlers would have had it unless every catch block changed, so 500s stay uniform; match a user's report to the log by route and time.
  - **Verified** by `tests/f22-error-exposure.test.mjs`:
    - unit tests with a real `DrizzleQueryError`: a failed users insert whose values and failing-row detail contain a bcrypt hash prints the SQL, "4 values withheld", code 23502, the table and the stack, and none of the values, the detail or the hash; the original error keeps its values
    - a class 22 message, a bare Postgres error's detail, and a database error nested in another error's cause are redacted; anything else passes through unchanged
    - installed on a console, every method prints the redacted form, and installing twice doesn't wrap twice
    - no route handler reads `err.message`, `err.cause`, `err.stack` or `String(err)`; no console call interpolates an error into a string; src/instrumentation.ts installs the redaction; the order page has no `console.log`
    - live, on a local build against the throwaway database: the four summaries answer `?dateFrom=<marker>` with only the generic error
    - live, in the server's log: after a caught write failure (a foreign key, with the marker in its values) and an uncaught one (a NUL character in a handler without try/catch, so Next.js logs it), the marker appears nowhere, while the route labels, error codes 23503 and 22021, the constraint name and "values withheld" do

    Before the fix all 7 failed. The summaries sent back the SQL with `params: <marker>`. The log held each marker three times per error (message, stack and `params`), plus `detail: 'Key (order_id)=(<marker>) is not present in table "orders".'`, and for the uncaught error Next.js's own `⨯` line printed `params: [ …, '<marker>', … ]`. After the fix all 7 pass. Full suite (`--test-concurrency=1`): 185 tests, 184 pass and 1 is skipped — F-22's log check, which needs `AUDIT_SERVER_LOG` and passed in its own run. `tsc --noEmit` is clean and `npm run build` passes. After the whole suite, the server log held no raw parameter list, no "Failing row" and no bcrypt hash.
  - **Residual:**
    - The redaction works on error objects. An error turned into text before logging (`${err}`, `err.message`) bypasses it; the test catches that in route handlers and log calls, but a new pattern could slip past.
    - Postgres messages outside class 22 are kept. The ones seen name tables, columns and constraints, not values, but I am not certain that holds for every message.
    - The SQL text is kept. Values go as placeholders, but a fragment built with `sql.raw` appears as written; I didn't check each one.
    - Auth.js's own logger is unchanged (§6 item 12).
- **New finding F-33 (found while verifying F-06).** A database built only from drizzle/0000–0009 lacks at least four columns the code uses: `expenses.expense_id`, `expenses.title`, `expenses.expense_date` and `cargo_items.note`. (Found later, while verifying F-10: migration 0000 creates the last two expense columns under their old names, `description` and `date`, both NOT NULL. So on such a database, creating an expense also fails.) On such a database the expenses API, the trash and the public `/t/[code]` page return 500 (`errorMissingColumn`). Existing databases presumably gained these columns through `db:push` — step 2 of the tracked setup doc (memory/project_shop_manager.md:33) is `npm run db:push`. Consequences: rebuilding from migrations (disaster recovery, a new environment) yields a broken app, and production's `drizzle.__drizzle_migrations` may not reflect its real schema — so check both before running `db:migrate` there (F-20). **Fixed** by migration 0013 — see F-33 below.
- **F-23 — fixed in working tree; decision agreed with the owner on 2026-09-12.**
  - **Decision.** The public page closes when a shipment is delivered or cancelled. There is no time limit after arrival.
  - **Fix.**
    - `isTrackingClosed()` (src/components/cargo/public-tracking-status.ts) is true for `cancelled` as well as `delivered`. The closed page says "Cancelled — This shipment was cancelled. Its details are no longer published here."
    - `/t/[code]` selects only `shopName` and `logoUrl` from shop_settings. The five components that receive it (view, header, closed page, both label templates) take a new `PublicShop` type; staff pages still pass the full row, which fits it.
    - The item note's placeholder reads "Optional note — printed on the label and shown to anyone who scans it".
    - src/lib/public-code.ts now states the alphabet correctly: 31 characters, about 59 bits.
  - **Verified** by `tests/f23-public-tracking.test.mjs`:
    - which statuses close the page; the page doesn't select the whole settings row; the placeholder and the comment
    - live: an in-transit shipment's page shows its consignee (control); a cancelled one shows neither phone nor address; neither page contains `customerIdPrefix`, `orderIdPrefix`, `cargoIdPrefix`, `defaultExchangeRate` or `currencyCode`

    Before the fix every check but the control failed. Also checked in headless Chrome as an anonymous visitor: the cancelled page shows the closed message, with no phone number and no settings keys in the page.
  - **Residual:** a shipment nobody marks delivered or cancelled stays public (by decision). The item note is public by design.
- **F-24 — fixed in working tree.**
  - **Fix.**
    - The DELETE handlers for order items, cargo items, cargo payments and cargo expenses parse the body inside try/catch with a zod schema (`deleteOrderItemSchema`, `deleteCargoItemSchema`, `deleteCargoPaymentSchema`, `deleteCargoExpenseSchema`). A body that isn't JSON, a `null` body, or an id that isn't a string gets 400.
    - They change only rows that aren't in the trash, and return 404 when nothing changed.
    - `PATCH /api/cargo-items/:id` answers a body that isn't a JSON object with 400. The bag move and bag rename skip trashed items and return 404 ("Item not found", "Bag not found") when nothing matched.
  - **Verified** by `tests/f24-body-handling.test.mjs`, live, for all four DELETE handlers:
    - a malformed and a `null` body get 400, and so does a numeric id
    - a trashed or missing row gets 404, and the trashed row's `deleted_at` is unchanged; a live row is moved to the trash
    - moving a trashed item, and renaming a bag that only trashed items carry, get 404; renaming a bag leaves a trashed item's label alone

    Before the fix all four checks failed: `{not json` gave 500, a numeric id "succeeded" with 200, and trashed rows were moved and deleted again.
  - **Residual:** the create and edit handlers still answer a body that isn't JSON with 500, because their catch treats the parse error as a server error.
- **F-25 — fixed in working tree.**
  - **Fix.** `missingRecord()` (src/lib/parents.ts) looks each referenced record up inside the write's transaction with `deleted_at is null … for share`, so it can't be moved to the trash or deleted before the write commits. It returns a 404 naming the first one missing, e.g. "Cargo shipment not found". It is used by:
    - order-item creates: the order
    - cargo-item creates: the shipment, order, order item, customer and category
    - payment creates: the shipment, and a receiver payment's customer
    - expense creates: the shipment
    - shipment creates: every item's order, order item, customer and category
    - cargo-item edits that set a category

    Inside `createOnce` a refusal also releases the idempotency key (F-13).
  - **Verified** by `tests/f25-parent-checks.test.mjs`, live:
    - the same writes on live records succeed (control)
    - an order item on a trashed or missing order, and a cargo item, payment or expense on a trashed or missing shipment, get 404 and save nothing
    - a cargo item pointing at a trashed or missing customer, a trashed order, a missing order item or a trashed or missing category; a receiver payment for a trashed customer; and a new shipment whose item has a missing category or a trashed customer all get 404 and save nothing
    - editing a cargo item onto a trashed category gets 404 and changes nothing

    Before the fix every check but the control failed: trashed parents were accepted with 201, and missing ones gave 500.
  - **Tests updated:** F-13's "a failed create doesn't use up its key" now expects 404 (it was a foreign-key 500). F-14's "a write that fails leaves no log row" and F-22's caught log check now use a duplicate category name, which still fails inside the database. F-22's uncaught check now uses a NUL character in `GET /api/orders/:id`, since F-24 wrapped the cargo-item DELETE in try/catch.
  - **Residual:** nothing checks that a cargo item's order item belongs to the order it names. Edits other than a cargo item's category don't re-check the records they point at.
- **F-26 — fixed in working tree.**
  - **Correction to the finding.** With drizzle-orm 0.45, `?page=abc` didn't give a 500: drizzle leaves out a NaN offset, so it showed page 1 with `meta.page: null`. `?limit=abc` was worse than described: a NaN limit is left out too, so every matching row came back and the 100-row cap was gone. The 500s came from `?page=1e308` (an infinite offset) and `?limit=2.5`.
  - **Fix.** `intParam()` and `containsPattern()` in src/lib/query.ts.
    - The orders, customers, expenses, cargo shipments, users and audit-log lists read page (1–1,000,000) and limit (1–100) with `intParam`, which uses the default for anything that isn't a finite number.
    - All eleven search patterns use `containsPattern`, which escapes `%`, `_` and `\`.
    - The username-taken checks on create and edit compare `lower(name) = lower(new name)`: case still counts as the same name, but `_` is no longer a wildcard.
  - **Verified** by `tests/f26-query-parsing.test.mjs`:
    - unit tests of both helpers; a guard that no list route reads page or limit with `Number()` and no route builds a LIKE pattern from raw input
    - live: `?limit=abc` returns 20 of 29 matching customers; six odd values on all six lists return 200 with whole-number meta and a limit of at most 100; searches for `50%off` and `a_b` match only those names; `f26_…` can be created and renamed to next to `f26x…`/`f26y…z`; a name differing only in case is still refused

    Before the fix every check failed.
  - **Residual:** other query parameters (status, sort, dates) are unchanged, and a `dateFrom` that isn't a date still gives 500 on the summaries (the F-22 test relies on it).
- **F-27 — fixed in working tree.**
  - **Fix.** `safeHref()` in src/lib/utils.ts returns a URL only for http and https. The order items table makes a link only of those, and shows anything else as plain text: a `javascript:` or `data:` link, a bare domain, pasted share text. The schema is unchanged; product links stay free text, as decided under F-15.
  - **Verified** by `tests/f27-product-link.test.mjs`: http and https become links; `javascript:` (in any case, with leading space), `data:`, `vbscript:`, protocol-relative, bare domains, share text and empty values don't; no component puts `productUrl` into an href directly. Before the fix both checks failed. In headless Chrome, an order with a `javascript:alert(1)` link and an https link showed the first as text, with no `<a href="javascript…">`, and the second as a link.
  - **Residual:** share text that contains a URL is shown as text rather than a link; before, it was a broken link.
- **F-28 — fixed in working tree.**
  - **Fix.** `toCsv()` in src/lib/utils.ts quotes every cell, doubles quotes inside it, and prefixes a cell starting with `=`, `+`, `-`, `@`, tab or carriage return with `'`, unless it's a plain number. The orders, customers and expenses exports use it. The order total was already fixed under F-10.
  - **Verified** by `tests/f28-csv-export.test.mjs` (quotes, commas and newlines, formula starts, plain and negative numbers; all three pages use the helper) and in headless Chrome, where a customer named `=HYPERLINK("http://evil.example","…")` exported as `"'=HYPERLINK(""http://evil.example"",""…"")"`. Before the fix both checks failed.
  - **What the owner will see change:** a phone number starting with `+` exports as `'+95…`. Without the `'`, a spreadsheet reads `+95-9…` as a formula and shows the result of the subtraction.
  - **Residual:** the exports still cover only the page on screen, as before.
- **F-29 — fixed in working tree; decision agreed with the owner on 2026-09-12.**
  - **Decision.** With a missing or invalid setting the server refuses to start.
  - **Fix.**
    - `envProblems()` in src/env.ts lists the problems with DATABASE_URL, NEXTAUTH_SECRET (at least 16 characters) and NEXTAUTH_URL, naming the setting but never its value. env.ts no longer throws when imported.
    - src/instrumentation.ts runs it when the server starts and exits with status 1, printing "Refusing to start: invalid environment settings" and the list. It doesn't run during `next build`.
    - src/lib/auth.ts passes `secret: process.env.NEXTAUTH_SECRET` to Auth.js, so a different AUTH_SECRET can't be used in its place.
  - **Verified** by `tests/f29-env-check.test.mjs`: unit tests of the check, including that a value isn't printed; guards for the startup hook and auth.ts; live, `next start` with a 13-character secret exits with status 1, naming NEXTAUTH_SECRET without printing the secret. Before the fix the server kept running. `npm run build` with a 5-character NEXTAUTH_SECRET passes, so the Docker build, which has no runtime settings, isn't affected.
  - **Deploy.** Before deploying, confirm production sets DATABASE_URL, NEXTAUTH_SECRET (at least 16 characters) and NEXTAUTH_URL (a full URL), or the container won't start. docker-compose.yml passes all three.
  - **Residual:** setting only AUTH_SECRET is no longer enough.
- **F-30 — risk accepted by the owner on 2026-09-12.** The tracking codes that migration 0007 backfilled with `md5(random())` stay as they are, and no labels are reprinted. Guessing one is impractical, and since F-23 a code's page closes once its shipment is delivered or cancelled, which older shipments should be. Codes the app has made since 0007 come from nanoid's secure generator.
- **F-31** was fixed in the quick hardening batch (above).
- **F-32 — partly done in working tree; decision agreed with the owner on 2026-09-12.**
  - **Decision.** In-range patches only: not next-auth 5.0.0-beta.32, and not next 16.3.5.
  - **Done.** `npm update` of axios (1.13.6 → 1.20.0), drizzle-orm (0.45.1 → 0.45.2), nanoid (5.1.7 → 5.1.16, and 3.3.11 → 3.3.19 under next and postcss), form-data (4.0.5 → 4.0.6), follow-redirects (1.15.11 → 1.16.0), proxy-from-env (1.1.0 → 2.1.0), hasown and baseline-browser-mapping. Only package-lock.json changed; package.json's ranges already allowed these. A plain `npm audit fix` would also have moved next-auth to beta.32, because `^5.0.0-beta.30` allows it, so it wasn't used.
  - **Verified.** `npm audit --omit=dev` goes from 11 advisories (3 critical, 6 high, 2 moderate) to 5 (3 critical, 2 high). `npm run build` passes, and the full suite and both browser checks pass on the updated build; the F-18 check drives axios's PATCH and DELETE bodies.
  - **Still open:** @auth/core 0.41.0 (critical; needs next-auth beta.32), and next 16.2.12 with its postcss and sharp (they need next 16.3.5, outside the pinned range). Appendix B §M explains why none is reachable here.
- **F-33 — fixed in working tree; check production with the F-20 report before running 0013 there.**
  - **Fix.** drizzle/0013_expenses_cargo_note_columns.sql renames `expenses.description` → `title` and `expenses.date` → `expense_date` only when the new name doesn't exist yet, and adds `expenses.expense_id` and `cargo_items.note` with `IF NOT EXISTS`. On a database whose columns came from `db:push`, every statement is a no-op. The F-20 report checks 0013's columns. The journal check caught a first attempt at the entry dated ten minutes in the future.
  - **Verified** by `tests/f33-migrations-schema.test.mjs`:
    - every migration file is run, in journal order, into a fresh schema inside a transaction that is rolled back, and its columns are compared with every column the Drizzle schema declares (listed by `tests/helpers/schema-columns.ts` with tsx)
    - 0013, run twice on a database that already has the columns, changes nothing

    Before the fix exactly the four columns above were missing; after it, none are. A schema change without a migration now fails this test.
  - **Deploy.** Run the F-20 report against production. If 0013's columns are already there, which is expected, nothing needs doing; otherwise apply 0013's statements by hand (F-06 deploy note).
  - **Residual:** a database that has both `description` and `title` keeps both. Some column types still differ between migration 0000 and the schema (`expenses.id` varchar(21) vs text, `expenses.category` varchar(50) vs text); neither breaks the app. Not checked against production.
- **Verification across F-23–F-33.**
  - Each new test ran against the unfixed code first; the failures are listed per finding.
  - After the fixes and the dependency update: `tsc --noEmit` is clean, `npm run build` passes, and the full suite (`--test-concurrency=1`, with `AUDIT_SERVER_LOG`) passes 217 of 217 with nothing skipped, twice in a row. The server log held no raw parameter list, Postgres row detail or bcrypt hash.
  - Headless Chrome: the F-23/F-27/F-28 check (7) and the F-18 Users-page check (17) pass on the final build.
  - **Test hygiene.** An F-13 check ("a base-currency change waits for a money record still being saved") skips while any order, shipment, payment, expense or category exists. An earlier full run skipped it because the new tests left rows behind. The F-23, F-24 and F-25 tests, and the categories F-14 and F-22 create, now clean up after themselves, and this session's leftover rows were removed from the throwaway database; both final runs ran that check. The F-20 journal test named 0012 as the newest entry and now uses the last one.

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
| F-09 | HIGH | G Money | src/db/schema/orders.ts:11-16 | ✗ open — read-only precision report added; F-10/F-11 now settled (see §1a) — All monetary values stored as `double precision` and computed as JS floats |
| F-10 | HIGH | G Money | src/app/api/dashboard/route.ts:73-74 | ✓ fixed (WT; definitions agreed with owner — see §1a) — Revenue and profit have conflicting definitions; percentage service fee summed as money |
| F-11 | HIGH | G Money | src/components/cargo/cargo-detail-client.tsx:188-192 | ✓ fixed (WT; migration 0010 must run first; decisions agreed with owner — see §1a) — Cargo payment balances depend on a per-browser localStorage currency |
| F-12 | MEDIUM | A/E Access control | src/app/api/dashboard/route.ts:28-30 | ✓ fixed (WT; summaries manager+, agreed with owner; records still visible to staff — see §1a) — Financial data blocked in `/api/reports` is served to every role by other endpoints |
| F-13 | MEDIUM | G Correctness | src/app/api/orders/route.ts:96-126 | ✓ fixed (WT; migration 0012 must run first — see §1a) — No transactions, racy display-number generation, no idempotency |
| F-14 | MEDIUM | K Audit | src/db/schema/index.ts:1-11 | ✓ fixed (WT; migration 0011 must run first; owner-only Activity page — see §1a) — No audit trail for any money, status, delete or user change |
| F-15 | MEDIUM | F Validation | src/validations/order.schema.ts:10-40 | ✓ fixed (WT; see §1a) — Amounts, rates, percentages and quantities have no upper bounds; dates unvalidated |
| F-16 | MEDIUM | C Auth | src/app/(auth)/login/page.tsx:22,44 | ✓ fixed (WT; see §1a) — Open redirect after login via `callbackUrl` |
| F-17 | MEDIUM | J Headers | next.config.ts:5-14 | ✓ fixed (WT; CSP still open — see §1a) — No CSP, HSTS, frame, nosniff or referrer headers; `X-Powered-By` enabled |
| F-18 | MEDIUM | C Auth | src/app/api/users/[id]/route.ts:35-107 | ✓ fixed (WT; resets, role changes and deletes ask for the owner's own password, agreed with owner; creating a user doesn't — see §1a) — Owner resets other users' passwords/roles with no re-authentication; 6-char passwords allowed |
| F-19 | MEDIUM | F/G Correctness | src/validations/settings.schema.ts:8-10 | ✓ fixed (WT; numbering itself is F-13 — see §1a) — Any role can set an ID prefix that breaks order/customer/shipment creation |
| F-20 | MEDIUM | N Migrations | drizzle/meta/_journal.json | ✓ fixed (WT; journal checked before build and db:migrate; 0001/0002 keep their dates; production still to be checked with the read-only report — see §1a) — Journal timestamps out of order; Drizzle silently skips older migrations |
| F-21 | MEDIUM | I Secrets | Dockerfile:15,36 | ✓ fixed (WT; see §1a) — No `.dockerignore`; `.env` can be baked into the runtime image |
| F-22 | LOW | K Logging | src/app/api/dashboard/route.ts:150-159 | ✓ fixed (WT; 500s say only "Internal server error"; database errors are redacted in every log line; no request id — see §1a) — 500 responses return SQL text and params; failed user writes log bcrypt hashes |
| F-23 | LOW | E Exposure | src/app/t/[code]/page.tsx:77-111 | ✓ fixed (WT; closes when delivered or cancelled, agreed with owner; only shop name and logo sent — see §1a) — Public tracking page stays open for cancelled shipments; full shop row sent to anonymous users |
| F-24 | LOW | F Validation | src/app/api/cargo-items/[cargoShipmentId]/route.ts:117-134 | ✓ fixed (WT; see §1a) — DELETE/bag handlers parse body outside try, don't type-check ids, touch deleted rows |
| F-25 | LOW | G Integrity | src/app/api/cargo-payments/[cargoShipmentId]/route.ts:56-67 | ✓ fixed (WT; see §1a) — Child rows can be attached to deleted or non-existent parents |
| F-26 | LOW | F Validation | src/app/api/orders/route.ts:15-16 | ✓ fixed (WT; symptom corrected: `?limit=abc` removed the page-size cap — see §1a) — `?page=abc` gives 500; LIKE wildcards unescaped; username check uses `ilike` |
| F-27 | LOW | J XSS | src/components/orders/order-items-section.tsx:196 | ✓ fixed (WT; only http(s) links are clickable; links stay free text per F-15 — see §1a) — `productUrl` rendered as a link without scheme validation |
| F-28 | LOW | J Export | src/app/(dashboard)/orders/page.tsx:70-80 | ✓ fixed (WT; orders, customers and expenses exports — see §1a) — CSV export doesn't escape quotes or neutralise spreadsheet formulas |
| F-29 | LOW | I Config | src/env.ts:1-19 | ✓ fixed (WT; the server refuses to start with bad settings, agreed with owner; check production's settings before deploying — see §1a) — Environment validation module is never imported |
| F-30 | LOW | E Public code | drizzle/0007_cargo_item_public_code.sql:10-12 | ✓ risk accepted (owner, 2026-09-12; see §1a) — Backfilled tracking codes generated with `md5(random())` |
| F-31 | LOW | I Deploy | docker-compose.yml:6-7,12 | ✓ fixed (WT; see §1a) — Compose publishes port 3000 on all interfaces with `AUTH_TRUST_HOST=true` |
| F-32 | LOW | M Deps | package.json:33,38,41,43 | ◐ in-range patches applied (WT; owner decision); next-auth beta bump and next 16.3.5 not done — see §1a — Advisories in axios, drizzle-orm, nanoid, @auth/core — not reachable, but should be patched |
| F-33 | MEDIUM | N Migrations | drizzle/*.sql vs src/db/schema/expenses.ts, cargo-items.ts | ✓ fixed (WT; migration 0013, a no-op where the columns exist — see §1a) — Added after the audit — migrations never create `expenses.expense_id`/`title`/`expense_date` or `cargo_items.note`; a database built from migrations breaks expenses, trash and public tracking |

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

> **Status: not fixed.** A read-only precision report (scripts/f09-money-precision-report.mjs) is ready to run against production. F-10's definitions and F-11's base currency, which the migration waited on, are now settled. See §1a.

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

> **Status: fixed in working tree (not committed).** The definitions agreed with the owner are implemented once, in src/lib/order-money.ts and src/lib/order-money-sql.ts. See §1a for the definitions and the visible changes.

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

> **Status: fixed in working tree (not committed); migration 0010 must run first.** Currency settings live in `shop_settings` (THB base, MMK exchange), balances use the server's value, and the payments and settings APIs enforce the agreed rules. See §1a.

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

> **Status: fixed in working tree (not committed).** Money summaries are for managers and the owner, enforced by the route handlers and mirrored in the sidebar and pages. By the owner's decision, the individual records stay visible to staff, so this isn't a hard barrier. See §1a.

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

> **Status: fixed in working tree (not committed); migration 0012 must run first.** Each create that records money or a numbered record now runs in one transaction and is saved at most once per Idempotency-Key. Display numbers are computed inside that transaction under a lock, and the settings save checks and writes in one transaction. By the owner's decision, numbers are still "highest existing + 1". See §1a.

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

> **Status: fixed in working tree (not committed); migration 0011 must run first.** Database triggers record every change, with who made it and the values before and after, in an append-only `audit_log`, inside the same transaction as the change. The owner reads it in Settings → Activity. See §1a.

**Area:** K Logging and audit
**Where:** the whole codebase; there is no audit table in src/db/schema/index.ts:1-11.

**What I found.** Nothing records who created, changed, restored or deleted an order, fee flag, payment, expense, user or setting, or what the values were before and after. `orders.updatedAt` is not even set on a single-order PATCH (src/app/api/orders/[id]/route.ts:55-58). Combined with F-03 and F-04, misuse by any account cannot be detected.

**Proposed fix.** Add an append-only `audit_log` table recording `at`, `user_id`, `role`, `action`, `entity`, `entity_id`, `before` (jsonb), `after` (jsonb) and `ip`. Write to it in the same transaction as each money, status, delete or user change, and deny UPDATE/DELETE on it at the database-role level.
**Effort:** Medium

#### F-15 — Numeric inputs have no upper bounds; dates and some strings unvalidated

> **Status: fixed in working tree (not committed).** Every amount, rate, weight, quantity, text field, ID and list in the request schemas now has an upper limit. Dates must be real calendar dates, and a blank date means no date. A percentage service fee is capped at 100%. The limits follow the owner's decisions of 2026-09-12. See §1a.

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

> **Status: fixed in working tree (not committed).** The login page redirects only through `safeRedirectPath()`. See §1a.

**Area:** C Authentication
**Where:** src/app/(auth)/login/page.tsx:22, 44.

**What I found.** `callbackUrl` is read from the query string and passed to `router.push`. Next.js blocks `javascript:` URLs (node_modules/next/dist/client/components/app-router-instance.js:343-349) but treats an absolute or protocol-relative URL as an external navigation (:231). A link to `/login?callbackUrl=https://evil.example/` sends a freshly signed-in user to a look-alike page, for example one saying "session expired, sign in again".

**Proposed fix.** Accept `callbackUrl` only if it starts with a single `/` (not `//`), or resolve it against `location.origin` and require the same origin. Otherwise fall back to `/dashboard`.
**Effort:** Small

#### F-17 — No security response headers

> **Status: fixed in working tree (not committed), except CSP.** HSTS, nosniff, Referrer-Policy and X-Frame-Options on every route; X-Powered-By off. See §1a.

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

> **Status: fixed in working tree (not committed).** A password reset, role change or delete asks for the acting owner's own password, and wrong entries are limited per account; the single password minimum was done under F-07. Creating a user and renaming one don't ask, by decision. See §1a.

**Area:** C Authentication
**Where:** src/app/api/users/[id]/route.ts:35-107 (PATCH) and :114-135 (DELETE); src/validations/user.schema.ts:11-14, 25-30 (minimum 6); src/validations/settings.schema.ts:16 (minimum 8 for self-service).

**What I found.** An owner session can reset another owner's password, rename them, demote them or delete them, with no current-password prompt. That includes a session obtained through F-05, F-08 or a copied cookie (F-06). Only changing your own role (:58) and deleting yourself (:127) are blocked. Passwords set by an owner can be 6 characters.

**Proposed fix.** Require the acting owner's current password (checked with bcrypt) for password resets, role changes and deletes of other users, and invalidate the target user's sessions (F-06). Use one password policy for every path.
**Effort:** Small

#### F-19 — Any role can break record creation through ID prefixes

> **Status: fixed in working tree (not committed).** Prefixes are letters and digits only, and settings are owner-only (F-04). Sequence-based numbering remains under F-13. See §1a.

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

> **Status: fixed in working tree (not committed).** A journal check runs before `npm run build` and `db:migrate` and refuses an entry dated before an earlier one; 0001 and 0002 keep their dates as named exceptions. A read-only report shows what a database recorded and what migrate would run; production hasn't been checked with it yet. See §1a.

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

> **Status: fixed in working tree (not committed).** `.dockerignore` keeps secrets and local artefacts out of the build context. See §1a.

**Area:** I Secrets and configuration
**Where:** Dockerfile:15 (`COPY . .`) and :36 (copies `.next/standalone` into the runner); no `.dockerignore`. A local build shows `.next/standalone/.env` exists.

**What I found.** Next.js standalone output copies `.env` into `.next/standalone`, and the runner stage copies that directory into the final image. Any image built from a working copy that contains `.env` or `.env.local` therefore carries `DATABASE_URL` and `NEXTAUTH_SECRET` in a layer. That includes `docker compose build` run locally (docker-compose.yml:3-4). Coolify normally builds from a git clone, where `.env*` is ignored, so production images are probably clean — not confirmed.

**Proposed fix.** Add a `.dockerignore` that excludes `.env*`, `.next`, `node_modules`, `.git`, `memory` and `.claude`, and supply secrets only at runtime. If an image built with `.env` was ever pushed to a registry, rotate those secrets.
**Effort:** Small

### LOW

#### F-22 — Error responses and logs expose SQL and parameters

> **Status: fixed in working tree (not committed).** Failed queries answer with only "Internal server error". A redaction installed at server start strips parameter values and Postgres row details from every database error written to the logs, including the ones Next.js writes. The per-render `console.log` is gone. See §1a.

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

> **Status: fixed in working tree (not committed).** The page also closes for cancelled shipments (no time limit after arrival, by decision), sends only the shop's name and logo, and the note field tells staff that anyone who scans the label sees the note. The alphabet comment is corrected. See §1a.

**Area:** E Data exposure
**Where:** src/app/t/[code]/page.tsx:39, 71, 77-111; src/components/cargo/public-tracking-status.ts:11-13.

**What I found.** By design, anyone holding the 12-character code sees the consignee's name, phone, address and city, plus the item note (labelled "Handling note"). The data is correctly narrowed into a DTO. Three problems remain:

- The page closes only for `delivered`. A `cancelled` shipment keeps publishing personal data for as long as the sticker exists.
- The full `shop_settings` row, including internal ID prefixes, is sent to anonymous visitors (:71, :85, :111).
- The code has about 59 bits of entropy. The alphabet has 31 characters, not the 32 stated in src/lib/public-code.ts:10-14. Brute force is still impractical.

**Proposed fix.** Also close the page for `cancelled` (and some period after arrival). Pass only the shop's name, phone and logo to the public components. Make sure staff know the item note is public.
**Effort:** Small

#### F-24 — Weak body handling in DELETE and bag-edit handlers

> **Status: fixed in working tree (not committed).** The four child DELETE handlers and the bag edits validate their body inside try/catch, skip trashed rows and return 404 when nothing changed. See §1a.

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

> **Status: fixed in working tree (not committed).** Creates of order items, cargo items, payments, expenses and new shipments' items, and cargo-item category edits, check every record they point at inside their transaction and return 404 if one is missing or in the trash. See §1a.

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

> **Status: fixed in working tree (not committed).** The six list endpoints parse page and limit into bounded whole numbers, search terms match `%` and `_` literally, and username checks compare lower-cased names. The symptoms below were described wrongly: `?page=abc` returned page 1 and `?limit=abc` removed the page-size cap; `?page=1e308` and `?limit=2.5` were the 500s. See §1a.

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

> **Status: fixed in working tree (not committed).** The order items table makes a link only of http and https addresses and shows any other text as text. The schema still accepts any text, as decided under F-15. See §1a.

**Area:** J XSS
**Where:** src/components/orders/order-items-section.tsx:196; src/validations/order.schema.ts:10.

**What I found.** `productUrl` accepts any string and is rendered as `<a href>`. React 19 blocks `javascript:` URLs, so script execution is mitigated. `data:` and look-alike phishing links still get through.

**Proposed fix.** Validate `productUrl` as http/https in the schema and render anything else as plain text.
**Effort:** Small

#### F-28 — CSV export is not escaped

> **Status: fixed in working tree (not committed).** The orders, customers and expenses exports go through one helper that quotes every cell, doubles quotes inside it and prefixes a formula-like cell with `'`. The exported order total was already fixed under F-10. See §1a.

**Area:** J Export
**Where:** src/app/(dashboard)/orders/page.tsx:70-80.

**What I found.** Values are wrapped in quotes without doubling embedded quotes. Cells starting with `=`, `+`, `-` or `@` are not neutralised, so a customer name can inject a spreadsheet formula when the file is opened. The exported total also uses the raw service-fee sum from F-10.

**Proposed fix.** Double embedded quotes, and prefix cells that start with a formula character with `'`.
**Effort:** Small

#### F-29 — Environment validation is never run

> **Status: fixed in working tree (not committed).** The server checks DATABASE_URL, NEXTAUTH_SECRET and NEXTAUTH_URL when it starts and refuses to start if one is missing or invalid (owner decision); `next build` doesn't run the check. Confirm production sets all three before deploying. See §1a.

**Area:** I Configuration
**Where:** src/env.ts:1-19 (nothing imports it); src/db/index.ts:5; drizzle.config.ts:8.

**What I found.** `env.ts` validates `DATABASE_URL`, `NEXTAUTH_SECRET` (at least 16 characters) and `NEXTAUTH_URL`, but nothing imports it, so a missing or short secret isn't caught at startup. There are no insecure fallback values such as `|| 'dev'`; `DATABASE_URL!` is only a non-null assertion.

**Proposed fix.** Import `env` in src/db/index.ts and src/lib/auth.ts, and pass the secret to NextAuth explicitly.
**Effort:** Small

#### F-30 — Backfilled tracking codes use a non-cryptographic generator

> **Status: risk accepted by the owner (2026-09-12).** The codes backfilled by migration 0007 stay as they are, and no labels are reprinted. Since F-23 their pages close once a shipment is delivered or cancelled. See §1a.

**Area:** E Public code
**Where:** drizzle/0007_cargo_item_public_code.sql:10-12.

**What I found.** Cargo items created before migration 0007 got `upper(substr(md5(random()::text || clock_timestamp()::text || id), 1, 16))`. Postgres `random()` is not a cryptographically secure generator. Predicting codes is unlikely in practice, but these codes are the only thing protecting consignee personal data (F-23).

**Proposed fix.** Either regenerate codes for those older rows with `newCargoItemPublicCode()` (which means reprinting their labels), or explicitly accept the residual risk.
**Effort:** Small

#### F-31 — docker-compose exposes the app port directly

> **Status: fixed in working tree (not committed).** The compose port is bound to 127.0.0.1. See §1a.

**Area:** I Deployment
**Where:** docker-compose.yml:6-7, 12.

**What I found.** `ports: "3000:3000"` publishes the container on every host interface, and `AUTH_TRUST_HOST=true` trusts forwarded headers. If this file is used on the Coolify host and port 3000 isn't firewalled, the app is reachable over plain HTTP, bypassing Traefik and TLS.

**Proposed fix.** Remove the `ports` mapping (Traefik reaches the container over the Docker network) or bind it to `127.0.0.1`.
**Effort:** Small

#### F-32 — Dependency hygiene: advisories not reachable from this code

> **Status: partly done in working tree (not committed).** In-range patches only, by the owner's decision: axios, drizzle-orm, nanoid (both copies), form-data and follow-redirects are updated in package-lock.json, and `npm audit --omit=dev` goes from 11 advisories to 5. next-auth stays at 5.0.0-beta.30 (so @auth/core 0.41.0), and next 16.3.5 would be outside the pinned range. See §1a.

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
5. **Which migrations production actually applied (F-20).** Needs a read-only query of `drizzle.__drizzle_migrations`. Now scripted: `DATABASE_URL=… node scripts/f20-migration-state-report.mjs` (read-only) also shows which migrations' changes are present and what `db:migrate` would run there (see §1a).
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
