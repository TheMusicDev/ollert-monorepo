---
type: API Contract
title: Ollert API Contract
description: REST endpoints CakePHP exposes to the React frontend, MVP scope.
tags: [api, rest, cakephp]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T00:00:00Z" }
---

# Summary

JSON REST API under `/api/`. Every route (except a health check) requires `Authorization: Bearer <supabase-jwt>`; see [Architecture](architecture.md) for verification details. No CakePHP-native login/register/logout routes — auth lifecycle is entirely on the frontend against Supabase.

# Endpoints

## Organizations
* `GET /api/orgs` - orgs the current user owns or is a member of
* `POST /api/orgs` - create an org (creator becomes owner); 422 if the creator is at their `max_orgs` quota
* `GET /api/orgs/:id` - org detail, includes its boards
* `PATCH /api/orgs/:id` - rename org (owner or member)
* `DELETE /api/orgs/:id` - owner only

## Org Members
* `GET /api/orgs/:id/members`
* `POST /api/orgs/:id/members` - add a member by email (must already have an Ollert/Supabase account); grants access to every board in the org
* `DELETE /api/orgs/:id/members/:userId` - owner only; a member may also remove themself

## Boards
* `GET /api/orgs/:id/boards` - boards in the org
* `POST /api/orgs/:id/boards` - create a board under the org; **org owner only** (403 for non-owner members), 422 if the owner is at their `max_boards_per_org` quota
* `GET /api/boards/:id` - board detail, includes lists + cards nested
* `PATCH /api/boards/:id` - rename board (any org member)
* `DELETE /api/boards/:id` - any org member (no per-board owner in v1)

## Lists
* `POST /api/boards/:id/lists` - create list
* `PATCH /api/lists/:id` - rename, or update `position` for reordering
* `DELETE /api/lists/:id`

## Cards
* `POST /api/lists/:id/cards` - create card
* `PATCH /api/cards/:id` - update title/description/due_date/position (including moving to a different `list_id`)
* `DELETE /api/cards/:id`

## Misc
* `GET /api/health` - unauthenticated liveness check

# Conventions

* All mutating endpoints return the updated/created resource as JSON.
* 401 for missing/invalid/expired JWT. 403 for a valid user acting on a board/org they're not a member of, or a non-owner attempting an owner-only action. 422 for a request that's well-formed but fails validation or a business rule (e.g. quota exceeded).
* Card/list reordering: `PATCH` accepts a `position` (float) and, for cards, optionally a new `list_id` in the same call — one request per drag-drop action, not a separate reorder endpoint.

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
