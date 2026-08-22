<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture, minimal for `feat/api-lists` (ListsControllerTest) —
 * `feat/api-boards` (running concurrently) may add its own richer fixture
 * later; a merge conflict on this file is expected/cheap, per
 * be-tasks.md's `feat/api-lists` entry.
 *
 * All three boards belong to `OrganizationsFixture`'s "Acme Org"
 * (`30000000-0000-4000-8000-000000000001`, owned by `UsersFixture`'s
 * "owner@example.com", member "member@example.com" via `OrgMembersFixture`):
 *
 * - "Quota Board": pre-seeded (via `ListsFixture`) with exactly
 *   `max_lists_per_board` (5) lists, so `POST .../lists` against it always
 *   hits the quota-exceeded path.
 * - "Empty Board": no lists — the `position` bootstraps-to-`1.0` case.
 * - "Standard Board": pre-seeded with one list, for rename/reposition/
 *   delete/authorization coverage that doesn't care about quota state.
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
            'title' => 'Quota Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000002',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Empty Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000003',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Standard Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
