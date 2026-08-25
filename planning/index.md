---
okf_version: "0.2"
---

# Ollert Planning Bundle

Stripped-down Trello clone. CakePHP backend, Supabase Auth for user management, Vite+React frontend. Frontend owns the auth session and sends Supabase JWTs to the backend on every request.

# Overview

* [Architecture](architecture.md) - system shape, repo layout, tech stack, auth flow
* [Data Model](data-model.md) - entities, fields, relationships
* [API Contract](api-contract.md) - REST endpoints CakePHP exposes to the frontend
* [Design](design.md) - color palette, typography, layout pattern for the FE
* [Roadmap](roadmap.md) - MVP scope, phases, and deferred work
* [MCP Server](mcp-server.md) - Node/TS MCP server design for claude.ai custom connector access
* [Supabase Migration](supabase-migration.md) - planned overhaul moving app data from MySQL to Supabase Postgres + Storage + Realtime (decided, not started)

# History

* [Change log](log.md)
