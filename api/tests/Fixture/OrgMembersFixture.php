<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * OrgMembers fixture.
 *
 * - A single explicit membership row for the "member" user (UsersFixture) on
 *   the fixture org (OrganizationsFixture's `...0001`, "Acme Org") —
 *   deliberately does *not* include a row for the owner, since
 *   App\Service\OrgAuthorizationService::isOrgMember() must recognize the
 *   owner via `organizations.owner_id` without needing one.
 * - Explicit rows granting "owner" and "member" membership on
 *   `...0003` ("Power Org Two", owned by "poweruser") — that org hosts
 *   `ListsControllerTest`'s "Quota"/"Empty"/"Standard" boards (see
 *   `BoardsFixture`'s docblock for why they can't live under `...0001`), so
 *   both users need an explicit row there to be recognized as members
 *   despite neither owning it.
 */
class OrgMembersFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '40000000-0000-4000-8000-000000000001',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'user_id' => '10000000-0000-4000-8000-000000000002',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '40000000-0000-4000-8000-000000000002',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'user_id' => '10000000-0000-4000-8000-000000000001',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '40000000-0000-4000-8000-000000000003',
            'org_id' => '30000000-0000-4000-8000-000000000003',
            'user_id' => '10000000-0000-4000-8000-000000000002',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
