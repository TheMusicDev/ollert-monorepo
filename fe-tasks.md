# Ollert Frontend Tasks

Derived from the OKF planning bundle (`planning/`). Two sections:

- **Section 1** — one branch, merged first. Shared infrastructure every other frontend branch depends on (scaffold, styling tokens, auth context, API client, route tree, app shell). Landing it first means Section 2 branches don't collide with each other on the same files.
- **Section 2** — independent branches, delegate in parallel once Section 1 is merged. Each owns its own page/feature files, routed through stub pages Section 1 already created.

Refs: [architecture.md](planning/architecture.md), [api-contract.md](planning/api-contract.md), [design.md](planning/design.md), [roadmap.md](planning/roadmap.md).

---

## Section 1 — Foundation (`feat/web-foundation`)

- [ ] Scaffold TanStack Start in `/web`, **SPA mode** (`ssr: false`, no server functions) — [architecture.md#tech-stack](planning/architecture.md#tech-stack). Bun as package manager, pinned via `"packageManager": "bun@1.3.14"` in `package.json`.
- [ ] Tailwind CSS install + config wired with the [Design](planning/design.md) tokens: the full custom color scale ([design.md#color-palette](planning/design.md#color-palette)), Inter font (`@fontsource/inter` or self-hosted woff2, not a Google Fonts runtime dependency), the custom `bottom` box-shadow, `darkMode: 'class'`.
- [ ] Base UI install. Build the shell layout primitives from [design.md#layout-pattern](planning/design.md#layout-pattern): fixed left sidebar, top navbar, content area wrapper, dark-mode toggle. Just the shell — not page content.
- [ ] Supabase JS client setup: `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` env vars (see `.env.fe.example`), an auth context/hook exposing session state + login/signup/logout, relying on the client's built-in auto-refresh. 401 handling: treat as unrecoverable, clear session, redirect to login — no retry-after-refresh ([architecture.md#auth-flow](planning/architecture.md#auth-flow)).
- [ ] `/auth/callback` route to receive Supabase's password-reset/email-confirm redirects (route only here — the confirmation/reset UI itself is a Section 2 concern).
- [ ] API client wrapper: base fetch wrapper using `VITE_API_BASE_URL`, attaches `Authorization: Bearer <token>`, parses the standard error envelope (`{ error: { message, code, fields? } }`) into a typed error, parses the pagination envelope (`{ data, meta }`) generically ([api-contract.md#conventions](planning/api-contract.md#conventions), [api-contract.md#pagination](planning/api-contract.md#pagination)).
- [ ] Route tree: register every route as a **stub page** (empty/placeholder component) so Section 2 branches each fill in exactly one file and never touch the route-registration file's structure beyond adding their own entry:
  - `/login`, `/signup`, `/auth/callback`
  - `/orgs` (org list)
  - `/orgs/:orgId` (org detail — boards list + members entry point)
  - `/orgs/:orgId/members`
  - `/boards/:boardId` (board detail — kanban view)
- [ ] Global authenticated-app shell: sidebar + navbar wrapping the routes above, org switcher placeholder in the sidebar (per [design.md#layout-pattern](planning/design.md#layout-pattern)).
- [ ] Vitest + Testing Library config, base test utils.
- [ ] Verify Phase 1 exit criteria end to end: `bun run build` produces a static bundle, login/signup round-trips against a real Supabase project, an authenticated request reaches the (Section-1-built) `/api/health` and gets a 200.

---

## Section 2 — Parallel branches (delegate once Section 1 merges)

Each branch: build out its stub page(s) using the Section 1 auth context, API client, and layout shell — don't re-derive them. Include basic empty/loading/error states and form validation for its own scope, plus Vitest component tests.

### Branch: `feat/web-auth` — Auth pages
- `/login`, `/signup` forms against the Section 1 Supabase auth context.
- Password-reset request UI + the `/auth/callback` confirmation/reset-completion UI (the route exists from Section 1; this branch fills in what it renders).

### Branch: `feat/web-orgs` — Organizations
- `/orgs`: list (paginated), create-org form (422 `quota_exceeded` → inline message), rename, delete (owner only).
- Empty state for a user with zero orgs (expected default — `max_orgs` is 1).

### Branch: `feat/web-org-members` — Org Members
- `/orgs/:orgId/members`: list (paginated, table per [design.md#layout-pattern](planning/design.md#layout-pattern)), add-by-email form (surface 404/422 if the email has no account), remove (owner only, or self-removal).

### Branch: `feat/web-boards` — Boards
- Board list within `/orgs/:orgId` (paginated), create-board form (org-owner only — hide/disable for non-owners, 422 `quota_exceeded` on `max_boards_per_org`), rename, delete.

### Branch: `feat/web-board-detail` — Board detail / Kanban view
- `/boards/:boardId`: render lists + cards nested from the single unpaginated board-detail response.
- List CRUD: create (422 on `max_lists_per_board`), rename, delete.
- Card CRUD: create (422 on `max_cards_per_board`), card detail modal (title/description/due_date), delete.
- Drag-drop reorder via `@dnd-kit`: lists within a board, cards within and across lists — `PATCH` with new `position` (and `list_id` for cross-list card moves) per drag action ([api-contract.md#conventions](planning/api-contract.md#conventions)). First item in an empty list/board bootstraps `position` to `1.0`.
- Largest branch — lists/cards/drag-drop are tightly coupled to the same view and don't split cleanly.

### Branch: `feat/web-deploy` — Deploy script
- Local (non-CI) script: `bun run build`, sync the static output to the shared PHP host, `.htaccess` catch-all rewrite to `index.html` for client-side routes ([architecture.md#deployment](planning/architecture.md#deployment)). Doesn't depend on the other branches being finished.

---

## Deferred (not a branch yet)

Playwright e2e tests need both `/api` and `/web` functional — not phased in until Phase 3 at the earliest, and not split across the branches above ([roadmap.md#testing-strategy](planning/roadmap.md#testing-strategy)).
