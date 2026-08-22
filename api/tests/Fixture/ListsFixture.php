<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Lists fixture, covering both `BoardsControllerTest` and
 * `ListsControllerTest` — see `BoardsFixture`'s docblock for the full board
 * layout these rows sit on.
 *
 * - Two lists ("To Do", "Done") on "Board One" (`BoardsFixture`'s
 *   `50000000-...-0001`), giving `BoardsControllerTest` fixed, ordered
 *   (`position`) nested data to assert on for `BoardsController::view()`'s
 *   unpaginated nested lists+cards response ("To Do" carries
 *   `CardsFixture`'s two cards).
 * - Five lists ("List 1".."List 5") on "Quota Board" (`...0004`), exactly
 *   filling `max_lists_per_board` (5, see `UsersFixture`) so
 *   `ListsControllerTest`'s quota-exceeded test has a ready-made
 *   "already at quota" board.
 * - One list ("To Do") on "Standard Board" (`...0006`), backing
 *   `ListsControllerTest`'s rename/reposition/delete/authorization tests.
 * - "Empty Board" (`...0005`) deliberately has no rows here — that's
 *   `ListsControllerTest`'s position-bootstraps-to-`1.0` case.
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
            'title' => 'Done',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000003',
            'board_id' => '50000000-0000-4000-8000-000000000004',
            'title' => 'List 1',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000004',
            'board_id' => '50000000-0000-4000-8000-000000000004',
            'title' => 'List 2',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000005',
            'board_id' => '50000000-0000-4000-8000-000000000004',
            'title' => 'List 3',
            'position' => 3.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000006',
            'board_id' => '50000000-0000-4000-8000-000000000004',
            'title' => 'List 4',
            'position' => 4.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000007',
            'board_id' => '50000000-0000-4000-8000-000000000004',
            'title' => 'List 5',
            'position' => 5.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000008',
            'board_id' => '50000000-0000-4000-8000-000000000006',
            'title' => 'To Do',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
