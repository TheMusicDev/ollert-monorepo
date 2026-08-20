# Ollert Backend Tasks

Derived from the OKF planning bundle (`planning/`). Two sections:

- **Section 1** — one branch, merged first. Everything in it is shared infrastructure every other backend branch touches or depends on (migrations, model classes, auth, error/pagination shape, routes, stub controllers). Landing it first means Section 2 branches don't collide with each other on the same files.
- **Section 2** — independent branches, delegate in parallel once Section 1 is merged. Each owns exactly one controller file (plus its tests), so they shouldn't conflict with each other.

Refs: [architecture.md](planning/architecture.md), [data-model.md](planning/data-model.md), [api-contract.md](planning/api-contract.md), [roadmap.md](planning/roadmap.md).

---

## Section 1 — Foundation (`feat/api-foundation`)

- [ ] `composer create-project cakephp/app` skeleton in `/api`. Pin `"php": "8.5.*"` in `composer.json`. Confirm the shared deploy host actually offers PHP 8.5 (flagged in [architecture.md](planning/architecture.md#tech-stack) as unconfirmed) — adjust the pin now if it doesn't.
- [ ] Wire DB connection to the `docker/` MariaDB service using `DATABASE_URL` in `api/.env.example` (`mysql://user:pass@host:port/db` — must match `docker/.env`). Confirm `bin/cake migrations migrate` runs clean against it.
- [ ] Install `cakephp/migrations`, `muffin/trash`, a JWT library (e.g. `firebase/php-jwt`).
- [ ] Migrations for all 6 tables per [data-model.md](planning/data-model.md#schema): `users`, `organizations`, `org_members`, `boards`, `lists`, `cards`.
  - UUID `id` PK (migrations `uuid` column type) and UUID FKs on every table.
  - `created`/`modified`/`deleted` on every table ([data-model.md#timestamps-and-soft-delete](planning/data-model.md#timestamps-and-soft-delete)).
  - `varchar(255)` on `name`/`title`/`email`/`display_name` fields, `text` nullable on `cards.description`, `date` nullable on `cards.due_date`, float `position` on `lists`/`cards` ([data-model.md#field-constraints](planning/data-model.md#field-constraints)).
  - `users` quota columns: `max_orgs` (1), `max_boards_per_org` (3), `max_lists_per_board` (5), `max_cards_per_board` (100).
- [ ] Bake/write all 6 Table + Entity classes with associations fully wired to match the schema (`Users hasMany Organizations`, `Organizations belongsTo Users` (owner), `hasMany OrgMembers`, `hasMany Boards`; `Boards belongsTo Organizations`, `hasMany Lists`; `Lists belongsTo Boards`, `hasMany Cards`; `Cards belongsTo Lists`), plus `TimestampBehavior` and `TrashBehavior` attached to every Table, plus `validationDefault()` rules matching the field constraints above. Doing this once now means Section 2 branches never need to touch a shared Table class.
- [ ] Auth middleware: fetch + cache Supabase JWKS (15 min TTL), verify RS256 signature + `exp`/`aud`/`iss`, extract `sub`, JIT find-or-create the `users` row by `supabase_uid` on every authenticated request ([architecture.md#auth-flow](planning/architecture.md#auth-flow)). Config via `SUPABASE_JWKS_URL`/`SUPABASE_JWT_ISS`/`SUPABASE_JWT_AUD`/`JWKS_CACHE_TTL` env vars.
- [ ] CORS middleware: origin allow-list from `CORS_ALLOWED_ORIGINS`, `Authorization`+`Content-Type` headers, `GET,POST,PATCH,DELETE,OPTIONS`, no credentials mode ([architecture.md#cors](planning/architecture.md#cors)).
- [ ] Standard error envelope: exception renderer producing `{ error: { message, code, fields? } }` for 401/403/404/422/500, matching [api-contract.md#error-response-shape](planning/api-contract.md#error-response-shape). 404 uses `code: "not_found"`. Bare 401 stays bodyless.
- [ ] Pagination trait/component: parses `?page=`/`?limit=` (default 20, clamp to 100), wraps `index` results as `{ data, meta: { page, limit, total, totalPages } }` ([api-contract.md#pagination](planning/api-contract.md#pagination)). Reusable across every `index` action in Section 2.
- [ ] Org-membership authorization helper (e.g. a component or policy): `isOrgMember($userId, $orgId)`, `isOrgOwner($userId, $orgId)`. Every Section 2 controller needs this for 403 checks — build it once here, not four times.
- [ ] Quota-check helper: generic "count existing rows for X, compare to owner's `max_Y` column, throw 422 `quota_exceeded` if at/over" — parameterized so it covers all four quotas (`max_orgs`, `max_boards_per_org`, `max_lists_per_board`, `max_cards_per_board`).
- [ ] `routes.php`: full route table under `/api/`, matching [api-contract.md#endpoints](planning/api-contract.md#endpoints) exactly, wired to **stub controllers** (see next item). This is the one file Section 2 branches will each touch in one place (adding nothing, routes already point at their controller) — no route-table conflicts expected.
- [ ] Stub controllers: `OrganizationsController`, `OrgMembersController`, `BoardsController`, `ListsController`, `CardsController` — created empty (or with unimplemented actions) so each Section 2 branch owns exactly one file and never edits another branch's controller.
- [ ] `GET /api/health` — unauthenticated liveness check, implemented fully here (trivial, no reason to delegate).
- [ ] PHPUnit bootstrap: base `TestCase`, DB test connection/fixture bootstrap, so Section 2 branches can add `Fixture` classes without fighting over test bootstrap config.
- [ ] Verify Phase 1 exit criteria end to end: migrations run clean, `/api/health` responds, a hand-crafted Supabase JWT passes the auth middleware and provisions a `users` row.

---

## Section 2 — Parallel branches (delegate once Section 1 merges)

Each branch: implement its controller's actions per [api-contract.md](planning/api-contract.md), using the Section 1 auth/CORS/pagination/quota/org-membership helpers and Table classes (don't re-derive them), plus PHPUnit coverage (fixtures + controller integration tests) for its own actions.

### Branch: `feat/api-organizations` — Organizations + Org Members
- `OrganizationsController`: `index` (paginated, orgs owned or member of), `add` (422 on `max_orgs`), `view` (includes boards), `edit` (owner or member), `delete` (owner only, soft delete).
- `OrgMembersController`: `index` (paginated), `add` (by email, must be an existing user — 404/422 if not found), `delete` (owner only, or self-removal).

### Branch: `feat/api-boards` — Boards
- `BoardsController`: `index` under an org (paginated), `add` (org-owner only via the org-membership helper, 422 on `max_boards_per_org`), `view` (board detail — lists + cards nested, unpaginated per [api-contract.md#pagination](planning/api-contract.md#pagination)), `edit` (any org member), `delete` (any org member, soft delete).

### Branch: `feat/api-lists` — Lists
- `ListsController`: `add` under a board (any org member, 422 on `max_lists_per_board`), `edit` (rename or `position` update for reordering), `delete` (soft delete).

### Branch: `feat/api-cards` — Cards
- `CardsController`: `add` under a list (any org member, 422 on `max_cards_per_board`, counted across the whole board not per-list), `edit` (title/description/due_date/position, including moving to a different `list_id`), `delete` (soft delete).

### Branch: `feat/api-deploy` — Deploy script
- Local (non-CI) SSH deploy script for `/api`: sync PHP files to the shared host, run `bin/cake migrations migrate` remotely ([architecture.md#deployment](planning/architecture.md#deployment)). Doesn't depend on the CRUD branches' code being finished — the script just deploys whatever's on the branch when run.

---

## Deferred (not a branch yet)

Playwright e2e tests need both `/api` and `/web` functional — not phased in until Phase 3 at the earliest, and not split across the branches above ([roadmap.md#testing-strategy](planning/roadmap.md#testing-strategy)).
