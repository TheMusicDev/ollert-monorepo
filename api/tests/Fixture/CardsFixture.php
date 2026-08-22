<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Cards fixture.
 *
 * - Two cards ("Card A", "Card B") under "To Do" (`ListsFixture`'s
 *   `60000000-...-0001`, on "Board One"), giving `BoardsControllerTest`
 *   fixed, ordered (`position`) nested data two levels deep to assert on
 *   for `BoardsController::view()`'s unpaginated nested lists+cards
 *   response. `CardsControllerTest` reuses both directly for its
 *   edit/reorder/same-org-move/delete coverage, rather than adding its own
 *   active cards here — Acme Org's board/list/card counts are pinned
 *   exactly by already-merged tests.
 * - One soft-deleted card ("Trashed Card", `...0003`) also on "To Do" —
 *   `CardsControllerTest`'s 404-for-a-trashed-card case. Invisible to
 *   `BoardsControllerTest`'s `assertCount(2, $board['lists'][0]['cards'])`
 *   and to any other default `find()`, since `Muffin/Trash` filters
 *   soft-deleted rows out unless a caller explicitly asks for them.
 * - "Quota Card A" / "Quota Card B" (`...0004`/`0005`) on "Card Quota List
 *   A" / "Card Quota List B" (`ListsFixture`'s `...0010`/`0011`, both on
 *   "Card Quota Board") — with that board's owner ("poweruser")
 *   `max_cards_per_board` at 2 (`UsersFixture`), these two rows alone put
 *   the board at quota, split across both lists so a per-list (rather than
 *   board-wide) count would wrongly read as under quota. "Quota Card A" is
 *   also `CardsControllerTest`'s source card for the cross-org-move 403
 *   case: "poweruser" owns "Card Quota Board"'s org but has no relationship
 *   to Acme Org, so moving this card into a Board One list must be denied.
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
            'title' => 'Card A',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000002',
            'list_id' => '60000000-0000-4000-8000-000000000001',
            'title' => 'Card B',
            'description' => null,
            'due_date' => null,
            'position' => 2.0,
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
            'position' => 3.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => '2026-01-02 00:00:00',
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000004',
            'list_id' => '60000000-0000-4000-8000-000000000010',
            'title' => 'Quota Card A',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000005',
            'list_id' => '60000000-0000-4000-8000-000000000011',
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
