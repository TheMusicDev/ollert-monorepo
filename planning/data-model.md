---
type: Data Model
title: Ollert Data Model
description: Entities, fields, and relationships for the MVP MySQL schema owned by CakePHP.
tags: [data-model, mysql, schema]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T19:50:29Z" }
---

# Summary

MVP entities: `users`, `organizations`, `org_members`, `boards`, `lists`, `cards`. Access control is org-scoped: a member of an org has access to every board in that org — no per-board membership or roles in v1. No labels, comments, attachments, or checklists in the MVP — see [Roadmap](roadmap.md) for what's deferred.

All primary keys (and the foreign keys that reference them) are UUIDs — MySQL `char(36)`, `cakephp/migrations` column type `uuid`. CakePHP's ORM generates the UUID automatically on save when the primary key column type is `uuid` and no value was set (`Text::uuid()` under the hood) — no extra plugin or manual `beforeSave` hook needed. `users.supabase_uid` stays a separate UUID column (the Supabase `sub` claim) from `users.id` (the local PK) — the two are unrelated identifiers pointing at the same person.

> **Planned move (decided 2026-08-24, not started):** this MySQL schema is being relocated to Supabase hosted Postgres as part of the all-in-Supabase overhaul (UUIDs port cleanly; MySQL-specific types/indexes get Postgres equivalents). The schema below keeps describing MySQL until the migration branch executes the swap — see [Supabase Migration](supabase-migration.md) and [log.md](log.md) 2026-08-24 (cont.). The `is_admin` column and the per-user quota-override mechanism added 2026-08-24 survive the move unchanged (same column shape).

## Field constraints

All `name`/`title` fields (`organizations.name`, `boards.title`, `lists.title`, `cards.title`) are `varchar(255)`, required, no uniqueness constraint — two boards named "Sprint" is fine, this isn't a namespace. `cards.description` is `text`, nullable, unbounded. `users.email`/`display_name` follow the same `varchar(255)` sizing.

## Timestamps and soft delete

Every table gets `created`, `modified`, `deleted` — CakePHP's `TimestampBehavior` conventionally auto-manages `created`/`modified` (no `_at` suffix), so column names follow that rather than the `created_at`/`updated_at` used earlier in this doc's draft. `deleted` (`datetime`, nullable) is a soft-delete marker managed by the **Muffin/Trash** plugin (`muffin/trash`) — its `TrashBehavior` defaults to a `deleted` column, sets it instead of issuing a real `DELETE`, and scopes finders to exclude trashed rows by default. All `DELETE` endpoints in the [API contract](api-contract.md) become soft deletes; nothing in the MVP hard-deletes a row. These three columns are omitted from the per-table field lists below to avoid repeating them six times — assume every table has `id, ...fields..., created, modified, deleted`.

# Schema

## users
Local shadow of the Supabase-authenticated identity. Created just-in-time on first request from a new `sub`.

| field | type | notes |
|---|---|---|
| id | uuid, PK | local identity |
| supabase_uid | char(36), unique | Supabase `sub` claim (UUID) |
| email | varchar | denormalized from JWT claim at provisioning time, refreshed opportunistically |
| display_name | varchar, nullable | |
| max_orgs | int, default 1 | quota: orgs this user may own (see Quotas below) |
| max_boards_per_org | int, default 3 | quota: boards allowed in an org this user owns |
| max_lists_per_board | int, default 5 | quota: lists allowed in a board this user owns (via org ownership) |
| max_cards_per_board | int, default 100 | quota: cards allowed across all lists in a board this user owns |
| is_admin | boolean, default false | admin flag (added 2026-08-24 for the admin feature, #20). Not stored in the JWT — the API resolves the `users` row from the JWT `sub` per request and checks this column, so promote/demote takes effect on the next request (a JWT-embedded flag would be stale for the token's lifetime). First admin bootstrapped via env `ADMIN_UUID`. Admin mutates the four quota columns above on a per-user basis — see Quotas below. |

## organizations

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid, FK -> users.id | org creator, full rights |
| name | varchar | |

## org_members
Join table. The owner is always implicitly a member (`App\Service\OrgAuthorizationService::isOrgMember()` treats `organizations.owner_id` as membership directly), whether or not an explicit owner row also exists in this table — `feat/api-organizations` may insert one on org creation for uniform listing/removal UX, but authorization checks don't depend on it either way (see [log.md](log.md)). Membership here is what grants access to *all* boards under the org.

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| org_id | uuid, FK -> organizations.id | |
| user_id | uuid, FK -> users.id | |

No roles column — every member has equal edit rights per [current decision](log.md).

## boards

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| org_id | uuid, FK -> organizations.id | access derived from org_members, not a per-board list |
| title | varchar | |

Only the org's `owner_id` may create a board in it (org members may still read/rename/delete per the [API contract](api-contract.md) — creation specifically is owner-gated because it's what consumes the owner's `max_boards_per_org` quota).

# Quotas

Four limits, all columns on `users`, all enforced app-side (not DB constraints) at creation time:

* **`max_orgs`** (default `1`): checked when a user creates an org — `count(organizations where owner_id = user.id) < user.max_orgs`.
* **`max_boards_per_org`** (default `3`): checked when the org's owner creates a board — `count(boards where org_id = org.id) < owner.max_boards_per_org`.
* **`max_lists_per_board`** (default `5`): checked when any org member creates a list — `count(lists where board_id = board.id) < board.org.owner.max_lists_per_board`. Checked against the *org owner's* column regardless of who's creating the list, same pattern as board creation.
* **`max_cards_per_board`** (default `100`): checked when any org member creates a card — `count(cards joined lists where lists.board_id = board.id) < board.org.owner.max_cards_per_board`. Counted across the whole board (all its lists), not per-list.

All four default low and stay as the floor — **no global raise, ever** (decided 2026-08-24). Per-user overrides via the admin feature (#20, `is_admin` on `users`) are the only mechanism to raise a limit for a specific user; the admin mutates the four columns above per row. Quota-exceeded creation attempts fail; see the [API contract](api-contract.md#conventions) for the error shape.

## lists
Columns on a board (e.g. "To Do", "In Progress", "Done").

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| board_id | uuid, FK -> boards.id | |
| title | varchar | |
| position | float or int | for drag-drop ordering, see below |

## cards

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| list_id | uuid, FK -> lists.id | |
| title | varchar | |
| description | text, nullable | |
| due_date | date, nullable | |
| position | float or int | for drag-drop ordering within a list |

# Ordering (drag-drop)

Use a float `position` column (fractional indexing: new position = midpoint of neighbors) rather than an integer rank that requires re-numbering siblings on every reorder. Moving a card/list only touches the one row being moved. The first card/list in an otherwise-empty list/board has no neighbors to midpoint against — bootstrap it to `1.0`; every insert after that has at least one neighbor.

# Deferred (not in MVP schema)

Labels, comments, attachments, checklists, activity log, per-board/per-org roles. Adding these later is additive (new tables, no MVP schema changes required) except roles, which would add a `role` column to `org_members`.
