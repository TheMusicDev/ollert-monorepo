---
type: Roadmap
title: Ollert Roadmap
description: MVP scope, phased plan, and decisions/tradeoffs made during planning.
tags: [roadmap, mvp, decisions]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19" }
---

# MVP Scope

Bare-bones: orgs, boards, lists, cards, drag-drop reorder (within and across lists), card detail (title/description/due date), org members (owner + members, no roles — membership grants access to every board in the org). No comments, attachments, activity log, labels, checklists, notifications, search, or realtime.

# Phases

## Phase 1 — Foundations
* CakePHP app skeleton, MySQL migrations for [Data Model](data-model.md)
* Supabase project set up (auth only), JWKS verification middleware
* Vite+React skeleton, Supabase JS client wired for login/signup/session

## Phase 2 — Core CRUD
* [API Contract](api-contract.md) endpoints implemented
* React UI: org list, board list per org, board detail, list/card CRUD, drag-drop (e.g. `@dnd-kit`)
* Org membership: add/remove members by email

## Phase 3 — Polish
* Card detail modal (description, due date)
* Basic empty/loading/error states, form validation
* Deployment target decided and set up

# Deferred (post-MVP)

* **Realtime sync** — deferred at planning time because app data lives in CakePHP-owned MySQL, not Supabase's Postgres, so Supabase Realtime (which watches Postgres replication) doesn't apply directly. When picked back up, use a self-hosted Pusher-protocol service (Soketi) that CakePHP broadcasts to on writes, with the React app subscribing via `pusher-js`. SSE was considered and rejected as a poor fit for a typical PHP-FPM request lifecycle.
* Labels, comments, attachments, checklists, activity log
* Per-org roles (owner/member/viewer) — would add a `role` column to `org_members`
* Per-board access scoping (currently all-or-nothing at the org level)
* Social login providers
* Search

# Key Decisions Log

Full deliberation lives in [log.md](log.md); summarized here:

* **DB**: MySQL owned by CakePHP, not Supabase Postgres — keeps Supabase strictly to identity, avoids coupling app schema to a Supabase project.
* **JWT verification**: JWKS/RS256 preferred over a shared HS256 secret — no long-lived shared secret to rotate. Fallback to HS256 documented in [Architecture](architecture.md) if the Supabase project turns out to be on the legacy secret.
* **Repo**: monorepo (`/api`, `/web`, `/planning`).
* **Realtime**: explicitly dropped from MVP after the DB choice made "just use Supabase Realtime" not viable — see Deferred above.
* **Access model**: switched from per-board membership to orgs — an org has many boards, and org membership grants access to all of that org's boards (no per-board membership/roles in v1).
