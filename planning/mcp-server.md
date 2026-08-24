---
type: Architecture
title: Ollert MCP Server
description: MCP server design — how an AI agent (claude.ai custom connector) manages Ollert boards/lists/cards via the existing REST API.
tags: [mcp, auth, deployment]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-23T00:00:00Z" }
---

# Summary

`mcp/` is a new, separate top-level service (sibling to `api/` and `web/`) exposing Ollert's REST API as MCP (Model Context Protocol) tools, so claude.ai's hosted "custom connector" feature can manage a user's boards/lists/cards on their behalf. It is a thin client of the existing CakePHP API — no business logic, authorization, or quota checks are reimplemented in Node. Not yet built; this documents the design decided on before implementation starts.

# Why Node, not PHP

A PHP-native MCP server was considered first, since the backend already lives in CakePHP. Two options exist — the official `mcp/sdk` PHP package (PHP Foundation/Anthropic/Symfony collaboration) and CakeDC's `cakephp-mcp` plugin — but both are pre-1.0/immature (CakeDC's plugin has 3 commits, no documented transport/auth). The official TypeScript MCP SDK is the mature, first-party option, so `mcp/` is Node/TypeScript (Bun runtime, matching `web/`'s existing toolchain — see [Architecture](architecture.md)) instead.

# Why Supabase is the OAuth Authorization Server

claude.ai's hosted custom connectors require OAuth 2.1 on the remote MCP server — there's no way to hand it a manually-copied bearer token, which rules out simple pass-through auth.

Supabase Auth now ships a native OAuth 2.1 + OIDC authorization server built specifically for MCP use cases (public beta since Nov 2025), issuing access tokens signed with the **same JWKS/keys** as normal Supabase login JWTs — the ones `api/src/Middleware/AuthMiddleware.php` already verifies (see [Architecture § Auth Flow](architecture.md#auth-flow)). This means `mcp/` never issues, stores, or refreshes tokens itself:

* It validates every incoming Bearer token against Supabase's JWKS, mirroring `AuthMiddleware.php`'s checks (RS256 signature, `iss`, `aud`, `exp`, `sub`) — same rules, ported to TypeScript (`jose`), not reinvented.
* It publishes RFC 9728 protected-resource metadata (`/.well-known/oauth-protected-resource`) pointing claude.ai at Supabase's authorization-server metadata (`https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`) — the actual authorize/token/refresh/dynamic-client-registration dance happens directly between claude.ai and Supabase, never touching `mcp/`.
* It forwards the caller's Bearer token unchanged to `api/` on every tool call — `api/`'s existing middleware verifies it exactly as it does today for the frontend.

**Known gap**: Supabase's OAuth flow does not host a consent screen. `web/` (the existing TanStack Start SPA) needs one new route that reads the incoming OAuth authorization request, reuses the existing Supabase JS session (see [Architecture § Auth Flow](architecture.md#auth-flow)), shows an Allow/Deny screen, and calls Supabase JS's `approveAuthorization()`/`denyAuthorization()` to complete the flow. This is the one place the MCP feature touches `web/`.

**Open risk, confirmed 2026-08-24**: the Supabase project's native OAuth server was initially **disabled** — `GET .../.well-known/oauth-authorization-server/auth/v1` returned `404 {"error_code":"feature_disabled","msg":"OAuth server is disabled"}`. This was the real blocker for the end-to-end claude.ai↔Supabase OAuth dance (authorize/token/DCR all live behind that feature flag). **Cleared the same day**: user enabled the OAuth 2.1 server in the Supabase dashboard; `buildHandler()` now boots against the real AS-metadata URL (200, `issuer` matches `config.jwtIss`). End-to-end dance verified — see [Change log](log.md) 2026-08-24.

**Open risk, still unverified**: whether the `aud` claim on OAuth-flow-issued tokens matches `SUPABASE_JWT_AUD` (the value `AuthMiddleware.php` currently checks). If not, `verifyAccessToken()` in `mcp/src/auth/verifyToken.ts` needs to accept either audience — that is the single place to widen it. Cannot be confirmed until the Supabase OAuth server is enabled and a real OAuth-flow token can be obtained.

# Architecture

```
claude.ai (hosted connector)
   │  OAuth 2.1 + PKCE, dynamic client registration against Supabase
   │  MCP tool calls, Authorization: Bearer <supabase-oauth-access-token>
   ▼
mcp/  (Node/TS, Resource Server only — no token issuance/storage)
   │  - GET /.well-known/oauth-protected-resource (RFC 9728) → points at Supabase's AS metadata
   │  - validates every Bearer token against Supabase JWKS (mirrors AuthMiddleware.php)
   │  - one MCP tool per REST endpoint (see api-contract.md), thin fetch-and-translate
   │  forwards the SAME Bearer token unchanged to the API
   ▼
api/  (existing CakePHP REST API — untouched business logic/authz/quotas)
   ▲  verifies the same JWT via the same JWKS/iss/aud rules
   │
Supabase Auth (hosted) — issues normal login JWTs AND, via its OAuth 2.1/OIDC server,
mints MCP-flow access tokens signed with the same keys.

web/ gains one new route: the OAuth consent screen Supabase's flow redirects to.

Public ingress for mcp/: Cloudflare Tunnel → Kamal-deployed container on the local
network (see Deployment below) — the shared PHP host `api/`/`web/` deploy to has no
Node runtime, so mcp/ needs a separate target.
```

# Stack

* **Runtime/package manager**: Bun, matching `web/`'s convention (see [Architecture](architecture.md)).
* **MCP SDK**: official `@modelcontextprotocol/server` v2.0.0 (TypeScript), streamable-HTTP transport (required for a hosted remote connector — stdio doesn't apply here). The installed v2 API differs from the README examples: tools register via `server.registerTool(name, { description, inputSchema: z.object({...}) }, cb)`, not `.tool()`; and the serving entry is `createMcpHandler(factory, { legacy: "stateless" })`, which returns a web-standard `{ fetch }` handler and calls `factory(ctx)` once per HTTP request with `ctx.authInfo` (pass-through) + `ctx.requestInfo`.
* **HTTP layer**: none — `createMcpHandler`'s handler is a web-standard `(request) => Promise<Response>` that `Bun.serve({ fetch })` mounts directly. The SDK ships matching web-standard auth helpers (`requireBearerAuth`, `oauthMetadataResponse`, `bearerAuthChallengeResponse`, `hostHeaderValidationResponse`) that take/return raw `Request`/`Response`, so Hono would only have been a passthrough. Hono (`@modelcontextprotocol/hono`) was dropped from the original design — fewer deps, fewer files.
* **JWT/JWKS verification**: `jose` (`createRemoteJWKSet` against `SUPABASE_JWKS_URL`), porting `AuthMiddleware.php`'s `assertClaims()` logic. Exposed as an `OAuthTokenVerifier` the SDK's `requireBearerAuth` wraps (verifier does the jose verify + iss/aud/sub/email claims; the SDK enforces `requiredScopes` + `expiresAt` presence on top).
* **Tool input validation**: `zod` v4 — the SDK's `StandardSchemaWithJSON` requires a `jsonSchema` converter on the schema's `~standard` props, which zod 3 lacks and zod 4 provides. (The SDK itself imports `zod/v4`.)

# Directory layout

```
mcp/
  package.json
  tsconfig.json
  .env.example
  Dockerfile              # for Kamal
  config/deploy.yml        # Kamal config
  src/
    index.ts              # entrypoint: load config, await buildHandler(), Bun.serve — no Hono, no node-server adapter
    server.ts             # web-standard fetch handler: /mcp (streamable-HTTP) + RFC 9728 metadata + /health; SDK auth helpers gate /mcp
    config.ts             # env loading/validation, fail fast
    apiClient.ts           # fetch wrapper → api/, forwards Bearer token, translates {error:{...}} into isError MCP results
    types.ts               # mirrors api-contract.md resource shapes exactly
    auth/
      jwks.ts                # jose createRemoteJWKSet against SUPABASE_JWKS_URL
      verifyToken.ts          # ports AuthMiddleware.php's claim checks (iss/aud/sub/exp); SDK OAuthTokenVerifier → returns AuthInfo, throws OAuthError(InvalidToken)
    tools/
      orgs.ts                 # list_orgs, create_org, get_org, update_org, delete_org
      orgMembers.ts            # list_org_members, add_org_member, remove_org_member
      boards.ts                # list_org_boards, create_board, get_board, update_board, delete_board
      lists.ts                  # create_list, update_list, delete_list
      cards.ts                   # create_card, update_card, delete_card
      index.ts                    # registers all tools with the Server
```

Tool wrappers are 1:1 (or close to it) with [API Contract](api-contract.md)'s ~19 endpoints — that document is the sole authority for request/response shapes, pagination, and error codes; this doc doesn't re-derive them.

New file outside `mcp/`: `web/src/routes/oauth/consent.tsx` (exact path TBD against what Supabase's flow actually redirects to), following the existing pattern in `web/src/routes/auth/callback.tsx` and reusing `web/src/lib/supabase.ts`'s client plus `web/src/components/auth/` (`AuthCard`, `SubmitButton`, `FormError`).

# Config

`mcp/.env.example` mirrors `api/.env`'s Supabase values exactly — no separate values invented:

* `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISS`, `SUPABASE_JWT_AUD`
* `SUPABASE_AS_METADATA_URL` (`.../.well-known/oauth-authorization-server/auth/v1`)
* `API_BASE_URL` (CakePHP API base)
* `MCP_PUBLIC_BASE_URL` (this server's own public URL, via the Cloudflare Tunnel domain)
* `PORT`, `JWKS_CACHE_TTL` (mirror `api/`'s 900s default)

# Deployment

Kamal deploys a Docker container to a machine on the local network; Cloudflare (Tunnel) exposes it publicly. Chosen because the existing shared-PHP-host deploy target (see [Architecture § Deployment](architecture.md#deployment)) has no Node runtime — `mcp/` needs its own target. OAuth testing is against the real hosted Supabase project (no local Supabase CLI stack in this repo — see [Architecture § Local Development](architecture.md#local-development)). Deployed 2026-08-24 as `ollert-mcp.2719.fyi` behind the shared kamal-proxy (same negrita target as api/web, distinct Host-routed vhost, `config/deploy.mcp.yml`); cloudflared's existing `*.2719.fyi` wildcard covered the new host.

# Implementation order (highest-risk unknowns first)

1. **Risk spikes** — DONE (2026-08-24): SDK API confirmed against installed `@modelcontextprotocol/server` — `McpServer.registerTool` (not `.tool`), `createMcpHandler(factory, {legacy:"stateless"})` returning a web-standard fetch handler (no Hono), SDK `requireBearerAuth`/`oauthMetadataResponse`/`buildOAuthProtectedResourceMetadata` replace the hand-rolled challenge + RFC 9728 + external-AS-proxy files. `aud`-claim and claude.ai end-to-end remain unverified — blocked on the Supabase OAuth server being enabled (see Open risks).
2. DONE: scaffold `mcp/`, wire resource-server auth — JWKS validation (`verifier: OAuthTokenVerifier`), protected-resource metadata + AS metadata (SDK `oauthMetadataResponse`, path-aware → `/.well-known/oauth-protected-resource/mcp`), 401 challenge (SDK `bearerAuthChallengeResponse` via `requireBearerAuth`). Server boots, all routes smoke-tested against a stub AS-metadata doc.
3. DONE: `apiClient.ts` error-envelope translation + all 18 tools (`registerTool` 1:1 with api-contract.md). `bun run typecheck` green.
4. DONE: `web/` consent route built — `web/src/routes/oauth/consent.tsx` (`/oauth/consent`, public — not under `_authenticated/`). Reads `authorization_id`, inline sign-in when no session (reuses `AuthCard`/`FormField`/`SubmitButton`/`FormError` + `useAuth().signIn`), calls `supabase.auth.oauth.getAuthorizationDetails` → renders client name/logo/URI + scopes + redirect_uri, `approveAuthorization`/`denyAuthorization` with `skipBrowserRedirect:true` → `window.location.href = data.redirect_url` (avoids the `redirect_to` docs footgun, supabase#45006). `tsc` + `eslint` + `bun run build` all green.
5. Local dev/testing via `@modelcontextprotocol/inspector` against local `api/` + the hosted Supabase project; claude.ai verification via the tunnel — needs a real OAuth-flow token (server now enabled, see Open risks).
6. DONE (2026-08-24): real deploy — `kamal deploy -c config/deploy.mcp.yml` → `ollert-mcp.2719.fyi` behind the shared kamal-proxy (cloudflared `*.2719.fyi` wildcard covered the new host). One fix: `/health` moved before the `hostHeaderValidationResponse` guard (kamal-proxy healthchecks by docker-internal Host → 403 under the DNS-rebinding check; `/health` returns only `ok`, safe to exempt — mirrors api's nginx-static-health pattern). The web SPA also needed redeploying to pick up the `/oauth/consent` route (live container predating `518ae57` 404'd on first connect). End-to-end claude.ai↔Supabase dance verified: `aud` claim matches `SUPABASE_JWT_AUD=authenticated`, no widening needed. See [Change log](log.md) 2026-08-24.

# Open risks

* **Supabase OAuth server — ENABLED 2026-08-24** (was `feature_disabled`; now `GET …/.well-known/oauth-authorization-server/auth/v1` → 200, `issuer` = `…/auth/v1` matches `config.jwtIss`, `scopes_supported` includes `offline_access`). `SUPABASE_AS_METADATA_URL` points at the real URL; mcp's `buildHandler` boots against it with no stub. OAuth app registered as a **public client** (PKCE-only, `token_endpoint_auth_method: none`) with redirect URI `https://claude.ai/api/mcp/auth_callback` — claude.ai strictly validates the auth method (supabase PR #2300), public+`none` can't mismatch. DCR left **off** (claude.ai supports a pasted pre-registered `client_id` via Advanced settings → skips DCR; no open registration endpoint).
* `aud`-claim compatibility between OAuth-flow tokens and `SUPABASE_JWT_AUD` (`authenticated`) — **VERIFIED 2026-08-24**: a real claude.ai↔Supabase connector dance produced an OAuth-flow token that `verifyToken.ts` accepted with no audience-widening. `SUPABASE_JWT_AUD=authenticated` is correct as-is.
* DCR endpoint + SDK external-AS-proxy helper — RESOLVED: the SDK's `requireBearerAuth` + `oauthMetadataResponse` + RFC 9728 metadata publish Supabase's own AS endpoints as `authorization_servers`; no DCR, no proxy provider file needed. claude.ai discovers Supabase's AS directly.
* No rate limiting in `mcp/` beyond `api/`'s existing per-user quotas — acceptable for v1.
* Token/refresh lifetime handling by claude.ai's hosted connector against a Supabase-OAuth-issued token — unverified, could surface as silent mid-session tool-call failures.
