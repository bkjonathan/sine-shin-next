// Demonstration + guard for AUDIT.md finding F-29.
//
// F-29: src/env.ts validated DATABASE_URL, NEXTAUTH_SECRET (at least 16
// characters) and NEXTAUTH_URL, but nothing imported it, so the server started
// with a missing or short secret. Importing it as it was would also have broken
// `next build`, which runs without the runtime settings (it threw on import).
//
// Decision agreed with the owner (2026-09-12): with an invalid setting the server
// refuses to start.
//
// Fix under test:
//   - envProblems() in src/env.ts lists what's wrong, naming settings but not values
//   - src/instrumentation.ts runs it when the server starts (not during a build)
//     and exits with status 1 if anything is wrong
//   - src/lib/auth.ts passes NEXTAUTH_SECRET to Auth.js explicitly
//
// The first two tests need nothing. The last needs a built app (.next) and
// AUDIT_DATABASE_URL; it starts `next start` on a spare port with a short secret.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DB_URL } from "./helpers/audit-session.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

test("F-29: the environment check names each missing or invalid setting, without its value", async () => {
  const { envProblems } = await import("../src/env.ts");
  const good = { DATABASE_URL: "postgres://user:pw@localhost:5432/shop", NEXTAUTH_SECRET: "x".repeat(32), NEXTAUTH_URL: "https://shop.example" };
  assert.deepEqual(envProblems(good), []);
  assert.match(envProblems({ ...good, NEXTAUTH_SECRET: "f29-too-short" }).join("\n"), /NEXTAUTH_SECRET/);
  assert.match(envProblems({ ...good, NEXTAUTH_SECRET: undefined }).join("\n"), /NEXTAUTH_SECRET/);
  assert.match(envProblems({ ...good, DATABASE_URL: undefined }).join("\n"), /DATABASE_URL/);
  assert.match(envProblems({ ...good, NEXTAUTH_URL: "not a url" }).join("\n"), /NEXTAUTH_URL/);
  assert.ok(!envProblems({ ...good, NEXTAUTH_SECRET: "f29-too-short" }).join("\n").includes("f29-too-short"), "a setting's value was included");
});

test("F-29: the server checks its environment at startup, and importing env.ts doesn't throw", () => {
  const hook = read("src/instrumentation.ts");
  assert.match(hook, /envProblems\(\)/);
  assert.match(hook, /process\.exit\(1\)/);
  assert.match(hook, /phase-production-build/, "the check must not run during `next build`");
  assert.doesNotMatch(read("src/env.ts"), /^\s*throw /m, "env.ts throws when imported");
  assert.match(read("src/lib/auth.ts"), /secret: process\.env\.NEXTAUTH_SECRET/);
});

test("F-29: next start refuses to run with a short NEXTAUTH_SECRET", { skip: existsSync(join(root, ".next/BUILD_ID")) && DB_URL ? false : "needs a built app (.next) and AUDIT_DATABASE_URL" }, async (t) => {
  const port = 3190 + Math.floor(Math.random() * 50);
  const secret = "f29-too-short";
  const child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port)], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: DB_URL, NEXTAUTH_SECRET: secret, AUTH_SECRET: secret, NEXTAUTH_URL: `http://localhost:${port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.exitCode === null && child.kill());
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  let code = "still running";
  for (const deadline = Date.now() + 30_000; Date.now() < deadline; ) {
    const result = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve("tick"), 1000))]);
    if (result !== "tick") {
      code = result;
      break;
    }
    // In case the hook only runs on the first request.
    fetch(`http://localhost:${port}/login`, { signal: AbortSignal.timeout(900) }).catch(() => {});
  }

  assert.notEqual(code, "still running", `the server kept running with a short secret:\n${output.slice(-1500)}`);
  assert.equal(code, 1, `exit code ${code}:\n${output.slice(-1500)}`);
  assert.match(output, /NEXTAUTH_SECRET/);
  assert.ok(!output.includes(secret), "the secret's value was printed");
});
