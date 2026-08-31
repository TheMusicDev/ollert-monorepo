<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Cache\Cache;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Integration tests for `App\Controller\ListsController`
 * (planning/api-contract.md#lists), exercised through the real middleware
 * queue (routing, CSRF, `App\Middleware\AuthMiddleware`) via
 * `IntegrationTestTrait`, against `BoardsFixture`/`ListsFixture` — see those
 * files' docblocks for the fixture layout this test relies on. The
 * "Quota"/"Empty"/"Standard" boards this test exercises live under org
 * `...0003` ("Power Org Two"), not the "Acme Org" (`...0001`) that
 * `BoardsControllerTest` uses — `BoardsFixture`'s docblock explains why.
 *
 * Authentication: each test signs a Supabase-shaped RS256 JWT for one of the
 * three `UsersFixture` rows relevant to org `...0003` — owner, explicit
 * member (both via `OrgMembersFixture` rows, since neither owns that org),
 * or outsider (no relation to it at all) — using the same throwaway-keypair
 * technique as `ApiBootstrapIntegrationTest`, so auth goes through the real
 * `AuthMiddleware`/`SupabaseJwksProvider`, not a mock. Using an existing
 * fixture user's `supabase_uid` as the JWT's `sub` means `AuthMiddleware`
 * finds that row instead of JIT-provisioning a new one, so the identity
 * lines up with `OrgMembersFixture`'s membership rows.
 */
class ListsControllerTest extends TestCase
{
    use IntegrationTestTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = [
        'app.Users',
        'app.Organizations',
        'app.OrgMembers',
        'app.Boards',
        'app.Lists',
        // `view` contains `Cards` (nested, unpaginated) — the table schema
        // must exist for that contain to query, even though Standard Board's
        // single list (`...000008`) has no card rows in `CardsFixture` (they
        // all live on Acme Org's "To Do" list), so the nested `cards` array
        // is empty here.
        'app.Cards',
        'app.AuditLogs',
    ];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'lists-controller-test-kid';

    private const OWNER_SUB = '20000000-0000-4000-8000-000000000001';

    private const OWNER_EMAIL = 'owner@example.com';

    private const MEMBER_SUB = '20000000-0000-4000-8000-000000000002';

    private const MEMBER_EMAIL = 'member@example.com';

    private const OUTSIDER_SUB = '20000000-0000-4000-8000-000000000003';

    private const OUTSIDER_EMAIL = 'outsider@example.com';

    private const QUOTA_BOARD_ID = '50000000-0000-4000-8000-000000000004';

    private const EMPTY_BOARD_ID = '50000000-0000-4000-8000-000000000005';

    private const STANDARD_BOARD_ID = '50000000-0000-4000-8000-000000000006';

    private const STANDARD_LIST_ID = '60000000-0000-4000-8000-000000000008';

    private string $privateKeyPem;

    /**
     * @var array<string, string|false>
     */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->enableCsrfToken();

        Cache::clear('jwks');
        $this->setEnv('SUPABASE_JWT_ISS', self::ISS);
        $this->setEnv('SUPABASE_JWT_AUD', self::AUD);

        [$this->privateKeyPem, $jwks] = $this->generateJwks();
        Cache::write('supabase_jwks', $jwks, 'jwks');
    }

    protected function tearDown(): void
    {
        Cache::clear('jwks');
        foreach ($this->originalEnv as $key => $value) {
            if ($value === false) {
                unset($_SERVER[$key]);
            } else {
                $_SERVER[$key] = $value;
            }
        }

        parent::tearDown();
    }

    // --- index / view (reads) --------------------------------------------

    public function testIndexReturnsPaginatedListsForBoardMember(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/boards/' . self::STANDARD_BOARD_ID . '/lists');

        $this->assertResponseOk();
        $body = $this->decodedBody();
        // Standard Board has exactly one list (ListsFixture: `...000008`).
        $this->assertSame(1, $body['meta']['total']);
        $this->assertCount(1, $body['data']);
        $this->assertSame('To Do', $body['data'][0]['title']);
        $this->assertSame(self::STANDARD_LIST_ID, $body['data'][0]['id']);
    }

    public function testViewReturnsListWithNestedCards(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/lists/' . self::STANDARD_LIST_ID);

        $this->assertResponseOk();
        $body = $this->decodedBody();
        $this->assertSame('To Do', $body['title']);
        $this->assertSame(self::STANDARD_BOARD_ID, $body['board_id']);
        // Standard Board's list has no card rows (see $fixtures comment), so
        // the nested `cards` key is an empty array — proving the contain
        // wired in `view` resolves without a separate request.
        $this->assertSame([], $body['cards']);
    }

    public function testIndexIsForbiddenForNonOrgMember(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->get('/api/boards/' . self::STANDARD_BOARD_ID . '/lists');

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodedBody()['error']['code']);
    }

    public function testViewOfTrashedListReturns404(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        // `...000009` is soft-deleted in ListsFixture; Muffin/Trash's
        // default finder filters it out before the org-membership check,
        // so this 404s as `not_found` regardless of the caller's org.
        $this->get('/api/lists/60000000-0000-4000-8000-000000000009');

        $this->assertResponseCode(404);
        $this->assertSame('not_found', $this->decodedBody()['error']['code']);
    }

    public function testIndexWithoutTokenIsUnauthorized(): void
    {
        $this->get('/api/boards/' . self::STANDARD_BOARD_ID . '/lists');

        $this->assertResponseCode(401);
    }

    // --- add ------------------------------------------------------------

    public function testAddOnEmptyBoardBootstrapsPositionToOne(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/boards/' . self::EMPTY_BOARD_ID . '/lists', ['title' => 'To Do']);

        $this->assertResponseCode(201);
        $body = $this->decodedBody();
        $this->assertSame('To Do', $body['title']);
        $this->assertSame(self::EMPTY_BOARD_ID, $body['board_id']);
        $this->assertSame(1.0, (float)$body['position']);
    }

    public function testAddAppendsAfterExistingMaxPosition(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/boards/' . self::STANDARD_BOARD_ID . '/lists', ['title' => 'In Progress']);

        $this->assertResponseCode(201);
        $body = $this->decodedBody();
        // Standard Board already has one list at position 1.0 (ListsFixture).
        $this->assertSame(2.0, (float)$body['position']);
    }

    public function testAddReturns422WhenBoardOwnerIsAtListQuota(): void
    {
        // Any org member's create attempt is checked against the *org
        // owner's* quota column, not the creator's own — use the member
        // here specifically to exercise that.
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/boards/' . self::QUOTA_BOARD_ID . '/lists', ['title' => 'One Too Many']);

        $this->assertResponseCode(422);
        $body = $this->decodedBody();
        $this->assertSame('quota_exceeded', $body['error']['code']);
    }

    public function testAddIsForbiddenForNonOrgMember(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->post('/api/boards/' . self::EMPTY_BOARD_ID . '/lists', ['title' => 'Nope']);

        $this->assertResponseCode(403);
        $body = $this->decodedBody();
        $this->assertSame('not_org_member', $body['error']['code']);
    }

    public function testAddRequiresAuthentication(): void
    {
        $this->post('/api/boards/' . self::EMPTY_BOARD_ID . '/lists', ['title' => 'Nope']);

        $this->assertResponseCode(401);
    }

    public function testAdd404sForNonexistentBoard(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/boards/00000000-0000-4000-8000-000000000000/lists', ['title' => 'Nope']);

        $this->assertResponseCode(404);
        $body = $this->decodedBody();
        $this->assertSame('not_found', $body['error']['code']);
    }

    // --- edit -------------------------------------------------------------

    public function testEditRenamesListWithoutTouchingPosition(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);

        $this->patch('/api/lists/' . self::STANDARD_LIST_ID, ['title' => 'Renamed']);

        $this->assertResponseOk();
        $body = $this->decodedBody();
        $this->assertSame('Renamed', $body['title']);
        $this->assertSame(1.0, (float)$body['position']);
    }

    public function testEditUpdatesPositionWithoutTouchingTitle(): void
    {
        $this->authenticateAs(self::OWNER_SUB, self::OWNER_EMAIL);

        $this->patch('/api/lists/' . self::STANDARD_LIST_ID, ['position' => 2.5]);

        $this->assertResponseOk();
        $body = $this->decodedBody();
        $this->assertSame(2.5, (float)$body['position']);
        $this->assertSame('To Do', $body['title']);
    }

    public function testEditIsForbiddenForNonOrgMember(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->patch('/api/lists/' . self::STANDARD_LIST_ID, ['title' => 'Hijacked']);

        $this->assertResponseCode(403);
        $body = $this->decodedBody();
        $this->assertSame('not_org_member', $body['error']['code']);
    }

    public function testEdit404sForNonexistentList(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/lists/00000000-0000-4000-8000-000000000000', ['title' => 'Nope']);

        $this->assertResponseCode(404);
        $body = $this->decodedBody();
        $this->assertSame('not_found', $body['error']['code']);
    }

    // --- delete -----------------------------------------------------------

    public function testDeleteSoftDeletesList(): void
    {
        $this->authenticateAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->delete('/api/lists/' . self::STANDARD_LIST_ID);

        $this->assertResponseOk();
        $body = $this->decodedBody();
        $this->assertNotNull($body['deleted']);

        $listsTable = $this->fetchTable('Lists');
        $this->assertNull(
            $listsTable->find()->where(['id' => self::STANDARD_LIST_ID])->first(),
        );
        $this->assertNotNull(
            $listsTable->find('withTrashed')->where(['id' => self::STANDARD_LIST_ID])->firstOrFail()->deleted,
        );
    }

    public function testDeleteIsForbiddenForNonOrgMember(): void
    {
        $this->authenticateAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->delete('/api/lists/' . self::STANDARD_LIST_ID);

        $this->assertResponseCode(403);
        $body = $this->decodedBody();
        $this->assertSame('not_org_member', $body['error']['code']);
    }

    // --- helpers ------------------------------------------------------------

    /**
     * Signs an RS256 JWT for an existing `UsersFixture` row's
     * `supabase_uid`/`email` (so `AuthMiddleware` resolves that row instead
     * of provisioning a new one) and attaches it as the request's
     * `Authorization` header for the next request this test makes.
     *
     * @param string $sub The fixture user's `supabase_uid`.
     * @param string $email The fixture user's `email`.
     * @return void
     */
    private function authenticateAs(string $sub, string $email): void
    {
        $token = JWT::encode([
            'sub' => $sub,
            'email' => $email,
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $this->privateKeyPem, 'RS256', self::KID);

        $this->configRequest(['headers' => ['Authorization' => 'Bearer ' . $token]]);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodedBody(): array
    {
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode((string)$this->_response->getBody(), true);

        return $decoded;
    }

    /**
     * @return array{0: string, 1: array<string, mixed>} [privateKeyPem, jwks]
     */
    private function generateJwks(): array
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        if ($resource === false) {
            throw new RuntimeException('Failed to generate a test RSA keypair.');
        }

        openssl_pkey_export($resource, $privateKeyPem);
        /** @var \OpenSSLAsymmetricKey $resource */
        $details = openssl_pkey_get_details($resource);
        $rsa = $details['rsa'];

        $b64url = static fn(string $bin): string => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');

        $jwks = [
            'keys' => [
                [
                    'kty' => 'RSA',
                    'kid' => self::KID,
                    'alg' => 'RS256',
                    'use' => 'sig',
                    'n' => $b64url($rsa['n']),
                    'e' => $b64url($rsa['e']),
                ],
            ],
        ];

        return [$privateKeyPem, $jwks];
    }

    /**
     * @param string $key The `$_SERVER` key to set.
     * @param string $value The value to set it to.
     * @return void
     */
    private function setEnv(string $key, string $value): void
    {
        $this->originalEnv[$key] = $_SERVER[$key] ?? false;
        $_SERVER[$key] = $value;
    }
}
