<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Users fixture. Three rows covering the org-membership/quota test scenarios
 * shared across F's helpers: an org owner, an explicit (non-owner) member,
 * and an outsider with no relation to the fixture org. A fourth "power user"
 * row covers the over-quota case, and (added by `feat/api-cards`) also
 * carries a deliberately low `max_cards_per_board` (2) — reusing this row
 * (rather than adding a fifth) avoids growing `OrganizationsFixture`'s row
 * count, which `PaginationComponentTest` asserts against directly; see
 * tests/Fixture/{Boards,Lists,Cards}Fixture.php for the board-wide card
 * quota case this enables, built on this user's "Card Quota Board" — a
 * separate board under their existing "Power Org Two", not one of that
 * org's other (list-quota-focused) boards. Table schema comes from the
 * migrated test DB (see
 * config/Migrations/20260821203724_CreateUsers.php); other tests (e.g.
 * AuthMiddlewareTest) insert whatever additional rows they need via
 * `UsersTable::findOrCreate()`/`save()` directly, scoped by their own
 * randomly generated `supabase_uid`, so they don't collide with these seed
 * rows.
 */
class UsersFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '10000000-0000-4000-8000-000000000001',
            'supabase_uid' => '20000000-0000-4000-8000-000000000001',
            'email' => 'owner@example.com',
            'display_name' => 'Org Owner',
            'max_orgs' => 1,
            'max_boards_per_org' => 3,
            'max_lists_per_board' => 5,
            'max_cards_per_board' => 100,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '10000000-0000-4000-8000-000000000002',
            'supabase_uid' => '20000000-0000-4000-8000-000000000002',
            'email' => 'member@example.com',
            'display_name' => 'Org Member',
            'max_orgs' => 1,
            'max_boards_per_org' => 3,
            'max_lists_per_board' => 5,
            'max_cards_per_board' => 100,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '10000000-0000-4000-8000-000000000003',
            'supabase_uid' => '20000000-0000-4000-8000-000000000003',
            'email' => 'outsider@example.com',
            'display_name' => 'Outsider',
            'max_orgs' => 1,
            'max_boards_per_org' => 3,
            'max_lists_per_board' => 5,
            'max_cards_per_board' => 100,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            // Owns two orgs against a max_orgs of 1 — QuotaServiceTest's
            // "over quota" (count > limit, not just count == limit) case.
            // Also the card-quota owner for CardsControllerTest (see above):
            // max_cards_per_board of 2, against "Card Quota Board" under
            // "Power Org Two".
            'id' => '10000000-0000-4000-8000-000000000004',
            'supabase_uid' => '20000000-0000-4000-8000-000000000004',
            'email' => 'poweruser@example.com',
            'display_name' => 'Power User',
            'max_orgs' => 1,
            'max_boards_per_org' => 3,
            'max_lists_per_board' => 5,
            'max_cards_per_board' => 2,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
