<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * OrgMembers fixture. A single explicit membership row for the "member" user
 * (UsersFixture) on the fixture org (OrganizationsFixture) — deliberately
 * does *not* include a row for the owner, since
 * App\Service\OrgAuthorizationService::isOrgMember() must recognize the
 * owner via `organizations.owner_id` without needing one.
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
    ];
}
