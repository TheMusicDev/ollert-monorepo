---
type: API Contract
title: Ollert API Contract
description: REST endpoints CakePHP exposes to the React frontend, MVP scope.
tags: [api, rest, cakephp]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T19:50:29Z" }
---

# Summary

JSON REST API under `/api/`. Every route (except a health check) requires `Authorization: Bearer <supabase-jwt>`; see [Architecture](architecture.md) for verification details. No CakePHP-native login/register/logout routes — auth lifecycle is entirely on the frontend against Supabase.

# Endpoints

## Organizations
* `GET /api/orgs` - orgs the current user owns or is a member of, paginated
* `POST /api/orgs` - create an org (creator becomes owner); 422 if the creator is at their `max_orgs` quota
* `GET /api/orgs/:id` - org detail, includes its boards
* `PATCH /api/orgs/:id` - rename org (owner or member)
* `DELETE /api/orgs/:id` - owner only; soft delete (see [Data Model](data-model.md))

Org resource shape adds one server-computed field beyond the raw `organizations` row: `is_owner` (boolean) — `true` when `owner_id` equals the requesting user's local `users.id`, `false` otherwise. The frontend only ever holds the Supabase identity (`session.user.id`), never the local id behind `owner_id`, and there's no `/me` endpoint — so without this field the FE has no way to know "am I this org's owner" client-side. Computed per-request/per-row (not stored) by the org-membership helper's `isOrgOwner($userId, $orgId)` (`App\Service\OrgAuthorizationService`, see `feat/api-shared-helpers`); `GET /api/orgs` and `GET /api/orgs/:id` (`feat/api-organizations`) are responsible for actually setting it on each returned resource. Resolves the open item in [log.md](log.md).

## Org Members
* `GET /api/orgs/:id/members` - paginated
* `POST /api/orgs/:id/members` - add a member by email (must already have an Ollert/Supabase account); grants access to every board in the org
* `DELETE /api/orgs/:id/members/:userId` - owner only; a member may also remove themself

## Boards
* `GET /api/orgs/:id/boards` - boards in the org, paginated
* `POST /api/orgs/:id/boards` - create a board under the org; **org owner only** (403 for non-owner members), 422 if the owner is at their `max_boards_per_org` quota
* `GET /api/boards/:id` - board detail, includes lists + cards nested, **not paginated** (see Pagination below)
* `PATCH /api/boards/:id` - rename board (any org member)
* `DELETE /api/boards/:id` - any org member (no per-board owner in v1); soft delete (see [Data Model](data-model.md))

## Lists
* `GET /api/boards/:id/lists` - lists in the board, paginated (any org member), ordered by `position` ASC
* `POST /api/boards/:id/lists` - create list; 422 if the board owner is at their `max_lists_per_board` quota
* `GET /api/lists/:id` - list detail, includes its cards nested, **not paginated** (same exception as `GET /api/boards/:id` — a list view needs all its cards to render the column), ordered by `position` ASC
* `PATCH /api/lists/:id` - rename, or update `position` for reordering
* `DELETE /api/lists/:id` - soft delete (see [Data Model](data-model.md))

## Cards
* `GET /api/lists/:id/cards` - cards in the list, paginated (any org member), ordered by `position` ASC
* `POST /api/lists/:id/cards` - create card; 422 if the board owner is at their `max_cards_per_board` quota
* `GET /api/cards/:id` - card detail (any org member)
* `PATCH /api/cards/:id` - update title/description/due_date/position (including moving to a different `list_id`)
* `DELETE /api/cards/:id` - soft delete (see [Data Model](data-model.md))

## Misc
* `GET /api/health` - unauthenticated liveness check

## Admin

Admin endpoints (feature #20, moved up 2026-08-24). Gated: the caller's resolved `users.is_admin` must be `true`, else 403 (`code: "not_admin"`). The auth middleware already resolves the local `users` row from the JWT `sub` (JIT provisioning — see [Architecture](architecture.md#auth-flow)), so admin authorization is a per-request check of that row's `is_admin` column — `is_admin` is **not** stored in the JWT. A JWT-embedded flag would be stale for the token's lifetime; promote/demote wouldn't take effect until reissue, whereas per-request lookup gives immediate revocation. Bootstrap: during JIT provisioning, if the incoming `sub` matches the `ADMIN_UUID` env var, the find-or-create sets `is_admin=true` on that row — so the very first request from the bootstrap admin provisions them admin, before any admin check runs. The implementing branch should add an integration test for the first request from an unprovisioned `ADMIN_UUID`. Subsequent admins promoted through the UI. See [Data Model](data-model.md#users) and [log.md](log.md).

* `GET /api/admin/users` - list all users, paginated (same `?page=`/`?limit=` shape, `{ data, meta }` envelope — see Pagination below). Returns each user's `id`, `email`, `display_name`, the four quota columns, and `is_admin`.
* `PATCH /api/admin/users/:id` - set per-user quota overrides (`max_orgs`/`max_boards_per_org`/`max_lists_per_board`/`max_cards_per_board`) and `is_admin` (promote/demote other admins). Overrides are the only mechanism to raise a limit above the floor — no global raise (see [Data Model](data-model.md#quotas)). Partial PATCH: only sent fields update.

Pagination of the user list is settled — same `?page=`/`?limit=` shape with `{ data, meta }` envelope (see Pagination below).

# Conventions

* All mutating endpoints return the updated/created resource as JSON.
* 401 for missing/invalid/expired JWT. 403 for a valid user acting on a board/org they're not a member of, or a non-owner attempting an owner-only action. 404 (same envelope, `code: "not_found"`) for a nonexistent or soft-deleted resource. 422 for a request that's well-formed but fails validation or a business rule (e.g. quota exceeded).
* Card/list reordering: `PATCH` accepts a `position` (float) and, for cards, optionally a new `list_id` in the same call — one request per drag-drop action, not a separate reorder endpoint.

## Pagination

Per-user quotas (`max_orgs`, `max_boards_per_org`, `max_lists_per_board`, `max_cards_per_board`) are configurable per user, not a fixed ceiling for everyone — a raised quota means a collection endpoint's result set isn't reliably small, so every top-level collection endpoint is paginated:

* Query params: `?page=` (default `1`) and `?limit=` (default `20`, clamped silently to a max of `100` — no error on an out-of-range value, just clamp).
* Response shape:
  ```json
  {
    "data": [ /* ...resources... */ ],
    "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
  }
  ```
* **Exception**: `GET /api/boards/:id` returns its lists and cards nested and unpaginated, and `GET /api/lists/:id` returns its cards nested and unpaginated. A kanban board has to render (and support drag-drop across) its full set of lists/cards at once, and a list view needs all its cards to render the column — paginating the nested arrays would mean a card could get dropped onto a list the client hasn't loaded yet. `max_lists_per_board`/`max_cards_per_board` bound these payloads' worst case instead.

## Error response shape

Every non-2xx JSON response (except a bare 401 with no body) uses the same envelope:

```json
{
  "error": {
    "message": "Human-readable summary",
    "code": "quota_exceeded",
    "fields": {
      "title": ["Title is required"]
    }
  }
}
```

* `message` — always present, safe to show/log.
* `code` — short machine-readable slug (e.g. `quota_exceeded`, `not_org_member`, `validation_failed`) the frontend can branch on without string-matching `message`.
* `fields` — present only for 422s from form validation; maps field name to a list of error strings, matching CakePHP's validation error shape closely enough to pass through with minimal reshaping.
