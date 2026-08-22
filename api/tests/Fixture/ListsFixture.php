<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Lists fixture, added by `feat/api-cards` for `CardsControllerTest`. See
 * `BoardsFixture` for the board/org ancestry these belong to.
 *
 * - To Do / In Progress (Board One): the two lists cards move between for
 *   the same-board cross-list-move test.
 * - Board Two List (Board Two, a different org): the cross-org move-denied
 *   target.
 * - Quota List A / Quota List B (Quota Board): split across two lists so
 *   the board-wide quota count (planning/data-model.md#quotas) is proven to
 *   span every list on the board, not just the one being posted to.
 * - Trashed List (Board One, soft-deleted): the 404 case for `POST
 *   /api/lists/:id/cards` against a nonexistent/soft-deleted parent list.
 */
class ListsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '60000000-0000-4000-8000-000000000001',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'To Do',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000002',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'In Progress',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000003',
            'board_id' => '50000000-0000-4000-8000-000000000002',
            'title' => 'Board Two List',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000004',
            'board_id' => '50000000-0000-4000-8000-000000000003',
            'title' => 'Quota List A',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000005',
            'board_id' => '50000000-0000-4000-8000-000000000003',
            'title' => 'Quota List B',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000006',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'Trashed List',
            'position' => 3.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => '2026-01-02 00:00:00',
        ],
    ];
}
