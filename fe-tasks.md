# Ollert Frontend Tasks

Derived from the OKF planning bundle (`planning/`). Two sections:

- **Section 1** — one branch, merged first. Shared infrastructure every other frontend branch depends on (scaffold, styling tokens, auth context, API client, route tree, app shell). Landing it first means Section 2 branches don't collide with each other on the same files.
- **Section 2** — independent branches, delegate in parallel once Section 1 is merged. Each owns its own page/feature files, routed through stub pages Section 1 already created.

**Status: all of Section 1 and Section 2 are done and merged.** See [Lessons for the next parallel round](#lessons-for-the-next-parallel-round) below before delegating Playwright e2e or any future section — the last parallel round needed several extra review rounds to shake out issues that a tighter Section 1 would have caught once instead of N times.

Refs: [architecture.md](planning/architecture.md), [api-contract.md](planning/api-contract.md), [design.md](planning/design.md), [roadmap.md](planning/roadmap.md).

---

## Section 1 — Foundation (`feat/web-foundation`, merged: PR #1)

- [x] Scaffold TanStack Start in `/web`, **SPA mode** (`ssr: false`, no server functions) — [architecture.md#tech-stack](planning/architecture.md#tech-stack). Bun as package manager, pinned via `"packageManager": "bun@1.3.14"` in `package.json`.
- [x] Tailwind CSS install + config wired with the [Design](planning/design.md) tokens: the full custom color scale ([design.md#color-palette](planning/design.md#color-palette)), Inter font (`@fontsource/inter` or self-hosted woff2, not a Google Fonts runtime dependency), the custom `bottom` box-shadow, `darkMode: 'class'`.
- [x] Base UI install. Build the shell layout primitives from [design.md#layout-pattern](planning/design.md#layout-pattern): fixed left sidebar, top navbar, content area wrapper, dark-mode toggle. Just the shell — not page content.
- [x] Supabase JS client setup: `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` env vars (see `.env.fe.example`), an auth context/hook exposing session state + login/signup/logout, relying on the client's built-in auto-refresh. 401 handling: treat as unrecoverable, clear session, redirect to login — no retry-after-refresh ([architecture.md#auth-flow](planning/architecture.md#auth-flow)).
- [x] `/auth/callback` route to receive Supabase's password-reset/email-confirm redirects (route only here — the confirmation/reset UI itself is a Section 2 concern).
- [x] API client wrapper: base fetch wrapper using `VITE_API_BASE_URL`, attaches `Authorization: Bearer <token>`, parses the standard error envelope (`{ error: { message, code, fields? } }`) into a typed error, parses the pagination envelope (`{ data, meta }`) generically ([api-contract.md#conventions](planning/api-contract.md#conventions), [api-contract.md#pagination](planning/api-contract.md#pagination)).
- [x] Route tree: register every route as a **stub page** (empty/placeholder component) so Section 2 branches each fill in exactly one file and never touch the route-registration file's structure beyond adding their own entry:
  - `/login`, `/signup`, `/auth/callback`
  - `/orgs` (org list)
  - `/orgs/:orgId` (org detail — boards list + members entry point)
  - `/orgs/:orgId/members`
  - `/boards/:boardId` (board detail — kanban view)
- [x] Global authenticated-app shell: sidebar + navbar wrapping the routes above, org switcher placeholder in the sidebar (per [design.md#layout-pattern](planning/design.md#layout-pattern)).
- [x] Vitest + Testing Library config, base test utils.
- [x] Verify Phase 1 exit criteria end to end: `bun run build` produces a static bundle, login/signup round-trips against a real Supabase project, an authenticated request reaches the (Section-1-built) `/api/health` and gets a 200.

---

## Section 2 — Parallel branches (delegated once Section 1 merged)

Each branch: build out its stub page(s) using the Section 1 auth context, API client, and layout shell — don't re-derive them. Include basic empty/loading/error states and form validation for its own scope, plus Vitest component tests.

### Branch: `feat/web-auth` — Auth pages (merged: PR #6)
- [x] `/login`, `/signup` forms against the Section 1 Supabase auth context.
- [x] Password-reset request UI + the `/auth/callback` confirmation/reset-completion UI (the route exists from Section 1; this branch fills in what it renders).

### Branch: `feat/web-orgs` — Organizations (merged: PR #3)
- [x] `/orgs`: list (paginated), create-org form (422 `quota_exceeded` → inline message), rename, delete (owner only).
- [x] Empty state for a user with zero orgs (expected default — `max_orgs` is 1).

### Branch: `feat/web-org-members` — Org Members (merged: PR #4)
- [x] `/orgs/:orgId/members`: list (paginated, table per [design.md#layout-pattern](planning/design.md#layout-pattern)), add-by-email form (surface 404/422 if the email has no account), remove (owner only, or self-removal).

### Branch: `feat/web-boards` — Boards (merged: PR #5)
- [x] Board list within `/orgs/:orgId` (paginated), create-board form (org-owner only — hide/disable for non-owners, 422 `quota_exceeded` on `max_boards_per_org`), rename, delete.

### Branch: `feat/web-board-detail` — Board detail / Kanban view (merged: PR #7)
- [x] `/boards/:boardId`: render lists + cards nested from the single unpaginated board-detail response.
- [x] List CRUD: create (422 on `max_lists_per_board`), rename, delete.
- [x] Card CRUD: create (422 on `max_cards_per_board`), card detail modal (title/description/due_date), delete.
- [x] Drag-drop reorder via `@dnd-kit`: lists within a board, cards within and across lists — `PATCH` with new `position` (and `list_id` for cross-list card moves) per drag action ([api-contract.md#conventions](planning/api-contract.md#conventions)). First item in an empty list/board bootstraps `position` to `1.0`.
- Largest branch — lists/cards/drag-drop are tightly coupled to the same view and don't split cleanly. Confirmed in practice: this branch alone took 4 review rounds to converge on correct optimistic-rollback behavior under concurrent drag actions — expect that regardless of how the work is split.

### Branch: `feat/web-deploy` — Deploy script (merged: PR #2)
- [x] Local (non-CI) script: `bun run build`, sync the static output to the shared PHP host, `.htaccess` catch-all rewrite to `index.html` for client-side routes ([architecture.md#deployment](planning/architecture.md#deployment)). Doesn't depend on the other branches being finished.

---

## Lessons for the next parallel round

The 6-way Section 2 parallel round worked (all branches landed independently, no real scope collisions), but needed 2-4 extra review rounds per branch on issues that traced back to gaps in the shared foundation, not the individual branches' logic. Apply these **before** the next fan-out (Playwright e2e, or any future Section 3):

1. **Exercise shared test/API infra in Section 1 itself, not just build it.** `web/src/test/setup.ts` was missing `afterEach(cleanup)` (Testing Library's auto-cleanup never registers under this project's `vitest.config.ts` `globals: false`) — invisible until a Section 2 branch wrote a multi-`render()` test file, which happened independently on 5 branches, each patching it locally, causing repeat merge conflicts. Similarly `ApiErrorFields` in `web/src/lib/api-client.ts` was typed as `Record<string, string[]>` when the real error envelope only includes keys for fields that actually failed — should have been `Partial<...>` from the start. **Fix pattern**: Section 1 should ship at least one real multi-test component file and one real 422-with-partial-`fields` test case, not just scaffolding — that would have caught both gaps once instead of N times.
2. **Decide route-remount behavior for `:paramName`-scoped pages in Section 1, not per-branch.** None of `/orgs/:orgId`, `/orgs/:orgId/members` remount when `:orgId` changes (no `key={orgId}`), so any local state derived from the previous org (pagination, open dialogs, in-flight request tracking) silently leaks across org navigation. Three Section 2 branches (orgs, org-members, boards) hit this independently and each shipped a different local patch. **Fix pattern**: either put `key={orgId}` on the relevant route components in Section 1's route tree, or write down explicitly in Section 1's task item that dynamic-segment routes don't remount and downstream branches must reset param-derived state themselves — right now neither was decided, so it got rediscovered 3 times.
3. **Ownership/authorization fields the FE needs must be nailed down in `api-contract.md` before Section 2 starts, not guessed per-branch.** No `is_owner` (or equivalent) field is documented for the org resource, and there's no `/me` endpoint — so the FE has no way to resolve "is the current user this org's owner" without guessing. `feat/web-orgs`, `feat/web-org-members`, and `feat/web-boards` each shipped a different guess. **Fix pattern**: this is a cross-cutting BE/FE contract decision — see `be-tasks.md` Section 1F, which now has an explicit item to settle the contract (the field itself ships later, in `feat/api-organizations`, since `OrganizationsController` doesn't exist yet at 1F). Once that branch ships, reconcile all three FE branches against the real shape in one pass instead of leaving three divergent guesses live.
4. **A branch built around non-trivial concurrent-state logic (optimistic updates + rollback under overlapping in-flight requests) will need several review rounds no matter how it's split** — `feat/web-board-detail`'s drag-drop rollback logic took 4 rounds to converge, each catching a progressively narrower race. Not a coordination failure; budget review rounds for this kind of branch rather than expecting it to land clean on the first pass.
