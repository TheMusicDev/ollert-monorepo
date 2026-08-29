---
type: Architecture
title: Supabase Migration (All-In)
description: Overhaul moving Ollert's app data from CakePHP-owned MySQL to Supabase Postgres, and adopting Supabase Storage + Realtime. Decided 2026-08-24; local-dev spine landed 2026-08-27, prod cutover pending.
tags: [supabase, migration, storage, realtime, search]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-24T00:00:00Z" }
---

# Summary

Ollert today runs CakePHP-owned MySQL for app data and uses Supabase for auth only (see [Architecture](architecture.md)). This concept records the decision to go **all-in on Supabase**: move the relational data to Supabase's hosted Postgres, and adopt Supabase Storage + Realtime alongside the existing Supabase Auth. **Decided 2026-08-24.** **2026-08-27: the spine (DB swap) landed locally** — CakePHP runs against the Supabase CLI local stack end-to-end (migrations, JWT auth, JIT provisioning, full org/board/list/card CRUD verified manually). Prod (negrita) still runs MySQL; the deploy cutover is separate, deliberately deferred, and — per user decision — nukes negrita's current setup and rebuilds rather than migrating live data (see Cutover below, which this simplifies). [Architecture](architecture.md) and [Data Model](data-model.md) have been updated to describe Postgres as the current local-dev state. Decision recorded in [Change log](log.md) 2026-08-24 (cont.) and 2026-08-27 — this reverses the 2026-08-19 "app data in CakePHP-owned MySQL, not Supabase Postgres" key decision.

# The spine: MySQL → Postgres migration

**Landed locally 2026-08-27.** The core of the overhaul was migrating the CakePHP relational schema from MySQL to Supabase's hosted Postgres:

* **Schema/types** — native Postgres `uuid` PKs (not `char(36)`). Turned out to need zero changes: the existing `cakephp/migrations` phinx files already used DB-agnostic abstract types (`uuid`, `string`, `integer`, `datetime`), so this was a pure connection/driver swap, not a schema rewrite. See [Data Model](data-model.md) for the current schema.
* **Migration files** — unchanged; `bin/cake migrations migrate` ran all 6 migrations against a fresh local Postgres with no edits needed.
* **MySQL-specific query syntax** — none found. Grepped `api/src/Controller`/`Service`/`Model` before starting; everything goes through CakePHP's query builder, no raw SQL, no MySQL-isms to port.
* **Local dev setup** — `docker/docker-compose.yml` (MariaDB 11.8 + Mailpit) is superseded by the Supabase CLI local stack (see [Local dev](#local-dev) below). Not yet deleted — see `post-merge.md`.

Prod (negrita) cutover is the only remaining piece — see Cutover below.

Auth is **unchanged**: `verifyToken.ts` + `AuthMiddleware.php` keep their current JWKS check against the same Supabase project, regardless of where the app data lives. The MCP server is unchanged for the same reason.

# What rides on the migration

Three features that were deferred or blocked become cheap once the data is in Postgres:

* **Storage → Supabase Storage** (S3-compatible, switchable provider). Closes the attachments storage question — supersedes the local-FS / self-hosted RustFS / Cloudflare R2 options. Unblocks attachments (still needs upload/scan + quotas before shipping).
* **Realtime → Supabase Realtime** (WAL-based, works once data is in Postgres). Replaces the deferred Soketi (Pusher-protocol relay) plan — no extra infra to run. Biggest single UX gap vs real Trello. See [Roadmap](roadmap.md#deferred-post-mvp).
* **Search → PostgreSQL full-text search (`tsvector`/`tsquery` + GIN or GiST indexes) for keyword search, and `pgvector` for vector storage + similarity search (semantic)**, not MySQL FULLTEXT or Algolia. Gates on the Postgres migration. Supersedes the Algolia free-tier idea.

# What stays

* **Auth** — Supabase Auth, already in use. Token verification (`verifyToken.ts`, `AuthMiddleware.php`) unchanged.
* **MCP server** — `mcp/` is a thin Resource Server validating Supabase JWTs; nothing about it depends on the app DB engine. See [MCP Server](mcp-server.md).
* **API shape** — [API Contract](api-contract.md) endpoint shapes, pagination, and error envelope are DB-agnostic. Resource field names (snake_case) stay. The contract doc gets rewritten only where a Postgres type changes a field's representation.

# Cutover concern

There is live team data on negrita today, but **resolved 2026-08-27: no data-migration plan needed.** User decided to nuke whatever is on negrita and rebuild the deploy from scratch rather than export/transform/load the existing MySQL data into Postgres. This removes the parity-validation + rollback-path work that would otherwise make this a project rather than a schema swap — the remaining deploy work is provisioning fresh negrita infra (Postgres via Supabase, updated `api/config/deploy*.yml` kamal configs, updated env) and pointing it at whichever Supabase project holds prod data, not migrating anything. Deploy is intentionally deferred until local dev is solid — see [Roadmap](roadmap.md).

# Local dev

**Resolved 2026-08-24, landed 2026-08-27:** local dev uses the **Supabase CLI local stack** (`supabase start`, `supabase/config.toml` at the repo root) — offline, fully isolated from prod, ~9 containers. Chosen over a separate dev hosted Supabase project (shared-with-prod-shape but remote, and risks pointing dev tooling at real data). The stack provides both Postgres and local Supabase Auth — auth is local too, not just the DB, so the whole stack is prod-isolated (per the original decision) rather than only the DB half.

Two things worth knowing if this stack is touched again:
- **JWKS, not the CLI's default HS256.** `supabase/signing_keys.json` (gitignored) holds an RS256 keypair generated via `supabase gen signing-key --algorithm RS256`, wired in via `config.toml`'s `signing_keys_path`. Without this, local GoTrue signs tokens with a static HS256 secret and there's no JWKS endpoint — `verifyToken.ts`/`AuthMiddleware.php` would need a second code path just for local dev. With it, local tokens are `iss: http://127.0.0.1:54321/auth/v1`, `aud: authenticated`, verified against `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json` — same code path as prod, just a different JWKS URL in `.env`.
- **Supabase's own migration runner is off** (`[db.migrations] enabled = false` in `config.toml`). CakePHP's phinx migrations (`bin/cake migrations migrate`, `Cake\Database\Driver\Postgres`) are the sole schema authority — no `supabase/migrations` folder, no dual migration system.

The retired `docker/` MariaDB + Mailpit compose is superseded but not yet deleted from the repo. See [Architecture § Local Development](architecture.md#local-development).