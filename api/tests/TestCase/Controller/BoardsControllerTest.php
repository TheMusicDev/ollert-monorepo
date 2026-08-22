<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Cache\Cache;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Integration tests for `App\Controller\BoardsController`, exercised through
 * the real routed HTTP stack (`IntegrationTestTrait`) — real middleware queue
 * (including the real `App\Middleware\AuthMiddleware`), real fixtures, real
 * auth flow, the same technique `ApiBootstrapIntegrationTest` uses: a
 * throwaway RSA keypair stands in for Supabase's signing key, its public half
 * seeded directly into the `jwks` Cache config, and JWTs for each fixture
 * user are signed with the private half.
 *
 * Fixture layout (see the fixture classes' own docblocks for the full
 * picture):
 * - `UsersFixture`: owner (`...0001`), member (`...0002`, explicit
 *   `org_members` row on the fixture org), outsider (`...0003`, no relation
 *   to the fixture org), poweruser (`...0004`, owns a second, empty org).
 * - `OrganizationsFixture`: org `30000000-...0001` (owner: owner,
 *   `max_boards_per_org` 3) and org `30000000-...0002` (owner: poweruser, no
 *   boards yet).
 * - `BoardsFixture`: three boards under org `...0001` — exactly at that
 *   org's `max_boards_per_org` quota.
 * - `ListsFixture`/`CardsFixture`: two lists (with two cards on the first)
 *   nested under "Board One", for the `view` nested-response assertions.
 */
class BoardsControllerTest extends TestCase
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
        'app.Cards',
    ];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'boards-test-kid';

    private const ORG_ID = '30000000-0000-4000-8000-000000000001';

    private const POWER_ORG_ID = '30000000-0000-4000-8000-000000000002';

    private const BOARD_ONE_ID = '50000000-0000-4000-8000-000000000001';

    private const BOARD_TWO_ID = '50000000-0000-4000-8000-000000000002';

    private const BOARD_THREE_ID = '50000000-0000-4000-8000-000000000003';

    private const OWNER = ['supabase_uid' => '20000000-0000-4000-8000-000000000001', 'email' => 'owner@example.com'];

    private const MEMBER = [
        'supabase_uid' => '20000000-0000-4000-8000-000000000002',
        'email' => 'member@example.com',
    ];

    private const OUTSIDER = [
        'supabase_uid' => '20000000-0000-4000-8000-000000000003',
        'email' => 'outsider@example.com',
    ];

    private const POWERUSER = [
        'supabase_uid' => '20000000-0000-4000-8000-000000000004',
        'email' => 'poweruser@example.com',
    ];

    /**
     * @var array<string, string|false>
     */
    private array $originalEnv = [];

    private string $privateKeyPem;

    protected function setUp(): void
    {
        parent::setUp();

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

    // --- index -------------------------------------------------------

    public function testIndexReturnsPaginatedBoardsForOrgMember(): void
    {
        $this->authenticateAs(self::MEMBER);
        $this->get('/api/orgs/' . self::ORG_ID . '/boards');

        $this->assertResponseOk();
        $body = $this->decodedBody();
        $this->assertCount(3, $body['data']);
        $this->assertSame(3, $body['meta']['total']);
        $this->assertSame(1, $body['meta']['page']);
    }

    public function testIndexIsForbiddenForNonMember(): void
    {
        $this->authenticateAs(self::OUTSIDER);
        $this->get('/api/orgs/' . self::ORG_ID . '/boards');

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodedBody()['error']['code']);
    }

    public function testIndexWithoutATokenIsUnauthorized(): void
    {
        $this->get('/api/orgs/' . self::ORG_ID . '/boards');

        $this->assertResponseCode(401);
    }

    // --- add -----------------------------------------------------------

    public function testAddAsOrgOwnerUnderQuotaSucceeds(): void
    {
        $this->authenticateAs(self::POWERUSER);
        $this->enableCsrfToken();
        $this->post('/api/orgs/' . self::POWER_ORG_ID . '/boards', ['title' => 'New Board']);

        $this->assertResponseCode(201);
        $board = $this->decodedBody();
        $this->assertSame('New Board', $board['title']);
        $this->assertSame(self::POWER_ORG_ID, $board['org_id']);

        $this->assertSame(
            1,
            $this->fetchTable('Boards')->find()->where(['org_id' => self::POWER_ORG_ID])->count(),
        );
    }

    public function testAddAsNonOwnerMemberIsForbidden(): void
    {
        $this->authenticateAs(self::MEMBER);
        $this->enableCsrfToken();
        $this->post('/api/orgs/' . self::ORG_ID . '/boards', ['title' => 'Should Not Exist']);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_owner', $this->decodedBody()['error']['code']);
    }

    public function testAddAtQuotaReturns422(): void
    {
        $this->authenticateAs(self::OWNER);
        $this->enableCsrfToken();
        $this->post('/api/orgs/' . self::ORG_ID . '/boards', ['title' => 'One Too Many']);

        $this->assertResponseCode(422);
        $this->assertSame('quota_exceeded', $this->decodedBody()['error']['code']);
    }

    // --- view ------------------------------------------------------------

    public function testViewReturnsBoardWithNestedListsAndCards(): void
    {
        $this->authenticateAs(self::MEMBER);
        $this->get('/api/boards/' . self::BOARD_ONE_ID);

        $this->assertResponseOk();
        $board = $this->decodedBody();
        $this->assertSame('Board One', $board['title']);
        $this->assertCount(2, $board['lists']);
        $this->assertSame('To Do', $board['lists'][0]['title']);
        $this->assertSame('Done', $board['lists'][1]['title']);
        $this->assertCount(2, $board['lists'][0]['cards']);
        $this->assertSame('Card A', $board['lists'][0]['cards'][0]['title']);
        $this->assertSame('Card B', $board['lists'][0]['cards'][1]['title']);
        $this->assertCount(0, $board['lists'][1]['cards']);
    }

    public function testViewIsForbiddenForNonMember(): void
    {
        $this->authenticateAs(self::OUTSIDER);
        $this->get('/api/boards/' . self::BOARD_ONE_ID);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodedBody()['error']['code']);
    }

    public function testViewOfMissingBoardReturns404(): void
    {
        $this->authenticateAs(self::OWNER);
        $this->get('/api/boards/50000000-0000-4000-8000-00000000dead');

        $this->assertResponseCode(404);
        $this->assertSame('not_found', $this->decodedBody()['error']['code']);
    }

    // --- edit --------------------------------------------------------

    public function testEditAsNonOwnerMemberSucceeds(): void
    {
        $this->authenticateAs(self::MEMBER);
        $this->enableCsrfToken();
        $this->patch('/api/boards/' . self::BOARD_TWO_ID, ['title' => 'Renamed Board']);

        $this->assertResponseOk();
        $this->assertSame('Renamed Board', $this->decodedBody()['title']);
        $this->assertSame(
            'Renamed Board',
            $this->fetchTable('Boards')->get(self::BOARD_TWO_ID)->title,
        );
    }

    public function testEditAsNonMemberIsForbidden(): void
    {
        $this->authenticateAs(self::OUTSIDER);
        $this->enableCsrfToken();
        $this->patch('/api/boards/' . self::BOARD_TWO_ID, ['title' => 'Should Not Apply']);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodedBody()['error']['code']);
        $this->assertSame(
            'Board Two',
            $this->fetchTable('Boards')->get(self::BOARD_TWO_ID)->title,
        );
    }

    // --- delete ------------------------------------------------------

    public function testDeleteAsNonOwnerMemberSucceeds(): void
    {
        $this->authenticateAs(self::MEMBER);
        $this->enableCsrfToken();
        $this->delete('/api/boards/' . self::BOARD_THREE_ID);

        $this->assertResponseCode(204);
        $this->assertSame('', (string)$this->_response->getBody());
        $this->assertNull(
            $this->fetchTable('Boards')->find()
                ->where(['id' => self::BOARD_THREE_ID])
                ->first(),
        );
        $this->assertNotNull(
            $this->fetchTable('Boards')->find('withTrashed')
                ->where(['id' => self::BOARD_THREE_ID])
                ->first(),
        );
    }

    public function testDeleteAsNonMemberIsForbidden(): void
    {
        $this->authenticateAs(self::OUTSIDER);
        $this->enableCsrfToken();
        $this->delete('/api/boards/' . self::BOARD_THREE_ID);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodedBody()['error']['code']);
        $this->assertNotNull(
            $this->fetchTable('Boards')->find()
                ->where(['id' => self::BOARD_THREE_ID])
                ->first(),
        );
    }

    // --- helpers -------------------------------------------------------

    /**
     * @param array{supabase_uid: string, email: string} $fixtureUser One of this
     *   class's `self::OWNER`/`MEMBER`/`OUTSIDER`/`POWERUSER` constants.
     * @return void
     */
    private function authenticateAs(array $fixtureUser): void
    {
        $token = JWT::encode([
            'sub' => $fixtureUser['supabase_uid'],
            'email' => $fixtureUser['email'],
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
        return (array)json_decode((string)$this->_response->getBody(), true);
    }

    private function setEnv(string $key, string $value): void
    {
        $this->originalEnv[$key] = $_SERVER[$key] ?? false;
        $_SERVER[$key] = $value;
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
}
