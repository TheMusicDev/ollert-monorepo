<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Integration tests for `App\Controller\OrganizationsController`
 * (planning/api-contract.md#organizations), through the real routed HTTP
 * stack (`IntegrationTestTrait`) and real `App\Middleware\AuthMiddleware`
 * (see `AuthenticatedRequestTrait`), against the seeded fixtures:
 * `UsersFixture` (owner/member/outsider/poweruser),
 * `OrganizationsFixture` ("Acme Org" owned by owner; two "Power Org" rows
 * owned by poweruser, whose `max_orgs` is 1 — the over-quota case),
 * `OrgMembersFixture` (member is an explicit member of Acme Org), and
 * `BoardsFixture` (one board under Acme Org, for the `view` containment
 * assertion).
 */
class OrganizationsControllerTest extends TestCase
{
    use AuthenticatedRequestTrait;
    use IntegrationTestTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations', 'app.OrgMembers', 'app.Boards'];

    private const OWNER_ID = '10000000-0000-4000-8000-000000000001';

    private const OWNER_SUB = '20000000-0000-4000-8000-000000000001';

    private const OWNER_EMAIL = 'owner@example.com';

    private const MEMBER_ID = '10000000-0000-4000-8000-000000000002';

    private const MEMBER_SUB = '20000000-0000-4000-8000-000000000002';

    private const MEMBER_EMAIL = 'member@example.com';

    private const OUTSIDER_ID = '10000000-0000-4000-8000-000000000003';

    private const OUTSIDER_SUB = '20000000-0000-4000-8000-000000000003';

    private const OUTSIDER_EMAIL = 'outsider@example.com';

    private const POWERUSER_SUB = '20000000-0000-4000-8000-000000000004';

    private const POWERUSER_EMAIL = 'poweruser@example.com';

    private const ACME_ORG_ID = '30000000-0000-4000-8000-000000000001';

    private const POWER_ORG_ONE_ID = '30000000-0000-4000-8000-000000000002';

    private const POWER_ORG_TWO_ID = '30000000-0000-4000-8000-000000000003';

    private const NONEXISTENT_ID = '30000000-0000-4000-8000-00000000ffff';

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

    public function testIndexReturnsOwnedAndMemberOrgsWithCorrectIsOwner(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->get('/api/orgs');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertCount(1, $body['data']);
        $this->assertSame(self::ACME_ORG_ID, $body['data'][0]['id']);
        $this->assertTrue($body['data'][0]['is_owner']);
        $this->assertSame(['page' => 1, 'limit' => 20, 'total' => 1, 'totalPages' => 1], $body['meta']);
    }

    public function testIndexIncludesOrgsWhereUserIsAnExplicitMemberWithIsOwnerFalse(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->get('/api/orgs');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertCount(1, $body['data']);
        $this->assertSame(self::ACME_ORG_ID, $body['data'][0]['id']);
        $this->assertFalse($body['data'][0]['is_owner']);
    }

    public function testIndexExcludesOrgsForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->get('/api/orgs');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame([], $body['data']);
        $this->assertSame(0, $body['meta']['total']);
    }

    public function testIndexPaginatesAcrossMultipleOwnedOrgs(): void
    {
        $this->authenticateAs(self::POWERUSER_SUB, self::POWERUSER_EMAIL);
        $this->get('/api/orgs?page=1&limit=1');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertCount(1, $body['data']);
        $this->assertSame(['page' => 1, 'limit' => 1, 'total' => 2, 'totalPages' => 2], $body['meta']);
        $firstPageId = $body['data'][0]['id'];

        // `configRequest()`'s `headers` are consumed (unset) by
        // `IntegrationTestTrait` after each request is built
        // (`_buildRequest()`), so the Authorization header must be
        // reattached before every request, not once per test.
        $this->authenticateAs(self::POWERUSER_SUB, self::POWERUSER_EMAIL);
        $this->get('/api/orgs?page=2&limit=1');
        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertCount(1, $body['data']);
        $secondPageId = $body['data'][0]['id'];

        $this->assertNotSame($firstPageId, $secondPageId);
        $this->assertSame(
            [self::POWER_ORG_ONE_ID, self::POWER_ORG_TWO_ID],
            $this->sortedIds([$firstPageId, $secondPageId]),
        );
    }

    // --- add ------------------------------------------------------------

    public function testAddCreatesOrgOwnedByTheCreator(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->post('/api/orgs', ['name' => 'New Org']);

        $this->assertResponseCode(201);
        $body = $this->decodeBody();
        $this->assertSame('New Org', $body['name']);
        $this->assertSame(self::OUTSIDER_ID, $body['owner_id']);
        $this->assertTrue($body['is_owner']);

        $this->assertSame(
            1,
            $this->fetchTable('Organizations')->find()->where(['owner_id' => self::OUTSIDER_ID])->count(),
        );
    }

    public function testAddFailsWith422WhenAtMaxOrgsQuota(): void
    {
        // Owner already owns Acme Org against a max_orgs of 1.
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->post('/api/orgs', ['name' => 'One Too Many']);

        $this->assertResponseCode(422);
        $body = $this->decodeBody();
        $this->assertSame('quota_exceeded', $body['error']['code']);
    }

    public function testAddFailsValidationWhenNameMissing(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->post('/api/orgs', []);

        $this->assertResponseCode(422);
        $body = $this->decodeBody();
        $this->assertArrayHasKey('name', $body['error']['fields'] ?? []);
    }

    // --- view -----------------------------------------------------------

    public function testViewReturnsOrgWithBoardsAndIsOwnerForOwner(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame(self::ACME_ORG_ID, $body['id']);
        $this->assertTrue($body['is_owner']);
        $this->assertCount(1, $body['boards']);
        $this->assertSame('Launch Board', $body['boards'][0]['title']);
    }

    public function testViewReturnsIsOwnerFalseForAMember(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertFalse($body['is_owner']);
    }

    public function testViewIsForbiddenForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->get('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseCode(403);
        $body = $this->decodeBody();
        $this->assertSame('not_org_member', $body['error']['code']);
    }

    public function testViewIsNotFoundForANonexistentOrg(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->get('/api/orgs/' . self::NONEXISTENT_ID);

        $this->assertResponseCode(404);
        $body = $this->decodeBody();
        $this->assertSame('not_found', $body['error']['code']);
    }

    // --- edit -------------------------------------------------------------

    public function testEditAllowsOwnerToRename(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->patch('/api/orgs/' . self::ACME_ORG_ID, ['name' => 'Acme Renamed']);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame('Acme Renamed', $body['name']);
    }

    public function testEditAllowsMemberToRename(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->patch('/api/orgs/' . self::ACME_ORG_ID, ['name' => 'Renamed By Member']);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame('Renamed By Member', $body['name']);
    }

    public function testEditIsForbiddenForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->patch('/api/orgs/' . self::ACME_ORG_ID, ['name' => 'Hijacked']);

        $this->assertResponseCode(403);
    }

    public function testEditFailsValidationWhenNameIsBlank(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->patch('/api/orgs/' . self::ACME_ORG_ID, ['name' => '']);

        $this->assertResponseCode(422);
    }

    // --- delete ------------------------------------------------------------

    public function testDeleteAllowsOwner(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseCode(204);
        $this->assertNull(
            $this->fetchTable('Organizations')->find()->where(['id' => self::ACME_ORG_ID])->first(),
        );
        $trashed = $this->fetchTable('Organizations')->find('withTrashed')
            ->where(['id' => self::ACME_ORG_ID])
            ->firstOrFail();
        $this->assertNotNull($trashed->deleted);
    }

    public function testDeleteIsForbiddenForAMember(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseCode(403);
        $this->assertNotNull(
            $this->fetchTable('Organizations')->find()->where(['id' => self::ACME_ORG_ID])->first(),
        );
    }

    public function testDeleteIsForbiddenForAnOutsider(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);
        $this->delete('/api/orgs/' . self::ACME_ORG_ID);

        $this->assertResponseCode(403);
    }

    public function testDeleteIsNotFoundForANonexistentOrg(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);
        $this->delete('/api/orgs/' . self::NONEXISTENT_ID);

        $this->assertResponseCode(404);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeBody(): array
    {
        return (array)json_decode((string)$this->_response->getBody(), true);
    }

    /**
     * @param array<string> $ids Ids to sort.
     * @return array<string>
     */
    private function sortedIds(array $ids): array
    {
        sort($ids);

        return $ids;
    }
}
