---
type: Roadmap
title: Ollert Roadmap
description: MVP scope, phased plan, and decisions/tradeoffs made during planning.
tags: [roadmap, mvp, decisions]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-19T19:50:29Z" }
---

# MVP Scope

Bare-bones: orgs, boards, lists, cards, drag-drop reorder (within and across lists), card detail (title/description/due date), org members (owner + members, no roles — membership grants access to every board in the org), per-user quotas on org/board creation (defaults: 1 org, 3 boards/org). No comments, attachments, activity log, labels, checklists, notifications, search, or realtime.

# Phases

## Phase 1 — Foundations
* CakePHP app skeleton, `cakephp/migrations` set up, `muffin/trash` installed, migrations for [Data Model](data-model.md) (including `created`/`modified`/`deleted` on every table)
* Supabase project set up (auth only), JWKS verification middleware, CORS policy applied (see [Architecture](architecture.md))
* TanStack Start (SPA mode) skeleton — Bun, Tailwind (wired with the [Design](design.md) palette/tokens), Base UI — Supabase JS client wired for login/signup/session, `/auth/callback` route
* `docker/` Compose stack (MariaDB + Mailpit) running for local dev — see [Architecture](architecture.md#local-development)

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

* `/api` — PHPUnit, CakePHP's standard, using CakePHP's built-in fixture system for test data.
* `/web` — Vitest for unit/component tests, ad hoc in-memory data/mocks (no fixture system needed at this scale).
* **e2e** — Playwright, run against the real built frontend and a running API rather than living inside the Vitest toolchain. Test data seeded through the real API (a Playwright global-setup script), not direct DB inserts — exercises the same code path real users hit. Not phased in until Phase 3 at the earliest; unit-level coverage comes first.
* **CI**: three parallel GitHub Actions workflows gate every PR against `main` — PHPUnit (`/api`), Vitest/ESLint/tsc (`/web`), and an AI review (`the-pr-agent/pr-agent`, self-hosted against OpenRouter's free tier). Not part of the original MVP plan (deploy is still manual/SSH, not CI-driven — see Deployment) but added once PRs started needing review with no other reviewer available. See root `README.md#ci` and `PR_AGENT_SETUP.md`.

# Deferred (post-MVP)

* **Deploy scripts** — deploy target and mechanism are decided (shared PHP host, SSH, local scripts — see [Architecture](architecture.md)), but writing the scripts themselves is deferred until there's a working app to deploy. Two scripts, `/api` and `/web`, since the pipelines differ (PHP sync + migrations vs. static build sync).
* **Realtime sync** — **DECIDED 2026-08-24 (supersedes the Soketi plan below): Supabase Realtime**, WAL-based, works once the app data is in Supabase Postgres (the [all-in migration](supabase-migration.md)). No extra infra to run. Biggest single UX gap vs real Trello, and now the cheapest it's ever been. ~~Originally deferred because app data lived in CakePHP-owned MySQL, so Supabase Realtime (which watches Postgres replication) didn't apply; the fallback plan was a self-hosted Pusher-protocol service (Soketi) with CakePHP broadcasting on writes and the React app subscribing via `pusher-js`.~~ Superseded.
* **Attachments** — file upload per card. Storage backend **DECIDED 2026-08-24: Supabase Storage** (S3-compatible) — unblocks this; still needs upload/scan + quotas before shipping. Gates on the [all-in migration](supabase-migration.md).
* **Search** — across boards/cards. **DECIDED 2026-08-24: PostgreSQL full-text search (`tsvector`/`tsquery` + GIN or GiST indexes) for keyword search, and `pgvector` for vector storage + similarity search (semantic)**, not MySQL FULLTEXT or Algolia. Gates on the [all-in migration](supabase-migration.md).
* Labels, comments, checklists, activity log
* Per-org roles (owner/member/viewer) — would add a `role` column to `org_members`
* Per-board access scoping (currently all-or-nothing at the org level)
* **Social login providers** — **DECIDED 2026-08-24: Google + Apple only** (not GitHub). Deferred — no provider credentials yet; Supabase handles the wiring once obtained.

# Key Decisions Log

Full deliberation lives in [log.md](log.md); summarized here:

* **DB**: MySQL owned by CakePHP, not Supabase Postgres — keeps Supabase strictly to identity, avoids coupling app schema to a Supabase project. ~~**SUPERSEDED 2026-08-24**~~ by the all-in-Supabase decision below — kept here as the historical record; the app still runs MySQL today, the swap happens when the migration branch executes.
* **JWT verification**: JWKS/RS256 preferred over a shared HS256 secret — no long-lived shared secret to rotate. Fallback to HS256 documented in [Architecture](architecture.md) if the Supabase project turns out to be on the legacy secret.
* **Repo**: monorepo (`/api`, `/web`, `/planning`).
* **Realtime**: explicitly dropped from MVP after the DB choice made "just use Supabase Realtime" not viable — see Deferred above. ~~**SUPERSEDED 2026-08-24**: Supabase Realtime now the plan, gated on the all-in-Supabase migration.~~
* **Access model**: switched from per-board membership to orgs — an org has many boards, and org membership grants access to all of that org's boards (no per-board membership/roles in v1).
* **Quotas**: `max_orgs` (default 1) and `max_boards_per_org` (default 3) live on `users`, enforced app-side. Board creation is org-owner-only (it's what spends the quota); other board actions remain open to any org member.
* **JIT provisioning**: confirmed as find-or-create on every authenticated request (no dedicated bootstrap endpoint).
* **CORS**: origin allow-list only, no credentials mode — auth is a Bearer token, not a cookie, so there's nothing for `Access-Control-Allow-Credentials` to protect.
* **Error shape**: standard `{ error: { message, code, fields? } }` envelope on every non-2xx response — see [API Contract](api-contract.md).
* **FE framework**: TanStack Start, run in **SPA mode** (SSR/server functions off) — no Node server to run Start's full model, and a static build output is the simplest thing that deploys cleanly to a shared PHP host. Gets Start's router/tooling without needing a server; revisit if the deploy target ever gains a Node runtime.
* **FE toolchain**: Bun (package manager/runtime), Tailwind CSS, Base UI for headless component primitives.
* **Primary keys**: UUIDs on every entity (MySQL `char(36)` / migrations `uuid` type) instead of auto-increment ints — CakePHP's ORM auto-generates them on save, no extra plugin needed. See [Data Model](data-model.md).
* **Timestamps/soft delete**: every table gets `created`/`modified` (core `TimestampBehavior`) and `deleted` (soft delete via `muffin/trash`). All `DELETE` endpoints are soft deletes.
* **List/card quotas**: `max_lists_per_board` (default 5) and `max_cards_per_board` (default 100) added to `users`, same app-side-enforced-against-org-owner pattern as `max_orgs`/`max_boards_per_org`.
* **Deployment**: shared PHP host, SSH, local (non-CI) deploy scripts, split by package. Scripts themselves deferred to Phase 3.
* **Testing**: PHPUnit / Vitest (via Bun) / Playwright — see Testing Strategy above. No CI for the MVP.
* **Migrations tooling**: `cakephp/migrations` plugin, confirmed.
* **PHP/Bun version pins**: PHP 8.5 for `/api` (composer.json floor, confirm the deploy host supports it before Phase 3); Bun v1.3.14 for `/web`, pinned via `package.json`'s `packageManager` field once scaffolded.
* **Pagination**: every top-level collection endpoint (`GET /api/orgs`, org members, org boards) paginated (`page`/`limit` query params, `{ data, meta }` envelope) — quotas are per-user now, not a fixed ceiling, so result sets aren't reliably small. Exception: `GET /api/boards/:id`'s nested lists/cards stay unpaginated, since a kanban board needs its full state to render and support drag-drop. See [API Contract](api-contract.md#pagination).
* **404 handling / field constraints / empty-position bootstrap**: 404s use the standard error envelope (`code: "not_found"`); `name`/`title` fields are `varchar(255)`, required, no uniqueness constraint; first item in an empty list/board bootstraps `position` to `1.0`. See [API Contract](api-contract.md) and [Data Model](data-model.md).
* **FE 401 / auth redirects**: a 401 from the API is treated as unrecoverable (Supabase's client already auto-refreshes ahead of expiry) — clear session, redirect to login, no retry-after-refresh. An `/auth/callback` FE route receives Supabase's password-reset/email-confirm redirects.
* **Local dev DB**: Docker Compose (`docker/`) running MariaDB + Mailpit, rather than a locally-installed MySQL. See [Architecture](architecture.md#local-development).
* **Design starting point**: color palette, typography (Inter), and layout pattern (sidebar/navbar/cards/tables) extracted from `windmill-dashboard-react` / `windmill-react-ui` (MIT) — not their component library, which is unmaintained and would conflict with Base UI. See [Design](design.md).
* **All-in Supabase (2026-08-24, reverses the DB decision above)**: app data moves from CakePHP-owned MySQL to Supabase Postgres, with Storage + Realtime adopted alongside the existing Auth. Major overhaul, decided not started — see [Supabase Migration](supabase-migration.md). Auth and the [MCP server](mcp-server.md) unchanged. Local dev post-migration = Supabase CLI local stack.
* **Admin (#20, moved up 2026-08-24)**: add `is_admin` to the existing `users` table; admin mutates the per-user quota columns (no new table). Admin UI is a route in `web/`, not a separate app. `is_admin` is not stored in the JWT — the API queries `users.is_admin` per admin request, so promote/demote takes effect on the next request (a JWT-embedded flag would be stale for the token's lifetime). First admin bootstrapped via env `ADMIN_UUID`. Minimal version ships now on MySQL `users` (identical column shape survives the migration). Admin contract settled — `PATCH /api/admin/users/:id` patches the four quota fields + `is_admin`, partial PATCH ok, pagination same `?page=`/`?limit=` shape (see [API Contract](api-contract.md#admin)).
* **Storage (2026-08-24)**: Supabase Storage (S3-compatible, switchable provider) for attachments and anything file-ish — closes the storage question. See [Supabase Migration](supabase-migration.md).
* **Quotas (2026-08-24)**: no global raise, ever. The four defaults (`max_orgs=1`, `max_boards_per_org=3`, `max_lists_per_board=5`, `max_cards_per_board=100`) stay as the floor; per-user overrides via the admin feature is the only mechanism to raise a limit.
* **Social login (2026-08-24)**: Google + Apple only (not GitHub). Deferred — no provider credentials yet.

# Near-term work (not started)

Decided but not yet started; not part of the all-in-Supabase migration:

* **Admin feature** (#20) — the moved-up admin feature above. Minimal version on MySQL `users` first.
* **MCP follow-ons** — ✅ done (2026-08-26, PR #33): read-gap tools (`list_lists`, `list_cards`, `get_card`, `get_list`), `mcp/README.md`, concrete version pins, tool annotations (`readOnlyHint`/`destructiveHint`/`idempotentHint`) all shipped. See [MCP Server](mcp-server.md).
* **FE cleanups** — ✅ done (2026-08-26, `feat/web-cleanups-testing-gaps`): `web/src/test/setup.ts` global `afterEach(cleanup)` was already in place (the roadmap's `globals: false` note was stale); `key={orgId}` landed on the two org-scoped routes, killing the cross-org state-leak class the three per-branch `prevOrgId`/`orgIdForPage` guards patched (guards deleted as dead — see `CLAUDE.md` Learnings 2026-08-21).
* **Testing gaps** — ✅ done (2026-08-26, `feat/web-cleanups-testing-gaps`): `mcp/src/auth/verifyToken.test.ts` (the MCP verifier, not a web FE file — the FE delegates to the Supabase SDK per [Architecture](architecture.md#auth-flow) and never decodes the JWT) covers forged/bad-sig/expired/wrong-iss/wrong-aud/missing-sub/missing-email → `OAuthError(InvalidToken)`, plus a bidirectional drift guard vs `AuthMiddleware.php` that asserts both sides enforce the canonical `{iss,aud,exp,sub,email}` set with no extras. e2e (Playwright) still not wired.
