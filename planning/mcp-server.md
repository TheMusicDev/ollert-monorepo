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

**Open risk, not yet verified**: whether the `aud` claim on OAuth-flow-issued tokens matches `SUPABASE_JWT_AUD` (the value `AuthMiddleware.php` currently checks). If not, `assertClaims()` needs to accept either audience. This must be confirmed by driving Supabase's OAuth endpoints for real before building anything else — see Implementation Order below.

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
* **MCP SDK**: official `@modelcontextprotocol/sdk` (TypeScript), streamable-HTTP transport (required for a hosted remote connector — stdio doesn't apply here).
* **HTTP layer**: Hono — thin routing/middleware, only a handful of routes (`/mcp`, `/.well-known/oauth-protected-resource`), but auth applies to `/mcp` and not to the metadata route, which is exactly what Hono middleware composition is for. Runs natively under `Bun.serve({ fetch: app.fetch })`, no adapter needed.
* **JWT/JWKS verification**: `jose` (`createRemoteJWKSet` against `SUPABASE_JWKS_URL`), porting `AuthMiddleware.php`'s `assertClaims()` logic.
* **Tool input validation**: `zod`.

# Directory layout

```
mcp/
  package.json
  tsconfig.json
  .env.example
  Dockerfile              # for Kamal
  config/deploy.yml        # Kamal config
  src/
    index.ts              # entrypoint: load config, start HTTP server
    server.ts             # Hono app: MCP streamable-HTTP transport at /mcp + metadata routes
    config.ts             # env loading/validation, fail fast
    apiClient.ts           # fetch wrapper → api/, forwards Bearer token, translates {error:{...}} into isError MCP results
    types.ts               # mirrors api-contract.md resource shapes exactly
    auth/
      jwks.ts                # jose createRemoteJWKSet against SUPABASE_JWKS_URL
      verifyToken.ts          # ports AuthMiddleware.php's assertClaims(): iss/aud/sub/exp, uniform failure, as Hono middleware
      protectedResourceMetadata.ts  # RFC 9728 handler
      challenge.ts            # 401 WWW-Authenticate: Bearer resource_metadata="..."
      oauthProxyProvider.ts  # wires the SDK's external-AS delegation to Supabase
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

Kamal deploys a Docker container to a machine on the local network; Cloudflare (Tunnel) exposes it publicly. Chosen because the existing shared-PHP-host deploy target (see [Architecture § Deployment](architecture.md#deployment)) has no Node runtime — `mcp/` needs its own target. OAuth/DCR testing is done against the real hosted Supabase project, not a local Supabase CLI stack (this repo has none today — see [Architecture § Local Development](architecture.md#local-development) — and the beta OAuth-server feature's local-emulation support is unconfirmed).

# Implementation order (highest-risk unknowns first)

1. **Risk spikes** — before writing the full service: confirm the `aud`-claim compatibility by manually driving Supabase's OAuth `authorize`/`token` endpoints and hitting a real `api/` endpoint with the resulting token; confirm the dynamic-client-registration endpoint and the MCP SDK's external-AS-proxy helper against current docs/installed versions; confirm `approveAuthorization()`/`denyAuthorization()` signatures; stand up the Cloudflare Tunnel + minimal Kamal skeleton early for a stable public URL; then run one throwaway tool end-to-end through claude.ai's actual UI before investing in all ~19 tools.
2. Scaffold `mcp/`, wire resource-server auth (JWKS validation, protected-resource metadata, 401 challenge, AS-proxy config).
3. Build `apiClient.ts`'s error-envelope translation, then the tool layer.
4. Build the `web/` consent route.
5. Local dev/testing via `@modelcontextprotocol/inspector` against local `api/` + the hosted Supabase project; claude.ai verification via the tunnel.
6. Real deploy (Kamal + Cloudflare Tunnel finalized), then update this doc/[Change log](log.md) with anything that changed from the design above.

# Open risks

* `aud`-claim compatibility between OAuth-flow tokens and `SUPABASE_JWT_AUD` — unverified.
* Dynamic-client-registration endpoint path and the MCP TS SDK's external-AS-proxy helper shape — unverified against current docs/versions.
* Whether claude.ai's hosted connector flow completes end-to-end against Supabase's beta OAuth server at all — the highest-leverage thing to check early.
* No rate limiting in `mcp/` beyond `api/`'s existing per-user quotas — acceptable for v1.
* Token/refresh lifetime handling by claude.ai's hosted connector against a Supabase-OAuth-issued token — unverified, could surface as silent mid-session tool-call failures.
