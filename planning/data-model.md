---
type: Data Model
title: Ollert Data Model
description: Entities, fields, and relationships for the MVP MySQL schema owned by CakePHP.
tags: [data-model, mysql, schema]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T18:40:58Z" }
---

# Summary

MVP entities: `users`, `organizations`, `org_members`, `boards`, `lists`, `cards`. Access control is org-scoped: a member of an org has access to every board in that org — no per-board membership or roles in v1. No labels, comments, attachments, or checklists in the MVP — see [Roadmap](roadmap.md) for what's deferred.

All primary keys (and the foreign keys that reference them) are UUIDs — MySQL `char(36)`, `cakephp/migrations` column type `uuid`. CakePHP's ORM generates the UUID automatically on save when the primary key column type is `uuid` and no value was set (`Text::uuid()` under the hood) — no extra plugin or manual `beforeSave` hook needed. `users.supabase_uid` stays a separate UUID column (the Supabase `sub` claim) from `users.id` (the local PK) — the two are unrelated identifiers pointing at the same person.

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
| created_at | datetime | |

## organizations

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | uuid, FK -> users.id | org creator, full rights |
| name | varchar | |
| created_at | datetime | |

## org_members
Join table. Owner is implicitly a member too (or: owner row also present here for uniform membership checks — pick one convention during implementation). Membership here is what grants access to *all* boards under the org.

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| org_id | uuid, FK -> organizations.id | |
| user_id | uuid, FK -> users.id | |
| created_at | datetime | when added to org |

No roles column — every member has equal edit rights per [current decision](log.md).

## boards

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| org_id | uuid, FK -> organizations.id | access derived from org_members, not a per-board list |
| title | varchar | |
| created_at | datetime | |
| updated_at | datetime | |

Only the org's `owner_id` may create a board in it (org members may still read/rename/delete per the [API contract](api-contract.md) — creation specifically is owner-gated because it's what consumes the owner's `max_boards_per_org` quota).

# Quotas

Two limits, both columns on `users`, both enforced app-side (not DB constraints) at creation time:

* **`max_orgs`** (default `1`): checked when a user creates an org — `count(organizations where owner_id = user.id) < user.max_orgs`.
* **`max_boards_per_org`** (default `3`): checked when the org's owner creates a board — `count(boards where org_id = org.id) < owner.max_boards_per_org`.

Both default low; raising them (e.g. for a paid tier) is just updating the column — no schema change. Quota-exceeded creation attempts fail; see the [API contract](api-contract.md#conventions) for the error shape.

## lists
Columns on a board (e.g. "To Do", "In Progress", "Done").

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| board_id | uuid, FK -> boards.id | |
| title | varchar | |
| position | float or int | for drag-drop ordering, see below |
| created_at | datetime | |

## cards

| field | type | notes |
|---|---|---|
| id | uuid, PK | |
| list_id | uuid, FK -> lists.id | |
| title | varchar | |
| description | text, nullable | |
| due_date | date, nullable | |
| position | float or int | for drag-drop ordering within a list |
| created_at | datetime | |
| updated_at | datetime | |

# Ordering (drag-drop)

Use a float `position` column (fractional indexing: new position = midpoint of neighbors) rather than an integer rank that requires re-numbering siblings on every reorder. Moving a card/list only touches the one row being moved.

# Deferred (not in MVP schema)

Labels, comments, attachments, checklists, activity log, per-board/per-org roles. Adding these later is additive (new tables, no MVP schema changes required) except roles, which would add a `role` column to `org_members`.
