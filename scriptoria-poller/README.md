# SvelteKit Cloudflare Worker Application

A SvelteKit application deployed as a **Cloudflare Worker** using the official SvelteKit Cloudflare adapter.

This project uses SvelteKit for the application framework and Cloudflare Workers as the serverless runtime.

---

## Technology Stack

- **SvelteKit** — Full-stack web application framework
- **Svelte 5** — UI framework (runes mode)
- **TypeScript** — Type-safe development
- **Vite** — Build tooling
- **Cloudflare Workers** — Serverless deployment runtime
- **Wrangler** — Cloudflare CLI deployment tool
- **@sveltejs/adapter-cloudflare** — SvelteKit Cloudflare Worker adapter
- **D1** — Cloudflare's serverless SQL database (bound as `DB`)

---

## Project Creation

The project was created using the official Svelte CLI:

```sh
# Create a new project
npx sv create <project-name>
```

To recreate this project with the same configuration:

```sh
npx sv@0.16.2 create --template minimal --types ts --install npm scriptoria-poller
```

---

## Local Development & Testing

### 1. Install dependencies

```sh
npm install
```

### 2. Run the SvelteKit dev server

Fast iteration with hot module reloading (Vite, not the Workers runtime):

```sh
npm run dev

# or open it in a browser automatically
npm run dev -- --open
```

### 3. Type-check the project

```sh
npm run check          # one-off
npm run check:watch    # watch mode
```

### 4. Test against the real Cloudflare Workers runtime (`workerd`)

`npm run dev` uses Vite's Node server, which does **not** simulate the Workers runtime or your bindings (D1, etc.). To test the actual built Worker locally:

```sh
# Build the Worker artifact first (see "Building" below)
npm run build

# Serve the built Worker on the local Workers runtime with local bindings
npx wrangler dev
```

`wrangler dev` runs `workerd` locally and simulates bindings using on-disk storage under `.wrangler/state`. Use this when you need to exercise the D1 `DB` binding or anything platform-specific.

### 5. Local D1 database

Local dev uses a **local** SQLite simulation of D1 by default (no network, no real database ID needed):

```sh
# Apply migrations to the local D1 database
npx wrangler d1 migrations apply glocal-packages-staging --local

# Run an ad-hoc query locally
npx wrangler d1 execute glocal-packages-staging --local --command "SELECT 1"
```

Migrations live in `../migrations` (see `migrations_dir` in `wrangler.jsonc`).

---

## Building

Create a production build. This runs Vite → the SvelteKit compiler → the Cloudflare adapter, which emits the deployable Worker artifact to `.svelte-kit/cloudflare/`:

```sh
npm run build
```

Key outputs in `.svelte-kit/cloudflare/`:

- `_worker.js` — the Cloudflare Worker entry point (referenced by `main` in `wrangler.jsonc`)
- `_app/`, `_headers`, `.assetsignore` — static assets served via the `ASSETS` binding

Preview the production build locally:

```sh
npm run preview
```

---

## Cloudflare Setup & Deployment

### 1. Authenticate Wrangler

```sh
npx wrangler login      # interactive
npx wrangler whoami     # verify auth
```

### 2. Create the D1 database and record its ID

```sh
npx wrangler d1 create glocal-packages-staging
```

Copy the returned `database_id` into `wrangler.jsonc` under `d1_databases[0].database_id`
(currently a placeholder: `"<staging-database-id>"`).

> **Note:** Wrangler does **not** support pulling `database_id` from a `.env` file — config
> field values cannot be interpolated from environment variables. `.env`/`.dev.vars` only
> inject values into the Worker's runtime `env`, not into `wrangler.jsonc`. To keep IDs out
> of a single committed value, use Wrangler [environments](https://developers.cloudflare.com/workers/wrangler/environments/)
> (`env.staging` / `env.production`) or omit the ID to let `wrangler deploy` auto-provision it.

### 3. Apply migrations to the remote database

```sh
npx wrangler d1 migrations apply glocal-packages-staging --remote
```

### 4. Manage secrets (never commit these)

```sh
npx wrangler secret put <SECRET_NAME>
```

Local equivalents go in a `.dev.vars` file (git-ignored), not in `wrangler.jsonc`.

### 5. Deploy

```sh
npm run build
npx wrangler deploy

# validate without deploying
npx wrangler deploy --dry-run
```

### 6. Observe

`observability` is enabled in `wrangler.jsonc`. Stream live logs with:

```sh
npx wrangler tail
```

### Wrangler configuration reference (`wrangler.jsonc`)

| Field | Value | Purpose |
| --- | --- | --- |
| `main` | `.svelte-kit/cloudflare/_worker.js` | Worker entry point produced by the build |
| `assets.directory` | `.svelte-kit/cloudflare` | Static assets directory |
| `assets.binding` | `ASSETS` | Binding used to serve static assets |
| `compatibility_flags` | `["nodejs_compat"]` | Enables Node.js APIs in the Worker |
| `d1_databases[0].binding` | `DB` | D1 database binding name in Worker code |
| `upload_source_maps` | `true` | Uploads source maps for readable stack traces |

---

## How the Build/Config Issue Was Resolved

**Symptom:** `npm run build` did not produce the Cloudflare Worker artifact
(`.svelte-kit/cloudflare/_worker.js`), so there was nothing for Wrangler's `main` to point at.

### Root cause

The Vite config file was named **`_vite.config.ts`** (leading underscore). Vite only auto-loads
a config named `vite.config.{js,ts,…}`, so the file was silently ignored. Without it, `vite build`
ran **without the `sveltekit()` plugin** — meaning the SvelteKit compile step and the Cloudflare
adapter never executed, and no Worker artifact was emitted.

A secondary problem lived inside that same file: it imported `@sveltejs/adapter-auto` and passed
`adapter`/`compilerOptions` **into `sveltekit()`**. The `sveltekit()` Vite plugin takes no
arguments — adapter and compiler options belong in `svelte.config.js` — so those settings were
dead code that also contradicted the project's `adapter-cloudflare` setup.

### Fixes applied

1. **Renamed / recreated the Vite config** as `vite.config.ts` with the canonical content, and
   deleted the broken `_vite.config.ts`:

   ```ts
   import { sveltekit } from '@sveltejs/kit/vite';
   import { defineConfig } from 'vite';

   export default defineConfig({
       plugins: [sveltekit()]
   });
   ```

2. **Moved the runes `compilerOptions`** out of the Vite plugin and into `svelte.config.js`
   (its correct location), keeping the `adapter-cloudflare` adapter already configured there.

3. **Added the required `assets.binding`** to `wrangler.jsonc`. After step 1 the adapter finally
   ran and reported that `assets.binding` was missing; adding `"binding": "ASSETS"` alongside the
   existing `assets.directory` let the build complete:

   ```jsonc
   "assets": {
       "directory": ".svelte-kit/cloudflare",
       "binding": "ASSETS"
   }
   ```

After these changes, `npm run build` completes and correctly emits
`.svelte-kit/cloudflare/_worker.js` and the associated static assets.

### Takeaways

- Vite config **must** be named `vite.config.{js,ts}` — a prefixed/renamed file is ignored silently.
- Adapter and Svelte `compilerOptions` belong in `svelte.config.js`, **not** in `sveltekit()`.
- `@sveltejs/adapter-cloudflare` requires **both** `assets.directory` and `assets.binding` in
  `wrangler.jsonc` before it will emit output.

---

## Current Gaps (TODO)

Known gaps as of 2026-07-11. The build works; these are the items still outstanding:

- [ ] **`database_id` is a placeholder** — `wrangler.jsonc` still has `"<staging-database-id>"`.
      Deploy will fail until the real ID from `wrangler d1 create` is filled in
      (local dev is unaffected).
- [ ] **No generated binding types** — run `npx wrangler types` and add a
      `"cf-typegen": "wrangler types"` script so `DB`/`ASSETS` bindings are typed.
- [ ] **`App.Platform` is untyped** — `src/app.d.ts` has the `Platform` interface commented
      out; server code using `event.platform.env.DB` won't type-check until it's filled in
      (e.g. `interface Platform { env: { DB: D1Database; ASSETS: Fetcher } }`).
- [ ] **No `deploy` script** — add `"deploy": "npm run build && wrangler deploy"` to
      `package.json` to avoid deploying a stale build.
- [ ] **`.dev.vars` not git-ignored** — `.gitignore` covers `.env*` but not `.dev.vars*`,
      which is the file Wrangler reads for local secrets. No `.dev.vars.example` is committed
      to document expected values, either.
- [ ] **No staging/production environments** — the DB name says "staging" but there is no
      `env.staging` / `env.production` split in `wrangler.jsonc`.
- [ ] **No cron/scheduled handler** — despite the "poller" name, `adapter-cloudflare` emits a
      fetch-only Worker; there is no `triggers.crons` config or `scheduled` handler. Scheduled
      polling needs a separate standalone Worker (or another approach) if that's the intent.
- [ ] **No tests or lint/format config** — the previous `scriptoriapoller` project had vitest
      (`@cloudflare/vitest-pool-workers`) and `.prettierrc`; neither has been carried over.
