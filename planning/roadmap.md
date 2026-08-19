---
type: Roadmap
title: Ollert Roadmap
description: MVP scope, phased plan, and decisions/tradeoffs made during planning.
tags: [roadmap, mvp, decisions]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T18:40:58Z" }
---

# MVP Scope

Bare-bones: orgs, boards, lists, cards, drag-drop reorder (within and across lists), card detail (title/description/due date), org members (owner + members, no roles — membership grants access to every board in the org), per-user quotas on org/board creation (defaults: 1 org, 3 boards/org). No comments, attachments, activity log, labels, checklists, notifications, search, or realtime.

# Phases

## Phase 1 — Foundations
* CakePHP app skeleton, `cakephp/migrations` set up, migrations for [Data Model](data-model.md)
* Supabase project set up (auth only), JWKS verification middleware, CORS policy applied (see [Architecture](architecture.md))
* TanStack Start (SPA mode) skeleton — Bun, Tailwind, Base UI — Supabase JS client wired for login/signup/session

## Phase 2 — Core CRUD
* [API Contract](api-contract.md) endpoints implemented, including quota checks and the standard error envelope
* React UI: org list, board list per org, board detail, list/card CRUD, drag-drop (e.g. `@dnd-kit`)
* Org membership: add/remove members by email

## Phase 3 — Polish
* Card detail modal (description, due date)
* Basic empty/loading/error states, form validation
* PHPUnit coverage on `/api`, Vitest coverage on `/web`
* First manual deploy to the shared PHP host over SSH (scripts written then, not before — see Deferred)

# Testing Strategy

* `/api` — PHPUnit, CakePHP's standard.
* `/web` — Vitest for unit/component tests.
* **e2e** — Playwright, run against the real built frontend and a running API rather than living inside the Vitest toolchain. Not phased in until Phase 3 at the earliest; unit-level coverage comes first.

# Deferred (post-MVP)

* **Deploy scripts** — deploy target and mechanism are decided (shared PHP host, SSH, local scripts — see [Architecture](architecture.md)), but writing the scripts themselves is deferred until there's a working app to deploy. Two scripts, `/api` and `/web`, since the pipelines differ (PHP sync + migrations vs. static build sync).
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
* **Quotas**: `max_orgs` (default 1) and `max_boards_per_org` (default 3) live on `users`, enforced app-side. Board creation is org-owner-only (it's what spends the quota); other board actions remain open to any org member.
* **JIT provisioning**: confirmed as find-or-create on every authenticated request (no dedicated bootstrap endpoint).
* **CORS**: origin allow-list only, no credentials mode — auth is a Bearer token, not a cookie, so there's nothing for `Access-Control-Allow-Credentials` to protect.
* **Error shape**: standard `{ error: { message, code, fields? } }` envelope on every non-2xx response — see [API Contract](api-contract.md).
* **FE framework**: TanStack Start, run in **SPA mode** (SSR/server functions off) — no Node server to run Start's full model, and a static build output is the simplest thing that deploys cleanly to a shared PHP host. Gets Start's router/tooling without needing a server; revisit if the deploy target ever gains a Node runtime.
* **FE toolchain**: Bun (package manager/runtime), Tailwind CSS, Base UI for headless component primitives.
* **Primary keys**: UUIDs on every entity (MySQL `char(36)` / migrations `uuid` type) instead of auto-increment ints — CakePHP's ORM auto-generates them on save, no extra plugin needed. See [Data Model](data-model.md).
* **Deployment**: shared PHP host, SSH, local (non-CI) deploy scripts, split by package. Scripts themselves deferred to Phase 3.
* **Testing**: PHPUnit / Vitest (via Bun) / Playwright — see Testing Strategy above.
* **Migrations tooling**: `cakephp/migrations` plugin, confirmed.
