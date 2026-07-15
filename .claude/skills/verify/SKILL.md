---
name: verify
description: Build, run, and drive this app to observe a change at its real surface.
---

# Verifying changes in sine-shin-next

## Critical: the database is remote and looks like production

`DATABASE_URL` in `.env.local` points at `187.127.105.48:6000/sine_shin_db` — a
live remote Postgres, not a local container. `docker-compose.yml` only builds the
app; it does **not** provide a database.

**Never run `npm run db:seed`, `db:push`, or `db:migrate` to set up a
verification**, and don't submit create/update forms against it. Login uses
credentials (`src/lib/auth.ts`) checked against the `users` table there, so you
generally cannot log in without asking the user for credentials.

## Surfaces

- **Server routes / API** (`src/app/api/**`) — needs the remote DB and a session.
  Ask the user before driving these; writes hit real data.
- **Client components** (forms, calculators, anything with `"use client"`) — the
  logic is in the browser. Drive it in a **standalone harness**, no DB, no login.

## Client-component harness (the fast path)

Mounts the real component in real Chrome with the app's real Tailwind theme.
Everything below is already installed/available: `esbuild`, `playwright-core`,
`/Applications/Google Chrome.app`.

1. **Entry** — import the component via its `@/` alias, wrap in the providers it
   needs. Most `src/components/orders/*` pull in `CustomerCombobox`, which
   requires a `QueryClientProvider` from `@tanstack/react-query`. Its customer
   fetch fails harmlessly offline (empty combobox); it does not block the rest of
   the form.

2. **Bundle with the esbuild JS API, not the CLI.** The CLI has no `--node-paths`
   flag, and a scratchpad entry file can't resolve the project's `node_modules`
   on its own. Import esbuild by absolute path if the build script lives outside
   the repo:

   ```js
   import * as esbuild from "<repo>/node_modules/esbuild/lib/main.js";
   await esbuild.build({
     entryPoints: [`${HERE}/entry.tsx`],
     bundle: true, outfile: `${HERE}/bundle.js`, jsx: "automatic",
     absWorkingDir: ROOT,
     nodePaths: [`${ROOT}/node_modules`],
     alias: { "@": `${ROOT}/src` },
     define: { "process.env.NODE_ENV": '"development"' },
   });
   ```

3. **CSS** — `npx @tailwindcss/cli -i src/app/globals.css -o app.css` (run from
   repo root so it scans `src/`). The theme only renders if the host page sets
   both attributes: `<html data-theme="dark" data-accent="blue">`, plus
   `body { background: var(--bg-page); }`.

4. **Drive** with `playwright-core`, launching system Chrome via
   `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
   `GlassInput` renders `<label><input>` siblings, so
   `label:text-is("Field Name") + input` is a reliable locator and
   `label:text-is("X") ~ p` reads its hint/error text.

## Harnessing a component that isn't a plain form

`OrderDetailClient` and friends need three extra things over a simple form:

- **`next/navigation` stub** — alias it to a local module exporting `useRouter`
  (`refresh/push/replace/back/forward/prefetch` no-ops), `usePathname`, etc.
  Outside the app router the real hooks throw.
- **`process` shim** — something deep in the tree reads bare `process`, which
  `define` alone doesn't cover. Add
  `banner: { js: 'window.process = window.process || { env: { NODE_ENV: "development" } };' }`.
- **Serve over HTTP, not `file://`** — `src/lib/axios.ts` uses `baseURL: "/api"`,
  which only resolves on an http origin.

Then **intercept the save instead of hitting the DB** — this is the best evidence
available here, since it shows the exact persisted payload:

```js
await page.route("**/api/orders/**", async (route) => {
  if (route.request().method() === "PATCH") saves.push(JSON.parse(route.request().postData()));
  await route.fulfill({ status: 200, contentType: "application/json", body: '{"data":{}}' });
});
```

Note the harness props don't refresh after a save (`router.refresh` is stubbed),
so the UI keeps showing the original values — assert on the captured payload.

## Gotcha: recompile `app.css` after adding Tailwind classes

Tailwind v4 scans source at build time. If you add a class and reuse an `app.css`
built earlier, the class silently has no styles and the screenshot shows a fake
layout bug. Rebuild the CSS after every source edit before screenshotting.

## Gotcha: react-hook-form `watch()` returns a stable reference

RHF mutates its internal form values in place, so `watch("items")` hands back the
**same array reference** every render. `useMemo(..., [watchedItems])` therefore
never invalidates and silently caches the first render's value forever. Derive
totals inline (recompute each render) or use `useWatch`. This bug is invisible to
typecheck and lint — only driving the form catches it.

## Don't bother

`npx tsc --noEmit` and `npx eslint <file>` are fine as a sanity pass but prove
nothing about behavior. There is no test suite in this repo.
