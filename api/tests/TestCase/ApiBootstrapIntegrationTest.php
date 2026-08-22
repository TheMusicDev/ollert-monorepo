<?php
declare(strict_types=1);

namespace App\Test\TestCase;

use App\Model\Table\UsersTable;
use Cake\Cache\Cache;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use Cake\Utility\Text;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Exercises the PHPUnit bootstrap (fixtures + migrated test DB, per
 * tests/bootstrap.php) with one real, end-to-end HTTP-style request per
 * be-tasks.md's Section G checklist — not just scaffolding, an actual
 * fixture-backed integration test through `Cake\TestSuite\IntegrationTestTrait`,
 * the real middleware queue (`App\Application::middleware()`), and the real
 * `App\Middleware\AuthMiddleware`.
 *
 * Also doubles as the Phase 1 exit-criteria check
 * (be-tasks.md, "Verify Phase 1 exit criteria end to end"): migrations run
 * clean (tests/bootstrap.php migrates the test DB on every run), the health
 * check responds, and a hand-crafted Supabase-shaped RS256 JWT passes the
 * auth middleware and provisions a `users` row — for real, not mocked:
 *
 * - A throwaway RSA keypair stands in for Supabase's signing key.
 * - Its public half is written directly into the `jwks` Cache config under
 *   the same key `App\Auth\SupabaseJwksProvider` reads
 *   (`Cache::remember('supabase_jwks', ..., 'jwks')`), so the *real*
 *   provider (not a fake `JwksProviderInterface`, unlike
 *   `AuthMiddlewareTest`) serves it without any network access — this is
 *   the same technique `SupabaseJwksProviderTest` uses to test the cache
 *   directly, applied here through the full HTTP stack instead.
 * - The token is signed with the private half and sent as a real
 *   `Authorization: Bearer` header on a routed request, so
 *   `App\Application::middleware()`'s real `AuthMiddleware` (not a
 *   directly-instantiated one) verifies it.
 */
class ApiBootstrapIntegrationTest extends TestCase
{
    use IntegrationTestTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users'];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'bootstrap-test-kid';

    /**
     * @var array<string, string|false>
     */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::clear('jwks');
        $this->setEnv('SUPABASE_JWT_ISS', self::ISS);
        $this->setEnv('SUPABASE_JWT_AUD', self::AUD);
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

    private function setEnv(string $key, string $value): void
    {
        $this->originalEnv[$key] = $_SERVER[$key] ?? false;
        $_SERVER[$key] = $value;
    }

    public function testHealthCheckRespondsWithoutAuthentication(): void
    {
        $this->get('/api/health');

        $this->assertResponseOk();
    }

    public function testProtectedRouteWithoutATokenIsUnauthorized(): void
    {
        $this->get('/api/orgs');

        $this->assertResponseCode(401);
        $this->assertSame('', (string)$this->_response->getBody());
    }

    /**
     * The end-to-end path: a real RS256 JWT, verified against a real (cache-
     * seeded) JWKS provider, JIT-provisions a brand-new `users` row, and the
     * request is then dispatched into `App\Controller\OrganizationsController
     * ::index()` (`feat/api-organizations`, be-tasks.md's Section 2) — a
     * clean 200 with an empty paginated envelope for a brand-new user with
     * no orgs, not a crash. That 200 is the expected, correct outcome here:
     * it proves the request made it all the way through auth into a real
     * controller action instead of being rejected earlier by
     * routing/CORS/CSRF/auth. (Before `feat/api-organizations` landed, this
     * asserted a 404 `not_found` from CakePHP's `MissingActionException`
     * against the then-empty stub controller — see be-tasks.md's Section G
     * for that original scaffolding-only intent.)
     *
     * @return void
     */
    public function testValidSupabaseJwtPassesAuthAndProvisionsAUserThenReachesTheRealAction(): void
    {
        $sub = Text::uuid();
        $email = 'bootstrap-' . $sub . '@example.com';
        [$privateKeyPem, $jwks] = $this->generateJwks();
        Cache::write('supabase_jwks', $jwks, 'jwks');

        $token = JWT::encode([
            'sub' => $sub,
            'email' => $email,
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $privateKeyPem, 'RS256', self::KID);

        $this->assertNull($this->usersTable()->find('withTrashed')
            ->where(['supabase_uid' => $sub])
            ->first());

        $this->configRequest(['headers' => ['Authorization' => 'Bearer ' . $token]]);
        $this->get('/api/orgs');

        // Auth passed and dispatch reached the real `index()` action — an
        // empty paginated envelope for a user with no orgs yet, not a 401
        // and not a crash.
        $this->assertResponseCode(200);
        $body = json_decode((string)$this->_response->getBody(), true);
        $this->assertSame([], $body['data'] ?? null);

        $provisioned = $this->usersTable()->find()
            ->where(['supabase_uid' => $sub])
            ->firstOrFail();
        $this->assertSame($email, $provisioned->email);
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
     * @return \App\Model\Table\UsersTable
     */
    private function usersTable(): UsersTable
    {
        /** @var \App\Model\Table\UsersTable $table */
        $table = $this->fetchTable('Users');

        return $table;
    }
}
