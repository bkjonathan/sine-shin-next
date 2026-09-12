// Demonstration + guard for AUDIT.md finding F-31.
//
// F-31: docker-compose.yml publishes "3000:3000" on every host interface, with
// AUTH_TRUST_HOST=true. If this file runs on a host where port 3000 isn't
// firewalled, the app is reachable over plain HTTP, bypassing Traefik and TLS
// — and a direct client can forge X-Forwarded-For to dodge the F-07 limits.
//
// Fix under test: any published port is bound to 127.0.0.1 only (Traefik
// reaches the container over the Docker network, not the host port).
//
// Method: `docker compose config` resolves the file exactly as Compose would.
// --no-interpolate and an empty --env-file keep it from reading or printing
// any value from .env.
//
// Run: node --test tests/f31-compose-port.test.mjs   (skips without Docker Compose)

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const composeReady = spawnSync("docker", ["compose", "version"], { encoding: "utf8" }).status === 0;

test("F-31: compose publishes the app on localhost only", { skip: composeReady ? false : "needs Docker Compose" }, () => {
  const r = spawnSync(
    "docker",
    ["compose", "--env-file", "/dev/null", "-f", "docker-compose.yml", "config", "--no-interpolate", "--format", "json"],
    { cwd: root, encoding: "utf8", timeout: 60_000 }
  );
  assert.equal(r.status, 0, `docker compose config failed:\n${r.stderr}`);
  const config = JSON.parse(r.stdout);

  for (const [name, service] of Object.entries(config.services ?? {})) {
    for (const port of service.ports ?? []) {
      assert.equal(
        port.host_ip,
        "127.0.0.1",
        `service "${name}" publishes ${port.published ?? "?"}:${port.target} on ${port.host_ip || "all interfaces"}`
      );
    }
  }
});
