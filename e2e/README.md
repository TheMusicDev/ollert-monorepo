# Ollert e2e

Playwright end-to-end suite. Drives the real built-and-running `/web` frontend
in a real browser against a real running `/api` (CakePHP) backend and the
project's real Supabase Auth — no mocking, per
[`planning/roadmap.md#testing-strategy`](../planning/roadmap.md#testing-strategy).
Lives at the repo root as its own package: no code-level import coupling to
`api/` or `web/`, since Playwright only ever talks to them over HTTP.

## Prerequisites

1. **Docker services** — `docker compose up -d` from `docker/` (MariaDB +
   Mailpit). Check `docker ps` first; they're often already running.
2. **API** — from `api/`: `bin/cake migrations migrate` (once), then
   `bin/cake server -p 8765`.
3. **Web** — from `web/`: `bun run dev` (serves on port 3000).
4. **This package** — from `e2e/`: `bun install`, then
   `bunx playwright install --with-deps chromium` (one-time browser
   download).

If you'd rather not juggle three terminals: `playwright.config.ts` declares
both the API and web dev servers as Playwright `webServer` entries with
`reuseExistingServer: true` outside CI. If they're already running (steps 2–3
above), Playwright talks to those; if not, it starts them itself and tears
them down after the run. Docker still needs to be up either way — Playwright
doesn't manage that.

## Configure

```
cp .env.example .env
```

`WEB_BASE_URL` / `API_BASE_URL` default to the local dev ports above.
`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` should match `web/.env` — same
project, since the suite exercises the real Supabase Auth flow the frontend
uses. See **Auth strategy** below for the rest.

## Run

```
bun run test          # headless
bun run test:headed   # watch it drive a real browser
bun run test:ui       # Playwright's UI mode
bun run report         # open the HTML report from the last run
```

## Auth strategy

This app uses real Supabase Auth (email/password) — there's no CakePHP-side
login and nothing to mock (see
[`planning/architecture.md#auth-flow`](../planning/architecture.md#auth-flow)).
The suite needs at least one real, *confirmed* Supabase account to drive the
authenticated scenarios (org/board/kanban/members), plus a second one for the
"add a member by email" / "remove a member" scenarios.

Two ways to get there, both read by `tests/setup/global-setup.ts`:

### Preferred: `SUPABASE_SERVICE_ROLE_KEY`

Set the project's service_role (secret) key — Project Settings → API → the
`service_role` key — and global-setup creates two brand-new, throwaway
users on **every run** via Supabase's Admin API
(`POST /auth/v1/admin/users` with `email_confirm: true`). This is the closest
thing to "real signup" that's actually automatable: a real Supabase user with
a real password-grant session, provisioned without needing a human to click a
confirmation-email link, and without sending any email at all (so it doesn't
touch the project's outbound-email rate limit — see **Why not self-serve
signup** below). Never expose this key to the browser/frontend; it's read
only in `tests/setup/`, which runs in Node, never in page context.

Each run's users get unique timestamped emails
(`ollert-e2e-owner-<ts>@ollert-e2e.test`), so `max_orgs`/quota state never
leaks between runs — every run's owner starts with a completely fresh
CakePHP `users` row (JIT-provisioned on first authenticated call, see
`planning/architecture.md#auth-flow`) and therefore a fresh `max_orgs: 1`
quota. `global-teardown.ts` deletes both Supabase users afterward.

### Fallback: pre-existing confirmed accounts

If `SUPABASE_SERVICE_ROLE_KEY` isn't set, global-setup instead requires four
env vars naming two *already confirmed* accounts:

```
E2E_OWNER_EMAIL=...
E2E_OWNER_PASSWORD=...
E2E_MEMBER_EMAIL=...
E2E_MEMBER_PASSWORD=...
```

You'd create these once by hand (e.g. via the Supabase dashboard's "Add
user" with auto-confirm, or by signing up normally and clicking the real
confirmation email). Because they're reused across runs rather than created
fresh, `max_orgs`/`max_boards_per_org` quota state *does* persist between
runs for these accounts — the quota-exceeded scenarios still work (they only
need "already at the limit," which stays true), but don't expect a clean
slate for anything else if you reuse these accounts outside the suite too.

If neither path is configured, global-setup doesn't crash the whole run —
it records why seeding failed, and every spec that needs a signed-in user
calls `test.skip()` with that reason instead of erroring. Specs that don't
need one (the plain signup-form test) still run normally. Run the suite with
neither configured to see this in action: everything reports `skipped`, each
with the actual reason in the Playwright report — the seeded-user specs with
the missing-config reason from `global-setup`, and the signup-form test with
whatever Supabase itself returned (see next section).

### Why not self-serve signup for everything?

The obvious "most real" option — have global-setup call the same `signUp()`
the frontend uses, for every test user — was tried first and rejected for
this project's actual Supabase configuration:

* The project has **email confirmation required** (`signUp()` returns
  `data.session: null`, which is exactly the branch `web/src/routes/signup.tsx`
  handles with its "Check your email" screen). No inbox is reachable from
  this environment to click that link, and `docker/`'s Mailpit only catches
  mail CakePHP itself sends — it does **not** intercept Supabase's own
  hosted auth email (`planning/architecture.md#local-development` already
  calls this out).
* Worse, the project's outbound email is on Supabase's shared/free-tier
  sender, which has a very low built-in rate limit. In manual testing while
  building this suite, **two consecutive signup attempts** were enough to
  get `429 over_email_send_rate_limit` back from Supabase's own
  `/auth/v1/signup` endpoint — confirmed again live through the actual
  signup *form* (not just the raw API): submitting the signup UI with a
  fresh email surfaced the real inline error banner "email rate limit
  exceeded" instead of the "Check your email" screen. That makes self-serve
  signup a non-starter for repeatable automated test runs even if a human
  were available to babysit inboxes.
* No `service_role` key was available for this Supabase project in the
  environment this suite was originally built in — see **Known gap** below.

The Admin-API path above sidesteps both problems (no email sent, no rate
limit hit) while still exercising a real Supabase account end-to-end for
everything downstream of "log in." The one thing it genuinely can't cover is
the moment between submitting the signup form and clicking a confirmation
link — which is why `tests/specs/auth.spec.ts` still separately drives the
*real* self-serve signup form once, asserting it correctly lands on the
"Check your email" screen. That test is itself subject to the same
project-wide email rate limit (Supabase attempts to send the confirmation
email as part of the same call), so it treats Supabase's rate-limit error
banner as a `test.skip()` with the real reason rather than a failure — that
condition is an external constraint of the shared project, not a regression
in this app's code, and skipping (vs. failing red for something outside the
test's control) is the honest way to represent it.

## Known gap: no `SUPABASE_SERVICE_ROLE_KEY` available at build time

This suite was built and verified without a `service_role` key or a set of
pre-confirmed credentials on hand, so `tests/specs/journey.spec.ts` (the org
→ board → kanban → members flow) could not be run end-to-end for real in
that environment — every test in it reports `skipped`, each with the exact
missing-env-var reason from `global-setup.ts`, rather than a fabricated
pass. The plain signup-form test in `auth.spec.ts` *did* run for real against
the live stack, and hit the rate limit described above (confirmed via a
screenshot of the actual "email rate limit exceeded" banner before the
skip-on-rate-limit handling was added) — direct evidence the project has
email confirmation enabled and a low send-rate ceiling, which is exactly why
the Admin API path is the recommended way to run this suite in CI or in an
environment that does have the service_role key.

To actually exercise the full journey: set `SUPABASE_SERVICE_ROLE_KEY` (or
the four `E2E_*` fallback vars) in `e2e/.env` and re-run. Nothing else about
the suite changes.

## What's covered

`tests/specs/auth.spec.ts`:
* Real signup form submission lands on the "check your email" screen
  (independent of seeded users).
* An existing confirmed user can log in via the real form and lands on
  `/orgs`.

`tests/specs/journey.spec.ts` (one ordered story sharing a single
session/org — see the file's top comment for why: `max_orgs` defaults to
`1`, so the owner test user only ever gets one org for the whole run):
* Create an org; creating a second hits the `max_orgs` quota.
* View the org detail page.
* Create a board; creating a fourth hits the `max_boards_per_org` quota
  (default `3`).
* Open the board's kanban view.
* Create a list, create a card, edit the card (title/description).
* Create a second list and drag-drop the card across lists (a manual
  pointer-event sequence — see `dragAndDrop` in `tests/specs/helpers.ts` —
  since dnd-kit's `PointerSensor` needs to see its 8px activation-distance
  threshold cleared before it'll register a drag).
* Add an org member by email, then remove them.

Deliberately not covered (smoke/happy-path scope per
`planning/roadmap.md#testing-strategy`): org/board rename, org/board delete,
list/card delete (both gated behind a native `window.confirm()` — no
Base UI dialog to assert against), pagination beyond a single page,
password reset, the `/auth/callback` route, and non-owner/non-member
authorization edge cases (403s).

## Known gap: no in-app link from `/orgs` to an org's detail page

`OrgTable` (`web/src/components/orgs/OrgTable.tsx`) renders each org's name
as plain text, not a link — there's currently no click-through from the org
list to `/orgs/:orgId`. `tests/specs/helpers.ts`'s `gotoOrg()` navigates
there directly instead (a real route, just not one reachable by clicking
anything on `/orgs` today). Worth a follow-up FE fix; out of scope for this
branch, which only adds `e2e/`.

## No test ids in the app

Nothing in `/web` has `data-testid` (or similar) attributes yet, so every
selector in this suite targets real accessible roles/labels/text — the
actual rendered output, not a parallel selector API. `tests/specs/helpers.ts`
has one CSS-class-based locator (`listColumn`) for the kanban column
container, which has no accessible role of its own; it's pinned to the
literal Tailwind classes on `BoardList`'s root `<div>` and will need
updating if that markup changes.
