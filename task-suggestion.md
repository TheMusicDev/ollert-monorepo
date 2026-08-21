# Task Suggestion — What's next and when parallel work can start

Recommendation for sequencing the remaining work, given: FE is fully done (all of `fe-tasks.md`), BE is one subsection
in (`1A` merged, `1B`-`1G` and all of Section 2 not started).

## The order

**Phase 1 — now: `1B`, `1C`, `1E` in parallel (3-way).**
All three only depend on `1A` (already merged), and don't depend on each other:
- `1B` — schema/migrations + Table/Entity classes
- `1C` — error envelope
- `1E` — CORS middleware

Start all three today. This is the biggest available parallelism right now — no reason to do them one at a time.

**Optional 4th branch to fold into Phase 1: `feat/api-deploy` (currently listed under Section 2).**
Its own task description says it "doesn't depend on the CRUD branches' code being finished — the script just deploys
whatever's on the branch when run." That's true of `1A` too — it only needs the scaffold to exist, which it already
does. Nothing else in Section 2 has that property. Recommend pulling it forward into Phase 1 as a 4th parallel branch
instead of leaving it queued behind the entire rest of Section 1 for no real reason.

**Phase 2 — after `1B` merges: `1D`, `1F` in parallel (2-way).**
- `1D` — auth middleware (needs `1B`'s `users` table for JIT provisioning)
- `1F` — shared helpers: pagination, org-membership/quota helpers, the `is_owner` contract (documented + helper-ready, not shipped yet — see below), `routes.php`

Both only wait on `1B`, not on each other. `1C`/`1E` may still be in flight when this phase starts — that's fine, they
don't block or get blocked by `1D`/`1F`.

**Phase 3 — after `1D` and `1F` merge: `1G` alone.**
Stub controllers + `/api/health` + PHPUnit bootstrap + the exit-criteria verification. This one's last because its
exit criteria check needs migrations (`1B`), auth (`1D`), and routes (`1F`) all actually working together — nothing to
parallelize it against.

**Gate — before touching Section 2, run the checklist already added to `be-tasks.md` under "Before Section 2
starts."** Three concrete things, not just a vibe check:
- `1F`'s `is_owner` field is documented in `api-contract.md` and the org-membership helper can compute it (the field
  itself ships in `feat/api-organizations`, Phase 4 below — `OrganizationsController` doesn't exist until then)
- `1G`'s PHPUnit bootstrap has a real passing integration test, not just config
- `1C`'s `fields`-only-when-failed envelope behavior has a test

Skipping this gate is exactly how the FE's parallel round ended up needing 2-4 extra review rounds per branch on
shared-foundation gaps instead of catching them once. Don't skip it this time just because BE Section 2 seems lower-risk
(it is lower-risk — each branch owns one controller file, no FE-style shared-file collision — but the *content* gaps,
like `is_owner`, are the same risk regardless of file layout).

**Phase 4 — Section 2 BE, parallel (4-way if `feat/api-deploy` already landed in Phase 1, else 5-way):**
- `feat/api-organizations` (Organizations + Org Members controllers)
- `feat/api-boards`
- `feat/api-lists`
- `feat/api-cards`
- `feat/api-deploy` (only if not already done in Phase 1)

These are genuinely file-disjoint (each owns exactly one controller), so the FE's repeated-shared-file-conflict problem
mostly doesn't apply here. Watch instead for fixture files and any shared test setup — same class of risk as
`web/src/test/setup.ts`, just in PHPUnit fixtures instead of Vitest.

**Phase 5 — FE reconciliation pass (small, single task, not a full branch).**
Once `feat/api-organizations` merges and `is_owner` has a real shape, go back and reconcile the three FE branches that
each guessed at it (`feat/web-orgs`, `feat/web-org-members`, `feat/web-boards` — already merged, so this is a small
follow-up PR against `main`, not a new feature branch). Replace whichever guess each one made with the real field.

**Phase 6 — Playwright e2e (currently "Deferred" in both task files).**
Needs both `/api` and `/web` functional end to end — that means all of BE Section 2 merged, not just `1A`-`1G`. Slot
this in after Phase 5. Worth deciding at that point whether it's one branch or split by user flow (auth → org → board →
card is the natural seam, mirrors the FE Section 2 split) — not deciding that now since it's premature until Phase 4 is
close to done.

## Answering "when can parallel work start"

Right now, today: **Phase 1** (`1B`/`1C`/`1E`, optionally `+feat/api-deploy`). That's real parallel work available
immediately, not blocked on anything. The next parallel window after that is **Phase 2** (`1D`/`1F`), then a solo phase
(`1G`), then the big one — **Phase 4**, BE Section 2 — which is the direct analog of the FE's 6-way round and is the
one most worth applying the lessons in `fe-tasks.md`/`be-tasks.md` to before kicking off.

## Summary table

| Phase | Branches | Parallel? | Blocked on |
|---|---|---|---|
| 1 (now) | `1B`, `1C`, `1E`, (`feat/api-deploy`) | yes, 3-4 way | `1A` (done) |
| 2 | `1D`, `1F` | yes, 2-way | `1B` |
| 3 | `1G` | no | `1D` + `1F` |
| gate | — | — | `1G` |
| 4 | `feat/api-organizations`, `-boards`, `-lists`, `-cards`, (`-deploy` if not done in phase 1) | yes, 4-5 way | gate passed |
| 5 | FE `is_owner` reconciliation | no (small) | `feat/api-organizations` |
| 6 | Playwright e2e | tbd | Phase 4 + 5 done |
