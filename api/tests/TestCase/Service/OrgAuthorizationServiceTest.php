<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Service\OrgAuthorizationService;
use Cake\TestSuite\TestCase;

/**
 * Tests for App\Service\OrgAuthorizationService against the real Table
 * classes (fixtures in tests/Fixture/{Users,Organizations,OrgMembers}Fixture.php).
 *
 * Fixture shape:
 * - Org `30000000-...-01` is owned by user `10000000-...-01` ("owner").
 * - User `10000000-...-02` ("member") has an explicit `org_members` row for
 *   that org, but is NOT the owner.
 * - User `10000000-...-03` ("outsider") has no relation to the org at all.
 * - The owner deliberately has no explicit `org_members` row — this is what
 *   proves isOrgMember() recognizes ownership on its own, per the class's
 *   documented convention.
 */
class OrgAuthorizationServiceTest extends TestCase
{
    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations', 'app.OrgMembers'];

    private const ORG_ID = '30000000-0000-4000-8000-000000000001';

    private const OWNER_ID = '10000000-0000-4000-8000-000000000001';

    private const MEMBER_ID = '10000000-0000-4000-8000-000000000002';

    private const OUTSIDER_ID = '10000000-0000-4000-8000-000000000003';

    private const NONEXISTENT_ORG_ID = '30000000-0000-4000-8000-000000000099';

    private OrgAuthorizationService $service;

    /**
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new OrgAuthorizationService();
    }

    /**
     * @return void
     */
    public function testOwnerIsOrgOwner(): void
    {
        $this->assertTrue($this->service->isOrgOwner(self::OWNER_ID, self::ORG_ID));
    }

    /**
     * @return void
     */
    public function testMemberIsNotOrgOwner(): void
    {
        $this->assertFalse($this->service->isOrgOwner(self::MEMBER_ID, self::ORG_ID));
    }

    /**
     * @return void
     */
    public function testOutsiderIsNotOrgOwner(): void
    {
        $this->assertFalse($this->service->isOrgOwner(self::OUTSIDER_ID, self::ORG_ID));
    }

    /**
     * The owner has no explicit `org_members` row in the fixture — this
     * asserts isOrgMember() still recognizes them via `owner_id`.
     *
     * @return void
     */
    public function testOwnerIsOrgMemberWithoutExplicitRow(): void
    {
        $this->assertTrue($this->service->isOrgMember(self::OWNER_ID, self::ORG_ID));
    }

    /**
     * @return void
     */
    public function testExplicitMemberIsOrgMember(): void
    {
        $this->assertTrue($this->service->isOrgMember(self::MEMBER_ID, self::ORG_ID));
    }

    /**
     * @return void
     */
    public function testOutsiderIsNotOrgMember(): void
    {
        $this->assertFalse($this->service->isOrgMember(self::OUTSIDER_ID, self::ORG_ID));
    }

    /**
     * @return void
     */
    public function testNonexistentOrgIsNeitherOwnedNorMembered(): void
    {
        $this->assertFalse($this->service->isOrgOwner(self::OWNER_ID, self::NONEXISTENT_ORG_ID));
        $this->assertFalse($this->service->isOrgMember(self::OWNER_ID, self::NONEXISTENT_ORG_ID));
    }
}
