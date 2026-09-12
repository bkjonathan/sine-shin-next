// Guard for AUDIT.md finding F-21.
//
// F-21: there is no .dockerignore, and the Dockerfile does `COPY . .`, so a
// build from a working copy sends .env / .env.local (DATABASE_URL, the session
// secret) into the build; Next's standalone output then copies .env into the
// runtime image. The local macOS node_modules also overwrites the Linux one
// installed by `npm ci`.
//
// Fix under test: .dockerignore keeps secrets and local build artefacts out of
// the build context, while everything the Dockerfile needs is still sent.
//
// Method: ask Docker itself what it would send. A throwaway BuildKit step
// bind-mounts the context and lists it — the mount is never stored in a layer,
// and the result is cache-only (no image is created). Uses the local
// postgres:16-alpine image purely as a shell, so nothing is pulled.
//
// Deliberately not run against the pre-fix tree: that would copy the real
// .env into the local build cache.
//
// Run: node --test tests/f21-docker-context.test.mjs   (skips without Docker)

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROBE_IMAGE = "postgres:16-alpine";

const dockerReady =
  spawnSync("docker", ["image", "inspect", PROBE_IMAGE], { encoding: "utf8" }).status === 0;

test("F-21: .dockerignore exists", () => {
  assert.ok(existsSync(join(root, ".dockerignore")), "no .dockerignore — the whole working copy is sent to docker build");
});

test(
  "F-21: the Docker build context excludes secrets and local artefacts",
  { skip: dockerReady && existsSync(join(root, ".dockerignore")) ? false : `needs Docker, ${PROBE_IMAGE} and a .dockerignore` },
  () => {
    const dockerfile = `FROM ${PROBE_IMAGE}\nRUN --mount=type=bind,target=/ctx sh -c 'echo CTX-BEGIN; ls -A /ctx; echo CTX-END'\n`;
    const r = spawnSync(
      "docker",
      ["build", "--no-cache", "--progress=plain", "--output", "type=cacheonly", "-f", "-", "."],
      { cwd: root, input: dockerfile, encoding: "utf8", timeout: 180_000 }
    );
    assert.equal(r.status, 0, `docker build probe failed:\n${r.stderr.slice(-2000)}`);

    // Step output lines look like "#6 0.097 package.json". Match whole output
    // lines only: the echoed RUN command also contains the marker strings.
    const lines = (r.stderr + r.stdout)
      .split("\n")
      .map((line) => line.match(/^#\d+\s+[\d.]+\s+(.*)$/)?.[1]?.trim())
      .filter((line) => line !== undefined);
    const begin = lines.indexOf("CTX-BEGIN");
    const end = lines.indexOf("CTX-END");
    assert.ok(begin !== -1 && end > begin, `context listing not found in docker build output:\n${r.stderr.slice(-2000)}`);
    const entries = new Set(lines.slice(begin + 1, end));

    for (const secretOrArtefact of [".env", ".env.local", "node_modules", ".next", ".git"]) {
      assert.ok(!entries.has(secretOrArtefact), `${secretOrArtefact} is sent to docker build`);
    }
    // `npm run build` first runs the migration journal check, which reads scripts/ and drizzle/ (AUDIT.md F-20).
    for (const needed of ["Dockerfile", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "src", "public", "scripts", "drizzle"]) {
      assert.ok(entries.has(needed), `${needed} is missing from the build context (the image build needs it)`);
    }
  }
);
