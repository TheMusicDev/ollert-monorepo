<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Lists fixture, covering `BoardsControllerTest`, `ListsControllerTest`,
 * and `CardsControllerTest` — see `BoardsFixture`'s docblock for the full
 * board layout these rows sit on.
 *
 * - Two lists ("To Do", "Done") on "Board One" (`BoardsFixture`'s
 *   `50000000-...-0001`), giving `BoardsControllerTest` fixed, ordered
 *   (`position`) nested data to assert on for `BoardsController::view()`'s
 *   unpaginated nested lists+cards response ("To Do" carries
 *   `CardsFixture`'s two cards). `CardsControllerTest` reuses both of these
 *   directly (rather than adding its own active lists here) for its
 *   add/edit/reorder/same-org-move coverage, since Acme Org's board/list/
 *   card counts are pinned exactly by already-merged tests.
 * - Five lists ("List 1".."List 5") on "Quota Board" (`...0004`), exactly
 *   filling `max_lists_per_board` (5, see `UsersFixture`) so
 *   `ListsControllerTest`'s quota-exceeded test has a ready-made
 *   "already at quota" board.
 * - One list ("To Do") on "Standard Board" (`...0006`), backing
 *   `ListsControllerTest`'s rename/reposition/delete/authorization tests.
 * - "Empty Board" (`...0005`) deliberately has no rows here — that's
 *   `ListsControllerTest`'s position-bootstraps-to-`1.0` case.
 * - One soft-deleted list ("Trashed List", `...0009`) on "Board One" —
 *   `CardsControllerTest`'s 404-for-a-trashed-parent-list case. Invisible
 *   to `BoardsControllerTest`'s `assertCount(2, $board['lists'])` and to
 *   any other default `find()`, since `Muffin/Trash` filters soft-deleted
 *   rows out unless a caller explicitly asks for them (`find('withTrashed')`
 *   / `find('onlyTrashed')`).
 * - Two lists ("Card Quota List A", "Card Quota List B", `...0010`/`0011`)
 *   on "Card Quota Board" (`...0007`) — `CardsControllerTest`'s board-wide
 *   card quota case, split across two lists so the count is proven to span
 *   every list on the board (planning/data-model.md#quotas), not just the
 *   one being posted to.
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
        [
            'id' => '60000000-0000-4000-8000-000000000009',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'Trashed List',
            'position' => 3.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => '2026-01-02 00:00:00',
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000010',
            'board_id' => '50000000-0000-4000-8000-000000000007',
            'title' => 'Card Quota List A',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000011',
            'board_id' => '50000000-0000-4000-8000-000000000007',
            'title' => 'Card Quota List B',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
