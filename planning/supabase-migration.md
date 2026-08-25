---
type: Architecture
title: Supabase Migration (All-In)
description: Planned overhaul moving Ollert's app data from CakePHP-owned MySQL to Supabase Postgres, and adopting Supabase Storage + Realtime. Decided 2026-08-24, not yet started.
tags: [supabase, migration, storage, realtime, search]
status: draft
generated: { by: "claude-code/sonnet-5", at: "2026-08-24T00:00:00Z" }
---

# Summary

Ollert today runs CakePHP-owned MySQL for app data and uses Supabase for auth only (see [Architecture](architecture.md)). This concept records the decision to go **all-in on Supabase**: move the relational data to Supabase's hosted Postgres, and adopt Supabase Storage + Realtime alongside the existing Supabase Auth. **Decided 2026-08-24, not yet started** — the app still runs MySQL on negrita. The current-state docs ([Architecture](architecture.md), [Data Model](data-model.md)) keep describing MySQL until the migration branch executes the swap, then get rewritten. Same pattern as [MCP Server](mcp-server.md) being written pre-build then updated post-build. Decision recorded in [Change log](log.md) 2026-08-24 (cont.) — this reverses the 2026-08-19 "app data in CakePHP-owned MySQL, not Supabase Postgres" key decision.

# The spine: MySQL → Postgres migration

The core of the overhaul is migrating the CakePHP relational schema from MySQL to Supabase's hosted Postgres. Touches:

* **Schema/types** — `char(36)` UUID PKs port cleanly; the MySQL-specific column types and defaults need Postgres equivalents. See [Data Model](data-model.md) for the current schema.
* **Migration files** — the existing `cakephp/migrations` phinx files are MySQL-flavored; the migration branch rewrites them (or layers a Postgres-targeted set) against the Postgres connection.
* **MySQL-specific query syntax** — any raw SQL or query-builder fragments using MySQL-isms (backtick quoting, `AUTO_INCREMENT` leftovers, `FULLTEXT` indexes, `LIMIT`/`ON DUPLICATE KEY` shapes) become Postgres equivalents.
* **Local dev setup** — `docker/docker-compose.yml` (MariaDB 11.8 + Mailpit) is replaced by the Supabase CLI local stack (see [Local dev](#local-dev) below).

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

There is **live team data on negrita**, not greenfield. The migration branch needs a real data-migration + cutover plan: export MySQL → transform → load Postgres, validate parity, then cut the API over with a rollback path. This is the part that makes it a project, not a schema swap.

# Local dev

**Resolved 2026-08-24:** local dev after the migration uses the **Supabase CLI local stack** (`supabase start`) — offline, fully isolated from prod, heaviest local infra (~6 containers). Chosen over a separate dev hosted Supabase project (shared-with-prod-shape but remote, and risks pointing dev tooling at real data). The current `docker/` MariaDB + Mailpit compose is retired once the migration lands. See [Architecture § Local Development](architecture.md#local-development).