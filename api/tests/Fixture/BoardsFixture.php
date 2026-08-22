<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture, added by `feat/api-cards` for `CardsControllerTest` (this
 * branch owns `CardsController` only, not `BoardsController` — these rows
 * exist purely to give cards a realistic org-scoped ancestry chain to
 * resolve authorization/quota through).
 *
 * - Board One (org 1, "Acme Org" — owner `10...01`, explicit member
 *   `10...02`): the main board used for add/edit/delete happy-path and
 *   authorization tests.
 * - Board Two (org 2, "Power Org One" — owner `10...04`, no explicit
 *   members): used as a cross-org move target `10...02` must be denied
 *   access to.
 * - Quota Board (org 3, "Power Org Two" — owner `10...04` with
 *   `max_cards_per_board` lowered to 2, explicit member `10...02`): used
 *   for the board-wide card quota case.
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
            'org_id' => '30000000-0000-4000-8000-000000000002',
            'title' => 'Board Two',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000003',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'title' => 'Quota Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
