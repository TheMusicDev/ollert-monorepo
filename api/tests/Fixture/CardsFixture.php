<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Cards fixture, added by `feat/api-cards` for `CardsControllerTest`. See
 * `ListsFixture`/`BoardsFixture` for the ancestry these belong to.
 *
 * - Card One (To Do, Board One): the main target for rename/reorder/
 *   cross-list-move edit tests and the delete test.
 * - Card Two (In Progress, Board One): a second row so Board One's own
 *   card count isn't zero/one in ways that could mask a counting bug.
 * - Trashed Card (To Do, Board One, soft-deleted): the 404 case for
 *   `PATCH`/`DELETE /api/cards/:id` against a nonexistent/soft-deleted card.
 * - Quota Card A / Quota Card B (Quota List A / Quota List B — different
 *   lists, same Quota Board): with the Quota Board owner's
 *   `max_cards_per_board` at 2 (`UsersFixture`), these two rows alone put
 *   the board at quota — split across both lists so a per-list (rather than
 *   board-wide) count would wrongly read as under quota.
 */
class CardsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '70000000-0000-4000-8000-000000000001',
            'list_id' => '60000000-0000-4000-8000-000000000001',
            'title' => 'Card One',
            'description' => 'Original description',
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000002',
            'list_id' => '60000000-0000-4000-8000-000000000002',
            'title' => 'Card Two',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000003',
            'list_id' => '60000000-0000-4000-8000-000000000001',
            'title' => 'Trashed Card',
            'description' => null,
            'due_date' => null,
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => '2026-01-02 00:00:00',
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000101',
            'list_id' => '60000000-0000-4000-8000-000000000004',
            'title' => 'Quota Card A',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000102',
            'list_id' => '60000000-0000-4000-8000-000000000005',
            'title' => 'Quota Card B',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
