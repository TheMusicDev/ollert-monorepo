<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Organizations fixture. A single org owned by the "owner" row in
 * UsersFixture — also doubles as the quota-check test's "at quota" case
 * (that user's `max_orgs` is 1, and this is their one org).
 */
class OrganizationsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '30000000-0000-4000-8000-000000000001',
            'owner_id' => '10000000-0000-4000-8000-000000000001',
            'name' => 'Acme Org',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        // Both owned by the "poweruser" fixture user (max_orgs: 1) — gives
        // QuotaServiceTest a count-of-2-against-limit-1 "over quota" case.
        [
            'id' => '30000000-0000-4000-8000-000000000002',
            'owner_id' => '10000000-0000-4000-8000-000000000004',
            'name' => 'Power Org One',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        // Owned by "poweruser", whose max_cards_per_board is 2
        // (UsersFixture) — CardsControllerTest's board-wide card quota case
        // is built on this org's "Card Quota Board" (see
        // tests/Fixture/{Boards,Lists,Cards}Fixture.php).
        [
            'id' => '30000000-0000-4000-8000-000000000003',
            'owner_id' => '10000000-0000-4000-8000-000000000004',
            'name' => 'Power Org Two',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
