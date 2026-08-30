# Ollert MCP Server

Exposes [Ollert](../)’s REST API ([`planning/api-contract.md`](../planning/api-contract.md)) as MCP tools, so an AI agent (e.g. claude.ai’s hosted custom connector) can manage a user’s orgs, boards, lists, and cards on their behalf.

It is a thin **resource server**: it validates the caller’s Supabase Bearer JWT against the same JWKS the CakePHP API uses (mirroring `api/src/Middleware/AuthMiddleware.php`), then **forwards that same token unchanged** to the API on every tool call. No business logic, authorization, quotas, or token issuance/storage live here — the API owns all of that. Design and deployment: [`planning/mcp-server.md`](../planning/mcp-server.md). Live at `ollert-mcp.2719.fyi` behind the shared kamal-proxy.

## Tools (23)

Reads carry `readOnlyHint`; deletes carry `destructiveHint`; creates/updates carry no annotation (MCP defaults are correct). See [`planning/api-contract.md`](../planning/api-contract.md) for the sole authoritative request/response shapes, pagination, and error codes — tool wrappers are 1:1 with it.

### Orgs
- `list_orgs` → `GET /api/orgs` (paginated) — orgs the caller owns/belongs to. `readOnlyHint`.
- `create_org` → `POST /api/orgs` — creator becomes owner.
- `get_org` → `GET /api/orgs/:id` — with its boards nested. `readOnlyHint`.
- `update_org` → `PATCH /api/orgs/:id` — rename (owner or member).
- `delete_org` → `DELETE /api/orgs/:id` — owner only; soft delete. `destructiveHint`.

### Org members
- `list_org_members` → `GET /api/orgs/:id/members` (paginated). `readOnlyHint`.
- `add_org_member` → `POST /api/orgs/:id/members` — by email (must already have an account).
- `remove_org_member` → `DELETE /api/orgs/:id/members/:userId` — owner only, or self. `destructiveHint`.

### Boards
- `list_org_boards` → `GET /api/orgs/:id/boards` (paginated). `readOnlyHint`.
- `create_board` → `POST /api/orgs/:id/boards` — org owner only; 422 over `max_boards_per_org`.
- `get_board` → `GET /api/boards/:id` — lists + cards nested, unpaginated (full kanban). `readOnlyHint`.
- `update_board` → `PATCH /api/boards/:id` — rename (any org member).
- `delete_board` → `DELETE /api/boards/:id` — any org member; soft delete. `destructiveHint`.

### Lists
- `list_lists` → `GET /api/boards/:id/lists` (paginated, ordered by `position`). `readOnlyHint`.
- `create_list` → `POST /api/boards/:id/lists` — 422 over `max_lists_per_board`.
- `get_list` → `GET /api/lists/:id` — cards nested, unpaginated (full column). `readOnlyHint`.
- `update_list` → `PATCH /api/lists/:id` — rename and/or reposition (`position` float).
- `delete_list` → `DELETE /api/lists/:id` — soft delete. `destructiveHint`.

### Cards
- `list_cards` → `GET /api/lists/:id/cards` (paginated, ordered by `position`). `readOnlyHint`.
- `create_card` → `POST /api/lists/:id/cards` — 422 over `max_cards_per_board` (board-wide count).
- `get_card` → `GET /api/cards/:id`. `readOnlyHint`.
- `update_card` → `PATCH /api/cards/:id` — title/description/due_date/position, and `list_id` to move across lists (one request per drag-drop).
- `delete_card` → `DELETE /api/cards/:id` — soft delete. `destructiveHint`.

## Pagination

`list_*` tools accept optional `page` (≥1) and `limit` (≥1, ≤100) and return the API’s `{ data, meta: { page, limit, total, totalPages } }` envelope — see [`api-contract.md#pagination`](../planning/api-contract.md#pagination). Nested reads (`get_board`, `get_list`) are unpaginated by design.

## Auth

OAuth 2.1 + PKCE against the Supabase project’s native authorization server; `mcp/` publishes RFC 9728 protected-resource metadata pointing claude.ai at it and validates every Bearer token (RS256, `iss`/`aud`/`exp`/`sub`/`email`) via `jose`. The token is forwarded to the API verbatim — never minted, stored, or refreshed here. The one `web/` touchpoint is the `/oauth/consent` route Supabase’s flow redirects to. Full design: [`planning/mcp-server.md`](../planning/mcp-server.md).

## Registering a new OAuth client

Dynamic client registration is **off** on the Supabase side (`allow_dynamic_registration` under `[auth.oauth_server]` — a real config flag, not exposed as a dashboard toggle on hosted projects as of this writing). That means every client — claude.ai, Claude Code, Claude Desktop, anything else — needs its own manually-registered OAuth app before it can connect. Deliberate: an unauthenticated self-registration endpoint would let anyone register a client that shows up asking for approval on Ollert's own `/oauth/consent` screen, with a name/logo they control. For a handful of known, personal clients, registering each by hand is a small one-time cost against that risk.

Dashboard path (verified against [Supabase's OAuth 2.1 Server docs](https://supabase.com/docs/guides/auth/oauth-server/getting-started)):

1. **Authentication → OAuth Apps** (under "Manage") → **Add a new client**.
2. Fill in:
   - **Client name** — whatever's clear (e.g. "Claude Code", "Claude Desktop").
   - **Redirect URIs** — the exact callback URI the client uses (see below; must match exactly, no wildcards).
   - **Client type** — **Public** (PKCE, no client secret — every client here is a native/CLI app or a hosted connector, none can keep a secret safely).
3. **Create** — the **Client ID** is shown once; public clients get no secret to save.

The `client_id` itself lives only in the Supabase dashboard, never in this repo.

## Connecting claude.ai

1. In claude.ai, go to **Settings → Connectors → Add custom connector**.
2. **Server URL**: `https://ollert-mcp.2719.fyi/mcp`
3. claude.ai auto-discovers the OAuth setup from `mcp/`'s RFC 9728 metadata (`/.well-known/oauth-protected-resource/mcp`), which points at the Supabase project's own OAuth 2.1 authorization server — no separate config needed for that part.
4. Register a client per the section above, redirect URI `https://claude.ai/api/mcp/auth_callback`. Open the connector's **Advanced settings** and paste in the resulting `client_id` by hand (DCR is off, so claude.ai can't auto-register itself).
5. Complete the connector's OAuth flow — it'll redirect through Supabase's authorize endpoint, land on Ollert's `/oauth/consent` page (`web/src/routes/oauth/consent.tsx`) for you to sign in and approve, then bounce back to claude.ai with a token.
6. Sanity check it actually works: ask Claude to list your Ollert orgs (`list_orgs`) — a 401 there usually means the token's `aud` claim or the `client_id` is wrong; see [`planning/mcp-server.md`](../planning/mcp-server.md#open-risks) for known rough edges.

If the server URL ever needs to change (new domain, moved off negrita) or the OAuth app gets re-registered, this whole flow needs redoing — there's no way to update just one piece from claude.ai's side.

## Connecting Claude Code

Claude Code's remote-MCP OAuth callback is a fixed local port you choose, not a URL Supabase already knows about — so it needs its own registered client (redirect URI must match exactly, no wildcards).

1. Register a client per the section above — redirect URI `http://localhost:<PORT>/callback` (exactly that path; Claude Code ≥2.1.231 uses `localhost`, not `127.0.0.1` — older versions differ, see [Claude Code's MCP docs](https://code.claude.com/docs/en/mcp.md#redirect-uri-callback-port)). Pick a `<PORT>` not already used by anything else you run locally.
2. ```sh
   claude mcp add --transport http \
     --client-id <client_id from step 1> \
     --callback-port <PORT> \
     ollert https://ollert-mcp.2719.fyi/mcp
   ```
3. Claude Code opens the OAuth flow in your browser — same Supabase authorize → Ollert `/oauth/consent` → callback dance as claude.ai, just landing on `localhost:<PORT>` instead of claude.ai's servers.
4. Verify: ask Claude Code to list your Ollert orgs.

Verified working end-to-end 2026-08-30.

## Develop

```sh
bun install
bun run dev      # local server (needs mcp/.env — see mcp/.env.example)
bun run typecheck # tsc --noEmit
```

Test against the real API + Supabase project via `@modelcontextprotocol/inspector`, or the claude.ai connector against the deployed `ollert-mcp.2719.fyi`.