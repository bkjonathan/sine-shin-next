// Demonstration + guard for AUDIT.md finding F-22.
//
// F-22: drizzle wraps a database error as DrizzleQueryError, whose message is
// "Failed query: <sql>\nparams: <values>", and whose cause (the Postgres error)
// carries `detail` — for a NOT NULL or CHECK violation, the whole failing row.
// The dashboard, dashboard orders, dashboard cargo, reports and account routes
// sent that message to the browser, and every error log printed it all:
// parameter values, the Postgres detail and, on user and settings writes, a
// bcrypt hash. Handlers without try/catch are logged by Next.js itself, the
// same way. The order page also logged every render.
//
// Fix under test:
//   - those routes answer a failed query with only "Internal server error"
//   - src/lib/log-redaction.ts replaces a database error passed to console.* with
//     a summary: the SQL (placeholders only), how many values were withheld, the
//     Postgres code, table, column and constraint, and the stack; a Postgres
//     message that can quote the input (class 22) is withheld too.
//     src/instrumentation.ts installs it when the server starts, so it covers the
//     app's own logs and the ones Next.js writes.
//   - the order page's per-render console.log is gone
//
// The first four tests need nothing. The live test needs a server started against
// a THROWAWAY database, plus its secret:
//   AUDIT_BASE_URL=http://localhost:<port> NEXTAUTH_SECRET=<server secret> \
//   AUDIT_DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/audit_<name> \
//   AUDIT_SERVER_LOG=<file the server's output is written to> \
//   node --test tests/f22-error-exposure.test.mjs
// Without AUDIT_SERVER_LOG the log check is skipped.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { inspect } from "node:util";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DrizzleQueryError } from "drizzle-orm";
import { BASE, liveReady, skipReason, auditDb, seedRoleUsers, cookieFor } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");
const HASH = "$2b$12$F22HashThatMustNeverBeLoggedAnywhere0123456789abcdefgh";
const printed = (value) => inspect(value, { depth: 8 });

/** A Postgres error as postgres.js raises it: an Error with the server's fields on it. */
const pgError = (message, fields) => Object.assign(new Error(message), { severity_local: "ERROR", severity: "ERROR", ...fields });

/** A failed users insert: its parameters and the Postgres detail both carry the hash. */
const failedUserInsert = () =>
  new DrizzleQueryError(
    'insert into "users" ("id", "name", "password_hash", "role") values ($1, $2, $3, $4)',
    ["u_f22_values", null, HASH, "owner"],
    pgError('null value in column "name" of relation "users" violates not-null constraint', {
      code: "23502",
      detail: `Failing row contains (u_f22_values, null, ${HASH}, owner, 0).`,
      schema_name: "public",
      table_name: "users",
      column_name: "name",
      routine: "ExecConstraints",
    })
  );

function filesUnder(dir, keep) {
  const found = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(path, keep));
    else if (keep(entry.name)) found.push(path);
  }
  return found;
}

test("F-22: a database error is logged without its values, failing row or hash", async () => {
  const { redactForLog } = await import("../src/lib/log-redaction.ts");
  const err = failedUserInsert();
  const out = printed(redactForLog(err));

  assert.match(out, /insert into "users"/, "the SQL, which holds only placeholders, is kept");
  assert.match(out, /4 values withheld/);
  assert.match(out, /23502/, "the Postgres error code is kept");
  assert.match(out, /violates not-null constraint/, "and its message");
  assert.match(out, /users/);
  assert.match(out, /\n\s+at /, "and the stack");
  assert.ok(!out.includes("HashThatMustNeverBeLogged"), `the bcrypt hash was printed:\n${out}`);
  assert.ok(!out.includes("u_f22_values"), `a parameter value was printed:\n${out}`);
  assert.ok(!out.includes("Failing row"), `the Postgres detail was printed:\n${out}`);

  // The original is untouched, so code that handles the error still has everything.
  assert.deepEqual(err.params, ["u_f22_values", null, HASH, "owner"]);
  assert.match(err.cause.detail, /Failing row/);

  // Anything that isn't a database error passes through as it is.
  const plain = new Error("plain");
  assert.equal(redactForLog(plain), plain);
  assert.equal(redactForLog("text"), "text");
  assert.equal(redactForLog(42), 42);
  assert.equal(redactForLog(null), null);
});

test("F-22: messages that quote the input, bare Postgres errors and nested causes are redacted too", async () => {
  const { redactForLog } = await import("../src/lib/log-redaction.ts");

  // Class 22 (data exception) messages can quote the value that was sent.
  const badDate = new DrizzleQueryError(
    'select 1 from "expenses" where "expense_date" >= $1::date',
    ["f22-typed-into-a-date"],
    pgError('invalid input syntax for type date: "f22-typed-into-a-date"', { code: "22007", routine: "DateTimeParseError" })
  );
  const dateOut = printed(redactForLog(badDate));
  assert.ok(!dateOut.includes("f22-typed-into-a-date"), `the input was printed:\n${dateOut}`);
  assert.match(dateOut, /22007/);
  assert.match(dateOut, /DateTimeParseError/);

  // A Postgres error that drizzle didn't wrap loses its detail as well.
  const duplicate = pgError('duplicate key value violates unique constraint "users_name_unique"', {
    code: "23505",
    detail: "Key (name)=(f22-someones-username) already exists.",
    table_name: "users",
    constraint_name: "users_name_unique",
  });
  const duplicateOut = printed(redactForLog(duplicate));
  assert.ok(!duplicateOut.includes("f22-someones-username"), `the detail was printed:\n${duplicateOut}`);
  assert.match(duplicateOut, /users_name_unique/);

  // A database error inside another error's cause.
  const wrapper = new Error("request failed", { cause: failedUserInsert() });
  const wrapperOut = printed(redactForLog(wrapper));
  assert.match(wrapperOut, /request failed/);
  assert.match(wrapperOut, /23502/);
  assert.ok(!wrapperOut.includes("HashThatMustNeverBeLogged"), `the nested hash was printed:\n${wrapperOut}`);
});

test("F-22: once installed on a console, every method prints the redacted form", async () => {
  const { installLogRedaction } = await import("../src/lib/log-redaction.ts");
  const seen = [];
  const fakeConsole = Object.fromEntries(["error", "warn", "log", "info", "debug"].map((m) => [m, (...args) => seen.push([m, args])]));

  installLogRedaction(fakeConsole);
  const wrapped = fakeConsole.error;
  installLogRedaction(fakeConsole);
  assert.equal(fakeConsole.error, wrapped, "installing twice doesn't wrap twice");

  fakeConsole.error("[POST /api/users]", failedUserInsert());
  fakeConsole.warn(failedUserInsert());
  fakeConsole.log("plain", 1);
  assert.equal(seen.length, 3);
  assert.equal(seen[0][1][0], "[POST /api/users]", "other arguments are unchanged");
  for (const [method, args] of seen.slice(0, 2)) {
    assert.ok(!printed(args).includes("HashThatMustNeverBeLogged"), `console.${method} printed the hash`);
  }
  assert.deepEqual(seen[2], ["log", ["plain", 1]]);
});

test("F-22: no route sends error details to the browser, and the redaction is installed at startup", () => {
  const leaking = filesUnder("src/app", (name) => name === "route.ts").filter((file) =>
    /\b(err|error)\.(message|cause|stack)\b|String\((err|error)\)/.test(read(file))
  );
  assert.deepEqual(leaking, [], "these route handlers put error details in a response or a string");

  // An error turned into a string before logging can't be redacted.
  const interpolated = filesUnder("src", (name) => /\.tsx?$/.test(name)).filter((file) =>
    /console\.\w+\([^;]*\$\{\s*(err|error)\b/.test(read(file))
  );
  assert.deepEqual(interpolated, [], "these files interpolate an error into a log message");

  const hook = read("src/instrumentation.ts");
  assert.match(hook, /NEXT_RUNTIME === "nodejs"/);
  assert.match(hook, /installLogRedaction\(\)/);

  assert.doesNotMatch(read("src/app/(dashboard)/orders/[id]/page.tsx"), /console\.log\(/, "the order page logs every render");
});

test("F-22: failed queries answer with a generic error, and the logs keep no values", { skip: liveReady ? false : skipReason }, async (t) => {
  const db = auditDb();
  await seedRoleUsers(db);
  await db.end();
  const cookie = { owner: await cookieFor("owner"), manager: await cookieFor("manager"), staff: await cookieFor("staff") };
  const marker = `f22-${randomBytes(4).toString("hex")}`;
  const logFile = process.env.AUDIT_SERVER_LOG;
  const logStart = logFile ? statSync(logFile).size : 0;

  async function call(method, path, cookie, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { cookie, ...(body !== undefined && { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    return { status: res.status, text: await res.text().catch(() => "") };
  }

  await t.test("the summaries answer a failed query with only a generic error", async () => {
    for (const path of ["/api/dashboard", "/api/dashboard/orders", "/api/dashboard/cargo", "/api/reports"]) {
      const r = await call("GET", `${path}?dateFrom=${marker}-date`, cookie.owner);
      // The test needs a failing query; if dateFrom gets validated, pick another trigger.
      assert.equal(r.status, 500, `${path}: expected the database to reject the date (got ${r.status})`);
      assert.deepEqual(JSON.parse(r.text), { error: "Internal server error" }, `${path} sent: ${r.text.slice(0, 300)}`);
    }
  });

  await t.test("logs keep the SQL and error codes but no values, for caught and uncaught errors", { skip: logFile ? false : "set AUDIT_SERVER_LOG to the server's log file" }, async () => {
    // Caught by the handler: a second category with the same name fails its unique
    // constraint. The name (the marker) is in the query's values and in Postgres's detail.
    const category = { name: `${marker}-category`, carrierRatePerKg: 1, receiverRatePerKg: 1 };
    assert.equal((await call("POST", "/api/cargo-categories", cookie.owner, category)).status, 201, "first category");
    const duplicate = await call("POST", "/api/cargo-categories", cookie.owner, category);
    // F-13 skips one of its checks while any category exists.
    const cleanup = auditDb();
    await cleanup`delete from cargo_categories where name = ${category.name}`;
    await cleanup.end();
    assert.equal(duplicate.status, 500, `duplicate category: ${duplicate.status} ${duplicate.text.slice(0, 200)}`);
    // Not caught: this handler has no try/catch, so Next.js logs the error. Postgres rejects the NUL character.
    const uncaught = await call("GET", `/api/orders/${marker}-nul%00`, cookie.owner);
    assert.equal(uncaught.status, 500, `order lookup: ${uncaught.status} ${uncaught.text.slice(0, 200)}`);
    assert.ok(!uncaught.text.includes(marker));

    const log = readFileSync(logFile).subarray(logStart).toString("utf8");
    const at = log.indexOf(marker);
    assert.equal(at, -1, `a request value reached the log:\n${log.slice(Math.max(0, at - 400), at + 200)}`);
    assert.match(log, /\[GET \/api\/dashboard\]/, "the failed summaries were logged");
    assert.match(log, /\[POST \/api\/cargo-categories\]/, "the failed write was logged");
    assert.match(log, /23505/, "with its error code");
    assert.match(log, /cargo_categories_name_unique/, "and constraint");
    assert.match(log, /⨯/, "Next.js logged the uncaught error itself");
    assert.match(log, /22021/, "with its code");
    assert.match(log, /values withheld/);
  });
});
