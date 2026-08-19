---
type: Architecture
title: Ollert Architecture
description: System shape, repo layout, tech stack, and auth flow for Ollert.
tags: [architecture, auth, stack]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T00:00:00Z" }
---

# Summary

Three pieces: a Vite+React SPA, a CakePHP JSON API, and Supabase used **only** for auth (no app data lives in Supabase). The frontend owns the Supabase session (login, refresh, logout) and attaches the Supabase-issued JWT as a Bearer token on every API call. CakePHP never talks to Supabase to log a user in — it only verifies the JWT it's handed.

# Repo Layout

Monorepo, single git root:

```
ollert/
  planning/     # this OKF bundle
  api/          # CakePHP backend
  web/          # Vite + React frontend
```

# Tech Stack

* **Frontend**: Vite, React, TypeScript, Supabase JS client (`@supabase/supabase-js`) for auth only — no Supabase DB/Realtime client calls, since app data doesn't live there.
* **Frontend router**: TanStack Router, used as a plain client-side SPA (not TanStack Start). We deploy to a shared PHP host with no Node server to run — TanStack Start's SSR/server-functions model assumes a running server, and forcing it into a "no SSR" mode fights the tool for no benefit. `vite build` with TanStack Router produces static `index.html` + JS/CSS, deployable to any static host: copy the build output to the PHP host and add a catch-all rewrite to `index.html` (`.htaccess`) for client-side routes.
* **Backend**: CakePHP (latest stable 5.x), MySQL for app data, PHP JWT library (e.g. `firebase/php-jwt`) for verifying Supabase tokens, `cakephp/migrations` plugin for schema migrations.
* **Auth**: Supabase Auth (hosted). Email/password to start; social providers deferred.
* **DB**: MySQL, owned and migrated by CakePHP (`bin/cake migrations migrate`). Decoupled from Supabase's own Postgres project — Supabase is identity-only.
* **Testing**: PHPUnit (CakePHP's default) for `/api`; Vitest for `/web` unit/component tests; Playwright for e2e, driving the real built frontend against a running API rather than living inside the Vitest/FE toolchain — see [Roadmap](roadmap.md) for phasing.

# Auth Flow

1. User signs up / logs in via Supabase JS client in the React app. Supabase issues a JWT (access token) + refresh token; the JS client persists and auto-refreshes the session.
2. On every API request, the frontend attaches `Authorization: Bearer <supabase-access-token>`.
3. CakePHP runs an authentication middleware that:
   - Fetches and caches Supabase's JWKS (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`) to get the current signing key(s).
   - Verifies the JWT signature (RS256) and standard claims (`exp`, `aud`, `iss`).
   - Extracts `sub` (Supabase user UUID) as the identity for the request.
4. CakePHP maps the Supabase `sub` UUID to a local `users` row: on every authenticated request, find-or-create by `supabase_uid` — if this is the first request from that `sub`, the row is created inline (just-in-time provisioning, using the `email` claim from the token). No separate signup/bootstrap endpoint against the CakePHP API. See [Data Model](data-model.md).
5. No session state on the backend — every request is independently verified. No CakePHP-side login endpoint, no cookies.

# CORS

Frontend and API are different origins, and auth is a Bearer token (not a cookie), so there's no need for `Access-Control-Allow-Credentials` — that keeps the policy to a plain origin allow-list, avoiding the wildcard-origin-plus-credentials foot-gun entirely.

* **Allowed origins**: explicit allow-list, not `*`. Dev default `http://localhost:5173`. Production origin(s) added once the deploy target's domain is known — see Deployment below.
* **Allowed headers**: `Authorization`, `Content-Type`.
* **Allowed methods**: `GET, POST, PATCH, DELETE, OPTIONS`.
* **Credentials**: not sent, not allowed — no cookies cross the API boundary.

## Why JWKS/RS256 over a shared HS256 secret

Supabase's newer projects issue RS256-signed JWTs by default and publish a JWKS endpoint. Verifying against JWKS means CakePHP never holds a shared secret that has to be copied into backend config and rotated in lockstep with Supabase — it just fetches Supabase's public keys (cached, e.g. 10-60 min TTL) and verifies signatures locally. Slightly more moving parts (an HTTP fetch + cache) than a static HS256 secret, but avoids a long-lived shared secret sitting in the API's env vars. If the Supabase project turns out to be on the legacy HS256 JWT secret, fall back to that — same middleware, swap the key source.

# Deployment

Shared PHP host, SSH access. Deploy via local scripts (not CI) — separate scripts for `/api` and `/web` since the two pipelines differ (CakePHP: sync PHP + run migrations over SSH; `/web`: `vite build` then sync the static output). Writing the actual scripts is deferred — not worth building a deploy pipeline before there's a working app to deploy — see [Roadmap](roadmap.md).
