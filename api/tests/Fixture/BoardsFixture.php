<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture. Seven boards across two orgs:
 *
 * - Org `...0001` ("Acme Org", owner: `UsersFixture`'s "owner", whose
 *   `max_boards_per_org` is 3): "Board One" (`...0001`), "Board Two"
 *   (`...0002`), "Board Three" (`...0003`) — deliberately exactly at that
 *   org's board quota, so `BoardsControllerTest` can exercise the 422
 *   `quota_exceeded` path directly against seed data (the same pattern
 *   `OrganizationsFixture`/`UsersFixture` use for the "poweruser" org-quota
 *   case). "Board One" is pre-seeded (via `ListsFixture`/`CardsFixture`)
 *   with two lists — one with two cards — for `BoardsController::view()`'s
 *   nested-response assertions, plus one soft-deleted list and one
 *   soft-deleted card (`CardsControllerTest`'s 404-on-trashed-parent cases
 *   — invisible to that nested response and to any other count assertion,
 *   since `Muffin/Trash` excludes soft-deleted rows from every default
 *   `find()`, including through `contain()`). These three boards also back
 *   `OrganizationsControllerTest`'s `GET /api/orgs/:id` boards-containment
 *   assertion (it asserts the full 3-board set nested under Acme Org rather
 *   than seeding its own board, to avoid disturbing this org's
 *   `max_boards_per_org`-pinned quota count).
 *
 * - Org `...0002` ("Power Org One", owner: "poweruser"): deliberately kept
 *   board-*less* here — `BoardsControllerTest::
 *   testAddAsOrgOwnerUnderQuotaSucceeds()` asserts exactly one board exists
 *   for this org *after* it POSTs a new one, so nothing else may ever add a
 *   fixture row under it.
 *
 * - Org `...0003` ("Power Org Two", owner: "poweruser" — otherwise unused by
 *   any board-count assertion, which is why `ListsControllerTest`'s boards
 *   live here rather than under `...0001`, whose board count is pinned at
 *   exactly 3 above): "Quota Board" (`...0004`, pre-seeded via
 *   `ListsFixture` with exactly `max_lists_per_board` (5) lists, so
 *   `POST .../lists` against it always hits the quota-exceeded path —
 *   every fixture user has the same `max_lists_per_board`, so the org
 *   owner not being "owner"/"member" doesn't matter for that check), "Empty
 *   Board" (`...0005`, no lists — the `position` bootstraps-to-`1.0` case),
 *   "Standard Board" (`...0006`, pre-seeded with one list, for
 *   rename/reposition/delete/authorization coverage that doesn't care about
 *   quota state), and "Card Quota Board" (`...0007`, added by
 *   `feat/api-cards` — pre-seeded via `ListsFixture`/`CardsFixture` with
 *   two lists carrying one card each, exactly at "poweruser"'s
 *   `max_cards_per_board` of 2, for `CardsControllerTest`'s board-wide card
 *   quota case; also doubles as the source board for its cross-org-move
 *   403 case, since "poweruser" — unlike "owner"/"member" — has no
 *   relationship to Acme Org at all). `OrgMembersFixture` grants "owner"
 *   and "member" explicit membership on this org so `ListsControllerTest`
 *   can authenticate as either, and `CardsControllerTest` reuses that same
 *   membership for "member"'s access to "Card Quota Board".
 */
class BoardsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '50000000-0000-4000-8000-000000000001',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Board One',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000002',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Board Two',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000003',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Board Three',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000004',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'title' => 'Quota Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000005',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'title' => 'Empty Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000006',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'title' => 'Standard Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000007',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'title' => 'Card Quota Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
