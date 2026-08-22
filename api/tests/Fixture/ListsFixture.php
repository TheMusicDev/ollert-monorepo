<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Lists fixture for `ListsControllerTest`. Five lists on `BoardsFixture`'s
 * "Quota Board" (positions `1.0`..`5.0`) exactly fill the fixture org
 * owner's default `max_lists_per_board` (5, see `UsersFixture`), giving the
 * quota-exceeded test a ready-made "already at quota" board. One more list
 * on "Standard Board" backs the rename/reposition/delete/authorization
 * tests. "Empty Board" deliberately has no rows here — that's the
 * position-bootstraps-to-`1.0` case.
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
            'title' => 'List 1',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000002',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'List 2',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000003',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'List 3',
            'position' => 3.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000004',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'List 4',
            'position' => 4.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000005',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'List 5',
            'position' => 5.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000006',
            'board_id' => '50000000-0000-4000-8000-000000000003',
            'title' => 'To Do',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
