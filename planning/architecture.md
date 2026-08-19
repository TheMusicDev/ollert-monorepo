---
type: Architecture
title: Ollert Architecture
description: System shape, repo layout, tech stack, and auth flow for Ollert.
tags: [architecture, auth, stack]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19" }
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
* **Backend**: CakePHP (latest stable 5.x), MySQL for app data, PHP JWT library (e.g. `firebase/php-jwt`) for verifying Supabase tokens.
* **Auth**: Supabase Auth (hosted). Email/password to start; social providers deferred.
* **DB**: MySQL, owned and migrated by CakePHP (`bin/cake migrations migrate`). Decoupled from Supabase's own Postgres project — Supabase is identity-only.

# Auth Flow

1. User signs up / logs in via Supabase JS client in the React app. Supabase issues a JWT (access token) + refresh token; the JS client persists and auto-refreshes the session.
2. On every API request, the frontend attaches `Authorization: Bearer <supabase-access-token>`.
3. CakePHP runs an authentication middleware that:
   - Fetches and caches Supabase's JWKS (`https://<project>.supabase.co/auth/v1/.well-known/jwks.json`) to get the current signing key(s).
   - Verifies the JWT signature (RS256) and standard claims (`exp`, `aud`, `iss`).
   - Extracts `sub` (Supabase user UUID) as the identity for the request.
4. CakePHP maps the Supabase `sub` UUID to a local `users` row (created on first-seen, i.e. just-in-time provisioning — no separate signup step against the CakePHP API). See [Data Model](data-model.md).
5. No session state on the backend — every request is independently verified. No CakePHP-side login endpoint, no cookies.

## Why JWKS/RS256 over a shared HS256 secret

Supabase's newer projects issue RS256-signed JWTs by default and publish a JWKS endpoint. Verifying against JWKS means CakePHP never holds a shared secret that has to be copied into backend config and rotated in lockstep with Supabase — it just fetches Supabase's public keys (cached, e.g. 10-60 min TTL) and verifies signatures locally. Slightly more moving parts (an HTTP fetch + cache) than a static HS256 secret, but avoids a long-lived shared secret sitting in the API's env vars. If the Supabase project turns out to be on the legacy HS256 JWT secret, fall back to that — same middleware, swap the key source.

# Deployment

Not decided yet. Revisit once MVP is functional locally.
