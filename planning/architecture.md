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

> **Planned reversal (decided 2026-08-24, not started):** the "Supabase auth-only, app data in MySQL" split is being reversed — Ollert is going all-in on Supabase (Postgres DB + Storage + Realtime). This doc keeps describing the current MySQL state until the migration branch executes the swap; see [Supabase Migration](supabase-migration.md) and [log.md](log.md) 2026-08-24 (cont.).

# Repo Layout

Monorepo, single git root:

```
ollert/
  planning/     # this OKF bundle
  api/          # CakePHP backend
  web/          # Vite + React frontend
```

# Tech Stack

* **Frontend**: TanStack Start, React, TypeScript, Tailwind CSS, Base UI (unstyled/headless component primitives) — see [Design](design.md) for the starting palette/typography/layout pattern, **Bun v1.3.14** as package manager and script runner — pinned via `"packageManager": "bun@1.3.14"` in `/web/package.json` once scaffolded (Bun reads this field to self-select its version, the same convention Corepack uses for npm/yarn/pnpm; no separate `.bun-version` file needed). Supabase JS client (`@supabase/supabase-js`) for auth only — no Supabase DB/Realtime client calls, since app data doesn't live there.
* **Frontend router/framework mode**: TanStack Start, but run in **SPA mode** — SSR and server functions turned off (`ssr: false`), producing a plain static client bundle, same deploy shape as a Vite SPA. We deploy to a shared PHP host with no Node server to run, and Start's SSR/server-functions model assumes a running server; SPA mode gets Start's router/tooling without that requirement. Build via Bun (`bun run build`) produces static `index.html` + JS/CSS, deployable to any static host: copy the build output to the PHP host and add a catch-all rewrite to `index.html` (`.htaccess`) for client-side routes. If a real Node-capable deploy target is adopted later, SSR can be turned back on.
* **Backend**: CakePHP (latest stable 5.x) on **PHP 8.5**, MySQL for app data, PHP JWT library (e.g. `firebase/php-jwt`) for verifying Supabase tokens, `cakephp/migrations` plugin for schema migrations, `TimestampBehavior` (core) for `created`/`modified`, `muffin/trash` plugin for soft deletes (`deleted` column) — see [Data Model](data-model.md). Pin `"php": "8.5.*"` in `composer.json`; confirm the shared deploy host actually offers 8.5 before Phase 3's first deploy (CakePHP 5.x requires 8.1+, so 8.5 is a floor choice, not a compatibility requirement).
* **Auth**: Supabase Auth (hosted). Email/password to start; social providers deferred — **Google + Apple only** (decided 2026-08-24, not GitHub), blocked on obtaining provider credentials.
* **DB**: MySQL, owned and migrated by CakePHP (`bin/cake migrations migrate`). Decoupled from Supabase's own Postgres project — Supabase is identity-only. Local dev runs MariaDB (MySQL-wire-compatible) via the `docker/` Compose stack rather than a locally-installed MySQL — see Local Development below. **Planned reversal (decided 2026-08-24, not started):** this MySQL setup is being replaced by Supabase hosted Postgres as part of the all-in-Supabase overhaul — see [Supabase Migration](supabase-migration.md). Current MySQL state stays until the migration branch executes the swap.
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

`docker/docker-compose.yml` runs the two local support services CakePHP and (eventually) email flows depend on — the app itself (PHP, Bun) runs natively on the host, not in a container:

* **`db`** — `mariadb:11.8`, MySQL-wire-compatible, exposed on host port `${DB_PORT:-9937}` (offset from MySQL's default `3306` so it won't collide with a locally-installed MySQL). Data persists to a bind-mounted `docker/data/mariadb`.
* **`mailpit`** — SMTP catcher + web UI, ports `${MAILPIT_SMTP_PORT:-1025}` / `${MAILPIT_UI_PORT:-8025}`. Its role is a placeholder for now: Supabase Auth (hosted) sends its own auth emails directly from Supabase's servers, so Mailpit won't intercept password-reset/confirmation mail unless Supabase is also self-hosted locally. It becomes useful the moment CakePHP itself sends any email (none is currently planned in the MVP).

Both services default their env vars (`docker/.env.example`, copy to `docker/.env` for real local values — `docker/.env` and `docker/data/` are gitignored, not committed).

> **Planned change (decided 2026-08-24, not started):** once the all-in-Supabase migration lands, this `docker/` MariaDB + Mailpit stack is replaced by the **Supabase CLI local stack** (`supabase start`) — offline, fully isolated from prod, ~6 containers. See [Supabase Migration](supabase-migration.md#local-dev).

# Deployment

Shared PHP host, SSH access. Deploy via local scripts (not CI) — separate scripts for `/api` and `/web` since the two pipelines differ (CakePHP: sync PHP + run migrations over SSH; `/web`: `bun run build` (TanStack Start in SPA mode) then sync the static output). Writing the actual scripts is deferred — not worth building a deploy pipeline before there's a working app to deploy — see [Roadmap](roadmap.md). Note: the all-in-Supabase migration (decided 2026-08-24, not started — see [Supabase Migration](supabase-migration.md)) moves the DB to hosted Supabase Postgres, so the PHP-host deploy no longer carries the database; the `/api` + `/web` deploy shape above is otherwise unaffected.
