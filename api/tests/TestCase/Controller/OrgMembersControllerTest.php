<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Integration tests for `App\Controller\OrgMembersController`
 * (planning/api-contract.md#org-members), through the real routed HTTP
 * stack (`IntegrationTestTrait`) and real `App\Middleware\AuthMiddleware`
 * (see `AuthenticatedRequestTrait`), against the same fixtures as
 * `OrganizationsControllerTest`: `UsersFixture`
 * (owner/member/outsider/poweruser), `OrganizationsFixture` ("Acme Org"
 * owned by owner), and `OrgMembersFixture` (member is an explicit member of
 * Acme Org; owner is only an implicit member via `owner_id`, no explicit row
 * — see `App\Service\OrgAuthorizationService`'s docblock).
 */
class OrgMembersControllerTest extends TestCase
{
    use AuthenticatedRequestTrait;
    use IntegrationTestTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations', 'app.OrgMembers', 'app.AuditLogs'];

    private const OWNER_SUB = '20000000-0000-4000-8000-000000000001';

    private const OWNER_EMAIL = 'owner@example.com';

    private const MEMBER_ID = '10000000-0000-4000-8000-000000000002';

    private const MEMBER_SUB = '20000000-0000-4000-8000-000000000002';

    private const MEMBER_EMAIL = 'member@example.com';

    private const OUTSIDER_ID = '10000000-0000-4000-8000-000000000003';

    private const OUTSIDER_SUB = '20000000-0000-4000-8000-000000000003';

    private const OUTSIDER_EMAIL = 'outsider@example.com';

    private const ACME_ORG_ID = '30000000-0000-4000-8000-000000000001';

    private const NONEXISTENT_ORG_ID = '30000000-0000-4000-8000-00000000ffff';

    private const MEMBERSHIP_ROW_ID = '40000000-0000-4000-8000-000000000001';

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpJwtAuth();
    }

    protected function tearDown(): void
    {
        $this->tearDownJwtAuth();
        parent::tearDown();
    }

    // --- index --------------------------------------------------------

    public function testIndexListsMembersForAnOrgMember(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID . '/members');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertCount(1, $body['data']);
        $this->assertSame(self::MEMBER_ID, $body['data'][0]['user_id']);
        $this->assertSame(self::MEMBER_EMAIL, $body['data'][0]['user']['email']);
        $this->assertSame(['page' => 1, 'limit' => 20, 'total' => 1, 'totalPages' => 1], $body['meta']);
    }

    public function testIndexAllowsTheImplicitOwnerMember(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID . '/members');

        $this->assertResponseOk();
    }

    public function testIndexIsForbiddenForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID . '/members');

        $this->assertResponseCode(403);
        $body = $this->decodeBody();
        $this->assertSame('not_org_member', $body['error']['code']);
    }

    public function testIndexIsNotFoundForANonexistentOrg(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->get('/api/orgs/' . self::NONEXISTENT_ORG_ID . '/members');

        $this->assertResponseCode(404);
    }

    // --- add ------------------------------------------------------------

    public function testAddAddsAnExistingUserByEmail(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->post('/api/orgs/' . self::ACME_ORG_ID . '/members', ['email' => self::OUTSIDER_EMAIL]);

        $this->assertResponseCode(201);
        $body = $this->decodeBody();
        $this->assertSame(self::OUTSIDER_ID, $body['user_id']);
        $this->assertSame(self::OUTSIDER_EMAIL, $body['user']['email']);

        $this->assertSame(
            1,
            $this->fetchTable('OrgMembers')
                ->find()
                ->where(['org_id' => self::ACME_ORG_ID, 'user_id' => self::OUTSIDER_ID])
                ->count(),
        );
    }

    public function testAddFailsWith422ForAnEmailWithNoAccount(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->post('/api/orgs/' . self::ACME_ORG_ID . '/members', ['email' => 'nobody@example.com']);

        $this->assertResponseCode(422);
        $body = $this->decodeBody();
        $this->assertSame('user_not_found', $body['error']['code']);
        $this->assertArrayHasKey('email', $body['error']['fields'] ?? []);
    }

    public function testAddFailsWhenTargetIsAlreadyAMember(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->post('/api/orgs/' . self::ACME_ORG_ID . '/members', ['email' => self::MEMBER_EMAIL]);

        $this->assertResponseCode(422);
    }

    public function testAddIsForbiddenForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->post('/api/orgs/' . self::ACME_ORG_ID . '/members', ['email' => self::OUTSIDER_EMAIL]);

        $this->assertResponseCode(403);
    }

    // --- delete ------------------------------------------------------------

    public function testDeleteAllowsOwnerToRemoveAnotherMember(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID . '/members/' . self::MEMBER_ID);

        $this->assertResponseCode(204);
        $this->assertNull(
            $this->fetchTable('OrgMembers')->find()->where(['id' => self::MEMBERSHIP_ROW_ID])->first(),
        );
    }

    public function testDeleteAllowsSelfRemoval(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID . '/members/' . self::MEMBER_ID);

        $this->assertResponseCode(204);
    }

    public function testDeleteIsForbiddenForANonOwnerRemovingSomeoneElse(): void
    {
        // Add outsider as a second explicit member first, then have `member`
        // (not the owner) try to remove them.
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->post('/api/orgs/' . self::ACME_ORG_ID . '/members', ['email' => self::OUTSIDER_EMAIL]);
        $this->assertResponseCode(201);

        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID . '/members/' . self::OUTSIDER_ID);

        $this->assertResponseCode(403);
        $this->assertSame(
            1,
            $this->fetchTable('OrgMembers')
                ->find()
                ->where(['org_id' => self::ACME_ORG_ID, 'user_id' => self::OUTSIDER_ID])
                ->count(),
        );
    }

    public function testDeleteIsNotFoundForANonMemberTarget(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID . '/members/' . self::OUTSIDER_ID);

        $this->assertResponseCode(404);
    }

    public function testDeleteIsNotFoundForANonexistentOrg(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->delete('/api/orgs/' . self::NONEXISTENT_ORG_ID . '/members/' . self::MEMBER_ID);

        $this->assertResponseCode(404);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeBody(): array
    {
        return (array)json_decode((string)$this->_response->getBody(), true);
    }
}
