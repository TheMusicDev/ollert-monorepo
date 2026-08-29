# Post-merge: Supabase migration follow-ups

Loose ends from the `feat/supabase-migration` branch (MySQL → Supabase Postgres spine, local-dev only). Local dev works end-to-end; everything below is what's left once that branch merges. Not scoped: Storage/Realtime/Search (separate future work, see `planning/supabase-migration.md`), admin (#20), Playwright e2e — those are pre-existing roadmap items, unrelated to this branch.

## docker/ cleanup

- [ ] Delete `docker/docker-compose.yml`, `docker/.env.example`, `docker/data/` (gitignored, but confirm nothing references it) — fully superseded by the Supabase CLI local stack (`supabase start`).
- [ ] Remove `docker/` mentions from `README.md` (line ~14, ~20 — currently says `docker compose up -d` as the local-dev DB step).
- [ ] Grep the repo for any other `docker compose`/`MariaDB`/`9937` references outside `DEPLOYMENT.md`/`KAMAL_DEPLOYMENT.md` (those two get rewritten separately, below) and fix or remove.

## .env.example templates (not updated this branch — only the real `.env` files were)

- [ ] `api/.env.example`: `DATABASE_URL` still shows the `docker/` MariaDB DSN; `SUPABASE_JWKS_URL`/`SUPABASE_JWT_ISS` still show the hosted-project placeholder. Update to describe the local Supabase CLI stack values (or document both local-CLI and hosted-prod shapes).
- [ ] `web/.env.example`: `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` same issue.
- [ ] `mcp/.env.example` + `mcp/.env`: still point at the hosted prod Supabase project (`mlowpaysruhaxowhsuva`) — MCP wasn't touched this branch. Decide: does local MCP dev move to the local stack too (consistent with api/web), or stay pointed at hosted (simpler, but then a token minted by local Auth won't verify against MCP's JWKS)? Currently inconsistent.

## New-dev setup instructions

- [ ] `README.md` / `CLAUDE.md`: document the local Supabase CLI bootstrap steps — `brew install supabase/tap/supabase`, `supabase start`, generate an RS256 signing key (`supabase gen signing-key --algorithm RS256`, first line only, wrapped in a JSON array, saved to `supabase/signing_keys.json`, gitignored — see `CLAUDE.md` Learnings 2026-08-27 for the exact gotcha), then `bin/cake migrations migrate`. Every dev needs their own `signing_keys.json` since it's gitignored — currently undocumented.
- [ ] Note `supabase status` reprints the local anon/publishable/service keys + URLs — needed to refill `.env` files after a `supabase stop`/`start` cycle if the project ever gets reinitialized.

## Deploy rewrite (negrita cutover — nuke and rebuild, no data migration)

- [ ] `config/deploy.api.yml`: remove the `accessories.db` block entirely (MariaDB container + `ollert-db` volume on negrita) — app data now lives in Supabase's hosted Postgres, no self-hosted DB container needed on negrita at all.
- [ ] `config/deploy.api.yml` `env.secret`: `DATABASE_URL` changes from the MariaDB DSN to the hosted Supabase project's Postgres connection string (`postgres://...`, likely needs `sslmode=require` — check Supabase's connection-string docs for the exact pooler/direct-connection form to use).
- [ ] Confirm which hosted Supabase project prod points at, and run `bin/cake migrations migrate` against its Postgres once (one-time, from a machine with the prod `DATABASE_URL`) to create the schema there — this is the actual "cutover" step, now trivial since there's no data to carry over.
- [ ] `DEPLOYMENT.md`: rewrite the "MariaDB accessory + API DB connection" section (currently lines ~70-78, ~206, ~212-226, ~242) — no more DB accessory, no more `ollert-api-db:3306` Docker-network hostname, no more `kamal accessory upgrade db`.
- [ ] `KAMAL_DEPLOYMENT.md`: check for any MariaDB-accessory-specific gotchas logged there that no longer apply once the accessory is gone; leave the still-relevant shared-kamal-proxy / healthcheck / cloudflared gotchas as-is.
- [ ] Decide whether to literally "nuke" negrita (stop/remove the existing `ollert-api`/`ollert-web`/`ollert-mcp` containers + the `ollert-db` volume + registry image cache) before the first post-migration deploy, or just let the new deploy naturally replace the API container and separately `docker volume rm ollert-db` once confirmed unused. Either way, back up nothing — this was the explicit decision (no data migration).
- [ ] Re-verify the MCP deploy (`config/deploy.mcp.yml`) and its `SUPABASE_*` secrets still point at the right project post-cutover — MCP shares Supabase auth config with the API by convention (`mcp/.env.example`'s own comment: "mirrors api/.env's Supabase values exactly").

## Misc

- [ ] `api/config/Migrations/schema-dump-default.lock` was regenerated against Postgres as part of this branch (binary diff) — just confirm it's included in the merge, no action needed beyond that.
- [ ] `planning/architecture.md`/`data-model.md`/`supabase-migration.md` all describe local dev as Postgres now but prod as still-MySQL — once the deploy cutover above lands, do one more pass to drop the "prod still runs MySQL" caveats.
