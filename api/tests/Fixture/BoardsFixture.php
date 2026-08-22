<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture. Three boards under the fixture org
 * (`OrganizationsFixture`'s `30000000-...-0001`, owned by the "owner" user in
 * `UsersFixture`, whose `max_boards_per_org` is 3) — deliberately exactly at
 * that quota, so `BoardsControllerTest` can exercise the 422 `quota_exceeded`
 * path directly against seed data, the same pattern
 * `OrganizationsFixture`/`UsersFixture` use for the "poweruser" org-quota
 * case.
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
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Board Two',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '50000000-0000-4000-8000-000000000003',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Board Three',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
