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

## Connecting claude.ai

1. In claude.ai, go to **Settings → Connectors → Add custom connector**.
2. **Server URL**: `https://ollert-mcp.2719.fyi/mcp`
3. claude.ai auto-discovers the OAuth setup from `mcp/`'s RFC 9728 metadata (`/.well-known/oauth-protected-resource/mcp`), which points at the Supabase project's own OAuth 2.1 authorization server — no separate config needed for that part.
4. Dynamic client registration is **off** on the Supabase side, so claude.ai won't auto-register itself. Open the connector's **Advanced settings** and paste in the pre-registered `client_id` by hand.
   - The `client_id` value itself lives only in the Supabase dashboard (**Authentication → OAuth Apps**, or wherever that project's registered OAuth apps are listed) — it's dashboard state, not anything checked into this repo. If you don't have it, look it up there; it's registered as a **public client** (PKCE-only, no client secret) with redirect URI `https://claude.ai/api/mcp/auth_callback`.
5. Complete the connector's OAuth flow — it'll redirect through Supabase's authorize endpoint, land on Ollert's `/oauth/consent` page (`web/src/routes/oauth/consent.tsx`) for you to sign in and approve, then bounce back to claude.ai with a token.
6. Sanity check it actually works: ask Claude to list your Ollert orgs (`list_orgs`) — a 401 there usually means the token's `aud` claim or the `client_id` is wrong; see [`planning/mcp-server.md`](../planning/mcp-server.md#open-risks) for known rough edges.

If the server URL ever needs to change (new domain, moved off negrita) or the OAuth app gets re-registered, this whole flow needs redoing — there's no way to update just one piece from claude.ai's side.

## Develop

```sh
bun install
bun run dev      # local server (needs mcp/.env — see mcp/.env.example)
bun run typecheck # tsc --noEmit
```

Test against the real API + Supabase project via `@modelcontextprotocol/inspector`, or the claude.ai connector against the deployed `ollert-mcp.2719.fyi`.