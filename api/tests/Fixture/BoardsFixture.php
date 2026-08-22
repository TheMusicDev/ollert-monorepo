<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture. Six boards across two orgs:
 *
 * - Org `...0001` ("Acme Org", owner: `UsersFixture`'s "owner", whose
 *   `max_boards_per_org` is 3): "Board One" (`...0001`), "Board Two"
 *   (`...0002`), "Board Three" (`...0003`) — deliberately exactly at that
 *   org's board quota, so `BoardsControllerTest` can exercise the 422
 *   `quota_exceeded` path directly against seed data (the same pattern
 *   `OrganizationsFixture`/`UsersFixture` use for the "poweruser" org-quota
 *   case). "Board One" is pre-seeded (via `ListsFixture`/`CardsFixture`)
 *   with two lists — one with two cards — for `BoardsController::view()`'s
 *   nested-response assertions.
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
 *   quota state). `OrgMembersFixture` grants "owner" and "member" explicit
 *   membership on this org so `ListsControllerTest` can authenticate as
 *   either.
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
    ];
}
