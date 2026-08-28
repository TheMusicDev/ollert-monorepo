# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Ollert is

Stripped-down Trello clone: CakePHP backend, Supabase Auth, Vite+React frontend. Full shape: `planning/architecture.md`.

## Project status

`/api` (CakePHP) and `/web` (TanStack Start) are both scaffolded. `/web`: `bun run lint` / `bun run test` / `bunx tsc --noEmit` / `bun run build`. `/api`: `bin/cake migrations migrate`, `composer validate`.

## Open Knowledge Format (OKF)

`planning/` is an OKF v0.2 bundle — project knowledge stored as linked markdown "concepts" with YAML frontmatter, structured so both humans and agents can navigate it predictably. Spec: https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/refs/heads/main/okf/SPEC.md. Bundle entry point / table of contents: `planning/index.md`.

Validate after any edit to `planning/`:
```
python3 ~/.claude/skills/okf/okf/scripts/validate_okf.py planning --strict
```

## Where to find things

Don't duplicate bundle content here — read it directly:

- Stack, repo layout, auth flow, CORS, deployment → `planning/architecture.md`
- MySQL schema, quotas → `planning/data-model.md`
- REST endpoints, authorization rules, error envelope → `planning/api-contract.md`
- MVP scope, phases, testing strategy → `planning/roadmap.md`
- Full running decisions log (the *why* behind everything) → `planning/log.md`

Useful anchors:
- `planning/architecture.md#auth-flow`
- `planning/architecture.md#cors`
- `planning/architecture.md#deployment`
- `planning/data-model.md#quotas`
- `planning/api-contract.md#error-response-shape`
- `planning/roadmap.md#testing-strategy`
- `planning/roadmap.md#key-decisions-log`

Check `planning/log.md` before treating any decision as arbitrary or open for silent revision.

## Git worktrees

When a task calls for a git worktree, create it under `.claude/worktrees/` (e.g. `.claude/worktrees/chore-ci-workflows`), not as a sibling directory next to the repo.

## Git: never commit or push without being asked

Do not run `git add`, `git commit`, `git push`, or anything that stages/commits/pushes, unless explicitly told to in that turn. "Fix X" / "update the docs" is not authorization to commit — make the edits, leave them in the working tree, stop.

## Living document

This file grows as we work. When you hit a non-obvious gotcha, get corrected on an approach, or notice a recurring preference, append a dated one-liner under **Learnings & Corrections** below — enough to say what and why, not a story. Don't duplicate anything already in the OKF bundle; link to it instead if relevant.

**Two living runbooks to keep current alongside this file:** `KAMAL_DEPLOYMENT.md` (project-agnostic kamal gotcha log) and `PR_AGENT_SETUP.md` (project-agnostic pr-agent setup/gotcha log). When a new kamal or pr-agent gotcha is hit — a deploy failure pattern, a config footgun, a model-quality failure — update the relevant runbook in the same turn, not just the Learnings list below. These runbooks are the reusable part (Ollert-specific details stay in `DEPLOYMENT.md`); letting them drift stale defeats their purpose.

### Learnings & Corrections

- 2026-08-20: `web/src/test/setup.ts` doesn't register global RTL cleanup (`vitest.config.ts` sets `globals: false`, so `@testing-library/react`'s auto-cleanup-via-global-`afterEach` never triggers) — any test file with more than one `render()` call needs its own `afterEach(() => cleanup())`, or add it once globally in `setup.ts`. Hit independently by 5 separate Section 2 FE branches before landing as a shared fix.
- 2026-08-20: Password-reset request UI is its own route (`/forgot-password`), not a `/login` mode — kept the login form and its validation state simple, and made the reset flow linkable/bookmarkable on its own. No convention in `planning/design.md` dictated this either way.
- 2026-08-20: `web/tsr.config.json` needs `"routeFileIgnorePattern": "\\.test\\.tsx?$"` once `*.test.tsx` files are colocated under `src/routes/` — otherwise `tsr generate` (and the build) warns that each test file "does not export a Route".
- 2026-08-21: Org-scoped FE pages (`/orgs/:orgId`, `/orgs/:orgId/members`) don't remount on `:orgId` change (no `key={orgId}` on the route component) — any local state derived from the previous org (pagination `page`, open dialogs holding a stale entity, in-flight request generation counters) leaks across org navigation unless explicitly reset in a render-time `orgId !== prevOrgId` check. Hit and patched locally on 3 separate branches (orgs, org-members, boards) before this was named as a pattern — a `key={orgId}` on the route would kill the whole class at once instead of patching each symptom, worth doing next time this route tree is touched.
- 2026-08-21: Optimistic-update rollback for concurrent in-flight requests to the *same* entity needs more than a "did I lose the race" generation counter — it needs to track a running baseline that only advances on actual success, and must guard against a stale success writing a fresh baseline into an already-closed request chain. See `web/src/lib/board-dnd.ts`'s `MoveRequestTracker` for the reference implementation (took 3 review rounds on PR #7 to converge — each earlier version had a real, narrow race).
- 2026-08-21: The API error envelope's `fields` object only contains keys for fields that actually failed validation (per `planning/api-contract.md#error-response-shape`) — `err.fields?.someField[0]` will throw if `someField` didn't fail. `ApiErrorFields` in `web/src/lib/api-client.ts` is `Partial<Record<string, string[]>>`, not `Record<string, string[]>`; always chain `?.` one level past `fields` too (`err.fields?.someField?.[0]`).
- 2026-08-21: A deploy script's `rsync -e "ssh -i '$KEY_PATH'"` string is parsed by **rsync's own arg splitter**, not a real shell — shell escaping idioms like `'\''` don't apply. rsync uses simple quote-doubling (`''`) for an embedded quote inside a single-quoted token. See `scripts/deploy-web.sh` in the `feat/web-deploy` history for the two wrong attempts before this was caught.
- 2026-08-21: No `is_owner`/"is this user the org owner" field exists yet in `planning/api-contract.md` — the org resource only documents `owner_id` (a local `users.id`), and the FE only ever holds the Supabase identity (`session.user.id`), with no `/me` endpoint or JWT-embedded local id to compare against it. `feat/web-orgs`, `feat/web-org-members`, and `feat/web-boards` each shipped a different client-side workaround (optional `is_owner` field assumed from the API with fail-safe UI, and email-matching against loaded member rows). Needs a real decision when `feat/api-organizations` is built — see `planning/log.md` for the open item.
- 2026-08-21: `is_owner` contract settled by `feat/api-shared-helpers` (see `planning/api-contract.md#organizations` and `planning/log.md`) — `App\Service\OrgAuthorizationService::isOrgOwner()` is the source of truth, `feat/api-organizations` still owns actually emitting the field. Same branch also settled `org_members`' "is the owner an explicit row" ambiguity: `isOrgMember()` treats `organizations.owner_id` as membership directly, so org creation is free to pick either convention.
- 2026-08-21: `api/.env` doesn't exist by default in a fresh worktree/clone (gitignored, no `app_local.php` fallback per `api/CakePHPDivergance.md`) — `composer test` needs at least `SECURITY_SALT` and `DATABASE_URL` set or it can't boot. Local MariaDB from `docker/` (port `9937`, user/pass `ollert`/`change-me`, db `ollert`) covers the main connection; the test connection defaults to a throwaway sqlite file (`DATABASE_TEST_URL` unset) so no separate test DB/migration step is needed against MariaDB.
- 2026-08-23: kamal deploy work landed on `feat/mcp` — both apps live behind one shared kamal-proxy on negrita (192.168.1.20): `https://ollert-api.2719.fyi/health` (API) + `https://ollert.2719.fyi` (web SPA). Full kamal gotcha log (shared kamal-proxy port 80, healthcheck Host-header 400, no `secret()` ERB, ERB-evaluates-tags-in-YAML-comments, cloudflared `ssl:false`/no hot-reload, macOS launchd, in-docker SPA-prerender fails under bun preset → build locally + nginx-ship) in `KAMAL_DEPLOYMENT.md`; Ollert-specific runbook in `DEPLOYMENT.md`. **Do NOT trust subagent "negrita DNS down" diagnoses** — two deploy subagents both false-flagged network (negrita DNS is fine; verified directly via `ssh negrita.local`); check directly before concluding network. Web deploy flow: `( cd web && bun run build ) && kamal deploy -c config/deploy.web.yml` — build locally (reads gitignored `web/.env`), ship pre-built static in an nginx image (no in-docker bun build, no build secrets).
- 2026-08-23: Supabase password-reset email links resolve as follows (Supabase maintainer, issue #38111, Aug 2025): Supabase uses the `redirectTo` the app passes **if it's in the Redirect URLs allow-list**; otherwise it falls back to **Site URL**. Site URL is only a fallback, NOT the link base. `web/src/lib/auth-context.tsx` `authCallbackUrl()` = `${window.location.origin}/auth/callback` → already per-environment (prod-on-prod, localhost-on-dev). So if BOTH `http://localhost:3000/auth/callback` AND `https://ollert.2719.fyi/auth/callback` are in the allow-list, `redirectTo` always wins → **one project is enough for dev + prod of the same app**, both envs land on the right host, no dev compromise. Set Site URL = `https://ollert.2719.fyi` anyway as a sane fallback. Prod reset emails pointed at localhost earlier because prod's redirect URL wasn't yet in the allow-list → fell back to Site URL (localhost). (One project per *app* still right; dev+prod of the *same* app share one project. The "need two projects" reasoning was wrong — it assumed Site URL is the link base.) See `DEPLOYMENT.md` §4b.
- 2026-08-24: A Bun/app-level liveness route (`/health`) MUST run before any `Host`-header validation guard (e.g. the MCP SDK's `hostHeaderValidationResponse`). kamal-proxy's healthcheck probes the container by its docker-internal hostname/IP, sending a `Host` like `192.168.1.20-7b61921f7a7a` — not in any app allow-list → 403, deploy fails "target failed to become healthy within 30s" even though the app booted fine. Same shape as the api deploy sidestepping it by nginx-serving `/health` as a static file before the Host-header middleware. `/health` returns only `ok`, so exempting it from DNS-rebinding protection is safe. Hit on the first `kamal deploy -c config/deploy.mcp.yml`; fix in `mcp/src/server.ts`.
- 2026-08-24: A new client-side route landing in the repo does NOT auto-appear on the live SPA — the deployed web container keeps serving the SHA it was built from until you redeploy. First claude.ai MCP connect 404'd on `/oauth/consent` because the live `ollert-web` container was still SHA `fec7ecaf` (predates the `518ae57` consent-route commit); `cd web && bun run build && kamal deploy -c config/deploy.web.yml` brought it current. Check `docker ps` container-name SHAs on negrita vs. `git log` when a route that exists locally 404s in prod.
- 2026-08-24: Prod auth 401 on every authed request was NOT a token/JWT/JWKS problem — it was `tmp/cache/` owned by **root** in the API container, so php-fpm workers (www-data) couldn't write the JWKS cache → `Cake\Cache\Exception\CacheWriteException` thrown out of `SupabaseJwksProvider::getKeySet()` (caught by `AuthMiddleware::verifyToken`'s try → bare 401, no body) → empty keyset every request. Root cause: `.dockerignore` excludes `tmp/`, the Dockerfile creates empty `tmp/` www-data-owned, but `docker-entrypoint.sh` runs `bin/cake migrations migrate` as **root** before php-fpm starts, and Cake creates `tmp/cache/` + `tmp/cache/models/` during that run as root. Fix: `chown -R www-data:www-data /srv/api/tmp /srv/api/logs` in the entrypoint AFTER migrations, before php-fpm. The prior prod CORS bug (SPA calling `localhost:8765`, never reaching the API) masked this for the whole time prod was up. Diagnostic to find it: temporarily log `get_class($e).$e->getMessage()` + `array_keys($keySet ?? [])` in `verifyToken`'s catch → `keysetKids=[]` + `CacheWriteException` was the tell.
- 2026-08-27: Supabase CLI local stack (`supabase start`) signs JWTs **HS256 by default** — no JWKS endpoint at all unless `config.toml`'s `[auth] signing_keys_path` points at a real key file. Generate one with `supabase gen signing-key --algorithm RS256`; its stdout mixes the JSON key with follow-up instructional text on stdout (not stderr), so capture only the first line, then wrap it in a JSON array (`[...]`) before saving — `signing_keys_path` expects an array of JWKs, not a bare object. With this wired up, local tokens are `iss: http://127.0.0.1:54321/auth/v1`, `aud: authenticated`, verifiable via `http://127.0.0.1:54321/auth/v1/.well-known/jwks.json` — same RS256/JWKS code path as prod, just a different URL. Without it, `verifyToken.ts`/`AuthMiddleware.php` would need a second HS256 fallback path just for local dev. Key file goes at `supabase/signing_keys.json`, must be gitignored.
- 2026-08-27: CakePHP's `Datasources.default.url` DSN scheme (`postgres://…` vs `mysql://…`) determines the actual driver at connection time — the literal `'driver' => Postgres::class` array key in `config/app.php` is effectively documentation/fallback once a scheme-bearing `url` is set. Update both anyway (driver import + array key + `DATABASE_URL` scheme) so the config reads correctly on its own.
