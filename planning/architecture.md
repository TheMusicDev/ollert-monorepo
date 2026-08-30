---
type: Architecture
title: Ollert Architecture
description: System shape, repo layout, tech stack, and auth flow for Ollert.
tags: [architecture, auth, stack]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T19:50:29Z" }
---

# Summary

Three pieces: a TanStack Start SPA (React, running in SPA mode — no SSR/server functions), a CakePHP JSON API, and Supabase used **only** for auth (no app data lives in Supabase). The frontend owns the Supabase session (login, refresh, logout) and attaches the Supabase-issued JWT as a Bearer token on every API call. CakePHP never talks to Supabase to log a user in — it only verifies the JWT it's handed. All entity primary keys, in Supabase and in CakePHP's MySQL schema, are UUIDs rather than auto-increment integers — see [Data Model](data-model.md).

> **Reversal in progress (decided 2026-08-24, local spine landed 2026-08-27):** the "Supabase auth-only, app data in MySQL" split is being reversed — Ollert is going all-in on Supabase (Postgres DB + Storage + Realtime). Local dev now runs Postgres end-to-end (see DB and Local Development below); only the prod cutover on negrita remains. See [Supabase Migration](supabase-migration.md) and [log.md](log.md) 2026-08-24 (cont.) and 2026-08-27.

# Repo Layout

Monorepo, single git root:

```
ollert/
  planning/     # this OKF bundle
  api/          # CakePHP backend
  web/          # Vite + React frontend
```

# Tech Stack

* **Frontend**: TanStack Start, React, TypeScript, Tailwind CSS, Base UI (unstyled/headless component primitives) — see [Design](design.md) for the starting palette/typography/layout pattern, **Bun v1.3.14** as package manager and script runner — pinned via `"packageManager": "bun@1.3.14"` in `/web/package.json` (declares the version for tooling that reads it, e.g. `oven-sh/setup-bun` in CI — unlike Corepack for npm/yarn/pnpm, Bun itself doesn't auto-switch to it locally; install the pinned version yourself). Supabase JS client (`@supabase/supabase-js`) for auth only — no Supabase DB/Realtime client calls, since app data doesn't live there.
* **Frontend router/framework mode**: TanStack Start, but run in **SPA mode** — SSR and server functions turned off (`ssr: false`), producing a plain static client bundle, same deploy shape as a Vite SPA. We deploy to a shared PHP host with no Node server to run, and Start's SSR/server-functions model assumes a running server; SPA mode gets Start's router/tooling without that requirement. Build via Bun (`bun run build`) produces static `index.html` + JS/CSS, deployable to any static host: copy the build output to the PHP host and add a catch-all rewrite to `index.html` (`.htaccess`) for client-side routes. If a real Node-capable deploy target is adopted later, SSR can be turned back on.
* **Backend**: CakePHP (latest stable 5.x) on **PHP 8.5**, Postgres (Supabase-hosted) for app data, PHP JWT library (e.g. `firebase/php-jwt`) for verifying Supabase tokens, `cakephp/migrations` plugin for schema migrations, `TimestampBehavior` (core) for `created`/`modified`, `muffin/trash` plugin for soft deletes (`deleted` column) — see [Data Model](data-model.md). Pin `"php": "8.5.*"` in `composer.json`; confirm the shared deploy host actually offers 8.5 before Phase 3's first deploy (CakePHP 5.x requires 8.1+, so 8.5 is a floor choice, not a compatibility requirement).
* **Auth**: Supabase Auth (hosted). Email/password to start; social providers deferred — **Google + Apple only** (decided 2026-08-24, not GitHub), blocked on obtaining provider credentials.
* **DB**: Postgres, owned and migrated by CakePHP (`bin/cake migrations migrate`, driver `Cake\Database\Driver\Postgres`) — the schema lives in Supabase's hosted Postgres project's `public` schema, alongside Supabase's own `auth` schema. **2026-08-27: local dev spine landed** (see [Supabase Migration](supabase-migration.md)) — local dev runs the Supabase CLI stack (`supabase start`) rather than the retired `docker/` MariaDB Compose setup; see Local Development below. Prod (negrita) still runs the old MySQL setup until the deploy cutover, which rebuilds negrita from scratch rather than migrating live data.
* **Testing**: PHPUnit (CakePHP's default) for `/api`; Vitest (run via Bun) for `/web` unit/component tests; Playwright for e2e, driving the real built frontend against a running API rather than living inside the Vitest/FE toolchain — see [Roadmap](roadmap.md) for phasing.

# Auth Flow

1. User signs up / logs in via Supabase JS client in the React app. Supabase issues a JWT (access token) + refresh token; the JS client persists and auto-refreshes the session.
2. On every API request, the frontend attaches `Authorization: Bearer <supabase-access-token>`.
3. CakePHP runs an authentication middleware that:
   - Fetches and caches Supabase's JWKS (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`) to get the current signing key(s).
   - Verifies the JWT signature (RS256) and standard claims (`exp`, `aud`, `iss`).
   - Extracts `sub` (Supabase user UUID) as the identity for the request.
4. CakePHP maps the Supabase `sub` UUID to a local `users` row: on every authenticated request, find-or-create by `supabase_uid` — if this is the first request from that `sub`, the row is created inline (just-in-time provisioning, using the `email` claim from the token), with CakePHP generating a new local `users.id` UUID for it. No separate signup/bootstrap endpoint against the CakePHP API. See [Data Model](data-model.md).
5. No session state on the backend — every request is independently verified. No CakePHP-side login endpoint, no cookies.
6. Supabase's JS client auto-refreshes the access token in the background ahead of expiry, so in normal use the frontend never sends a stale token. If an API call still comes back 401, that means the refresh token itself is dead (revoked/expired) rather than a simple expiry — the frontend treats this as unrecoverable: clear the local session and redirect to login. No retry-after-refresh logic on the frontend.
7. Password reset and email confirmation are Supabase-hosted flows that redirect back into the app; the FE registers an `/auth/callback` route (exact path TBD at implementation time) to receive them, and that URL is added to the Supabase project's allowed redirect URLs once the project exists.

# CORS

Frontend and API are different origins, and auth is a Bearer token (not a cookie), so there's no need for `Access-Control-Allow-Credentials` — that keeps the policy to a plain origin allow-list, avoiding the wildcard-origin-plus-credentials foot-gun entirely.

* **Allowed origins**: explicit allow-list, not `*`. Dev default `http://localhost:3000` (TanStack Start's Nitro dev server, pinned via `web/package.json`'s `dev` script — not Vite's usual `5173`). Production origin(s) added once the deploy target's domain is known — see Deployment below.
* **Allowed headers**: `Authorization`, `Content-Type`.
* **Allowed methods**: `GET, POST, PATCH, DELETE, OPTIONS`.
* **Credentials**: not sent, not allowed — no cookies cross the API boundary.

## Why JWKS/RS256 over a shared HS256 secret

Supabase's newer projects issue RS256-signed JWTs by default and publish a JWKS endpoint. Verifying against JWKS means CakePHP never holds a shared secret that has to be copied into backend config and rotated in lockstep with Supabase — it just fetches Supabase's public keys (cached, 15 min TTL — short enough to bound the window where a rotated key would wrongly 401 valid tokens, long enough that cache misses stay rare) and verifies signatures locally. Slightly more moving parts (an HTTP fetch + cache) than a static HS256 secret, but avoids a long-lived shared secret sitting in the API's env vars. If the Supabase project turns out to be on the legacy HS256 JWT secret, fall back to that — same middleware, swap the key source.

# Local Development

**Current (2026-08-27):** the Supabase CLI local stack, `supabase start` from the repo root (`supabase/config.toml`) — offline, fully isolated from prod, ~9 containers. Provides both Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) and local Supabase Auth, so `api/` and `web/` point at the local project instead of the hosted one. `mcp/` is the deliberate exception — it stays pointed at the hosted project (see `mcp/.env.example`'s header comment for why: claude.ai's OAuth consent dance needs Supabase's hosted OAuth-AS feature, not set up locally). `bin/cake migrations migrate` (unchanged, `Postgres` driver) creates the app schema against it — Supabase's own migration runner is disabled in `config.toml` (`[db.migrations] enabled = false`); CakePHP's phinx migrations are the sole source of schema truth, not `supabase/migrations`. Local Auth signs tokens **RS256 with a real JWKS** (`supabase/signing_keys.json`, gitignored, generated via `supabase gen signing-key --algorithm RS256`) rather than the CLI's HS256 default, so local auth verification exercises the same code path as prod (`SUPABASE_JWKS_URL`/`SUPABASE_JWT_ISS` in `.env` point at `http://127.0.0.1:54321/...`). `supabase status` prints the local anon/publishable/service keys and URLs each session. `supabase/signing_keys.json` is a plain local file, not managed by Supabase's lifecycle — `supabase stop`/`start` and even `supabase db reset` all leave it untouched (verified directly); only regenerate it if the file doesn't exist yet or you've deleted/rotated it yourself. `db reset` *does* wipe Postgres's data (the CakePHP schema included — re-run `bin/cake migrations migrate` after one), just not the signing key or the printed URLs/keys.

The retired `docker/docker-compose.yml` (MariaDB + Mailpit) previously covered local MySQL + an SMTP catcher; both are superseded — Postgres above, and Mailpit's role (catching Supabase auth email) is now covered by the local stack's own Inbucket/Mailpit instance at the `MAILPIT_URL` `supabase status` prints. **2026-08-29: `docker/` deleted** — no longer in the repo.

# Deployment

Shared PHP host, SSH access. Deploy via local scripts (not CI) — separate scripts for `/api` and `/web` since the two pipelines differ (CakePHP: sync PHP + run migrations over SSH; `/web`: `bun run build` (TanStack Start in SPA mode) then sync the static output). Writing the actual scripts is deferred — not worth building a deploy pipeline before there's a working app to deploy — see [Roadmap](roadmap.md). Note: the all-in-Supabase migration (decided 2026-08-24, local spine landed 2026-08-27, prod cutover pending — see [Supabase Migration](supabase-migration.md)) moves the DB to hosted Supabase Postgres, so the PHP-host deploy no longer carries the database; the `/api` + `/web` deploy shape above is otherwise unaffected.
