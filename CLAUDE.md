# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"Glocal Packages" (FaithTech/SIL hackathon project): one **SvelteKit** app deployed as a single **Cloudflare Worker**, backed by **Cloudflare D1** (SQLite) via **Prisma 7**. Three functional parts:

1. Public catalogue + search of language "asset packages" (`/` and `GET /api/v1/packages[/{id}]`), consumed by an iOS container app.
2. Admin console (`/admin`) where administrators approve/reject packages.
3. Scriptoria intake webhook (`POST /api/v1/notifications/scriptoria`), Bearer-token authenticated, where the external Scriptoria publishing service announces new packages.

Data pipeline: Scriptoria notifies → package upserted as `PENDING` → admin moderates → `ACTIVE` packages become publicly visible. All status changes are recorded in an append-only `PackageStatusEvent` audit table.

`scriptoria-poller/` is a separate, mostly-scaffolded SvelteKit project (see its own README's "Current Gaps" section) — not wired into the main app's build, tests, or deploy. Treat it as unrelated WIP unless the task specifically targets it.

## Commands

```bash
npm install                  # also runs svelte-kit sync + prisma generate (prepare script)

# Local dev
cp .dev.vars.example .dev.vars   # set SESSION_SECRET, SCRIPTORIA_API_KEY
npm run db:migrate:local         # apply migrations to local D1 (via wrangler, not prisma)
npm run db:seed:local            # optional demo data
npm run dev                      # http://localhost:5173

# Checks
npm run typecheck            # svelte-kit sync + svelte-check + tsc --noEmit on test/tsconfig.json
npm test                     # vitest run, executes inside workerd (real Workers runtime)
npm run check                # typecheck + test — run this before considering work done
npm run deploy:dry-run       # vite build + wrangler deploy --dry-run (verifies bindings)

# Single test file
npx vitest run test/worker.test.ts

# Prisma / schema
npm run db:format            # prisma format
npm run db:validate          # prisma validate
npm run db:generate          # regenerate src/lib/server/generated/prisma (never hand-edit it)
npm run db:check             # format + validate + generate
npm run db:migration:initial # regenerate migrations/0001_initial.sql from schema.prisma (existing shared migrations must not be overwritten; add new numbered ones instead)

# Deploy (staging/production) — see docs/DEPLOY.md before running these
npm run db:migrate:staging / db:migrate:production
npm run deploy:staging / deploy:production
```

## Architecture

SvelteKit's file-system router: folders under `src/routes` are URLs; `+page.svelte` is UI, `+page.server.ts` holds `load()`/form `actions` (server-only), `+server.ts` is a raw JSON endpoint, `+layout.server.ts` guards a whole subtree. `src/hooks.server.ts` runs before every request.

**Request pipeline:** Cloudflare Worker (`.svelte-kit/cloudflare/_worker.js`, generated) → `src/hooks.server.ts` (assigns a request ID, resolves the `admin_session` cookie into `event.locals.administratorId`) → the matching route.

**Cloudflare bindings** arrive via `event.platform.env` (`DB` = D1 binding; secrets `SESSION_SECRET`, `SCRIPTORIA_API_KEY` declared in `src/app.d.ts`, sourced from `.dev.vars` locally / `wrangler secret put` remotely — never from `wrangler.jsonc`). `src/lib/server/platform.ts`'s `requireEnv()` fetches these or throws a 503.

**Data layer** (`src/lib/server/`):
- `db.ts` — `createPrisma(D1)` builds a per-request Prisma client via `@prisma/adapter-d1`; disconnected in a `finally` (Workers are stateless, no pooling).
- `packages.ts` — catalogue queries (`searchActivePackages`, `getActivePackage`, `listPackagesByStatus`) and the `moderatePackage` state machine: `PENDING→ACTIVE|REJECTED`, `ACTIVE→INACTIVE`, `REJECTED→PENDING`, `INACTIVE→ACTIVE|PENDING`. Rejecting requires a reason.
- `notification.ts` — Scriptoria payload schema (valibot) + `ingestNotification()`: extracts the product UUID from `permalink_url` as the idempotency key, upserts the package (new → `PENDING`; repeat → moderation status untouched), replaces its names/listings/images.
- `auth.ts` — security-sensitive: PBKDF2 password hashing, timing-safe comparisons, a decoy hash to prevent user-enumeration timing attacks, HMAC-signed stateless session cookies (8h TTL), Scriptoria Bearer-secret verification. Don't "simplify" this file.
- Both `ingestNotification` and `moderatePackage` use raw D1 `batch()` (not Prisma) for atomicity — **the Prisma D1 adapter does not guarantee transactions**, so any new multi-statement write needs the same pattern. All reads go through Prisma.

**Validation:** `src/lib/validation.ts` holds valibot schemas shared by client and server (login credentials, moderation input, search params) — every external input (query strings, forms, Scriptoria JSON) is parsed through a schema before touching the database.

**Prisma/D1 specifics:**
- Schema is `prisma/schema.prisma` (six models: `Administrator`, `Package`, `PackageName`, `PackageListing`, `PackageImage`, `PackageStatusEvent`). Generated client lives at `src/lib/server/generated/prisma/` (`runtime = "cloudflare"`) — regenerated via `npm run db:generate`/`npm install`, never hand-edited.
- Migrations are applied by **wrangler**, not `prisma migrate` (`npm run db:migrate:local|staging|production`). Prisma only generates the SQL for a migration file.
- `vite.config.ts` has two custom plugins solely to carry Prisma's query-compiler `.wasm` through dev and build — leave them alone unless you're specifically debugging that wasm pipeline.

**Testing:** `test/worker.test.ts` runs inside `workerd` via `@cloudflare/vitest-pool-workers` (config in `vitest.config.ts`, `test/wrangler.test.jsonc`), applying real D1 migrations and calling server modules/route handlers directly rather than over HTTP.

**Known caveat:** on this branch there is no self-serve admin login — `prisma/seed.sql` seeds an admin with an intentionally invalid password hash, and the `/setup` first-run flow lives on the `package-catalogue-ui` branch. To exercise admin flows here, insert an administrator row with a real PBKDF2 hash (`hashPassword()` in `auth.ts`) into local D1.

## Project docs

`docs/` contains guides (`RUNNING.md`, `DEPLOY.md`, `SOURCE-CODE-BREAKDOWN.md`, `AGENT-CONTEXT.md`, `NON-TECH.md`) plus 52 hackathon tickets (`BE-001..019`, `FE-001..017`, `OPS-001..016`, indexed in `docs/README.md`) with YAML frontmatter (id, owner, priority, estimate, dependencies, status). When asked what to do next, start from P0 tickets and their dependency chains rather than inventing scope.

## Working conventions

- This project is also worked on by non-technical collaborators using AI assistants (see `docs/NON-TECH.md`) — prefer small, reviewable changes on a branch with a PR; never merge or deploy unilaterally; never write to production D1 or apply `seed.sql` remotely.
- Treat as off-limits without an experienced human driving: secrets/`.dev.vars`, `wrangler.jsonc` env blocks, `prisma/schema.prisma` + `migrations/`, `src/lib/server/auth.ts`, `src/lib/server/generated/`.
- After changes, verify with `npm run check` and, where relevant, exercise the affected flow with `npm run dev` rather than assuming it works.
- Keep `docs/SOURCE-CODE-BREAKDOWN.md` updated if routes or `src/lib` files change materially.
