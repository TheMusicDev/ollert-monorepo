<?php
declare(strict_types=1);

namespace App\Test\TestCase;

use Cake\Cache\Cache;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use Cake\Utility\Text;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Regression test for a real bug found during `feat/api-boards` (PR #18)
 * self-review: `Cake\Http\Middleware\CsrfProtectionMiddleware` was applied
 * unconditionally to the whole middleware queue in
 * `App\Application::middleware()`, so every real `POST`/`PATCH`/`DELETE`
 * to `/api/*` (this is a stateless Bearer-JWT API — see
 * planning/architecture.md#auth-flow — with no CSRF cookie ever issued to a
 * real client) would 403 with `InvalidCsrfTokenException` in production.
 *
 * Existing tests never caught this because `IntegrationTestTrait::
 * enableCsrfToken()` bypasses the check entirely in the test harness. This
 * test deliberately does NOT call `enableCsrfToken()` — it sends a real
 * `POST` through the full middleware stack (the real
 * `App\Application::middleware()` queue, real `AuthMiddleware`, real CSRF
 * middleware) with a valid Bearer JWT, the same throwaway-JWKS technique
 * `ApiBootstrapIntegrationTest` uses, and asserts the response is not a
 * CSRF-related 403/400 — it should reach controller dispatch and complete
 * successfully (a clean 201 from `OrganizationsController::add()`, now
 * implemented by `feat/api-organizations` — see
 * `ApiBootstrapIntegrationTest` for the equivalent update there, made when
 * this stub-controller test was originally written) rather than being
 * rejected by CSRF.
 */
class CsrfApiScopeIntegrationTest extends TestCase
{
    use IntegrationTestTrait;

    /**
     * `app.Organizations` is required (not just `app.Users`) because
     * `testPostToApiRouteWithValidJwtAndNoCsrfTokenIsNotRejectedByCsrf`'s
     * `POST /api/orgs` now reaches the real, implemented
     * `OrganizationsController::add()` (`feat/api-organizations`) and
     * actually persists an org row — without this fixture declared,
     * `TruncateStrategy` doesn't know to truncate `organizations` between
     * tests, and the next test's `users` truncate then fails on the
     * dangling foreign key.
     *
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations', 'app.AuditLogs'];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'csrf-scope-test-kid';

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

    /**
     * A real POST to `/api/orgs` with a valid Bearer JWT and no CSRF token
     * anywhere (no cookie, no `X-CSRF-Token` header, `enableCsrfToken()` is
     * never called) must NOT be rejected as a CSRF failure. Before the fix,
     * this 403'd with `{"error":{"code":"forbidden", ...}}` from
     * `InvalidCsrfTokenException`. After the fix, the request clears CSRF
     * and auth and reaches controller dispatch, landing on a clean 201 from
     * `OrganizationsController::add()` — proving CSRF is no longer in the
     * way of legitimate `/api/*` traffic. (Before `feat/api-organizations`
     * implemented `add()`, this asserted a 404 `not_found` from the
     * then-empty stub controller instead — same update
     * `ApiBootstrapIntegrationTest` made.)
     *
     * @return void
     */
    public function testPostToApiRouteWithValidJwtAndNoCsrfTokenIsNotRejectedByCsrf(): void
    {
        $token = $this->validSupabaseJwt();

        $this->configRequest([
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
            ],
        ]);
        $this->post('/api/orgs', json_encode(['name' => 'Acme Inc']));

        $this->assertResponseCode(201);
        $body = json_decode((string)$this->_response->getBody(), true);
        $this->assertSame('Acme Inc', $body['name'] ?? null);
        $this->assertNotSame(403, $this->_response->getStatusCode());
    }

    /**
     * Same as above but for `PATCH` and `DELETE` (`InvalidCsrfTokenException`
     * only guards `PUT`/`POST`/`DELETE`/`PATCH` — every unsafe verb this API
     * actually uses per planning/api-contract.md).
     *
     * @return void
     */
    public function testPatchAndDeleteToApiRoutesWithValidJwtAndNoCsrfTokenAreNotRejectedByCsrf(): void
    {
        $token = $this->validSupabaseJwt();
        $headers = ['Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json'];

        $this->configRequest(['headers' => $headers]);
        $this->patch('/api/boards/00000000-0000-0000-0000-000000000000', json_encode(['name' => 'Renamed']));
        $this->assertNotSame(403, $this->_response->getStatusCode());

        $this->configRequest(['headers' => $headers]);
        $this->delete('/api/boards/00000000-0000-0000-0000-000000000000');
        $this->assertNotSame(403, $this->_response->getStatusCode());
    }

    private function validSupabaseJwt(): string
    {
        $sub = Text::uuid();
        $email = 'csrf-scope-' . $sub . '@example.com';
        [$privateKeyPem, $jwks] = $this->generateJwks();
        Cache::write('supabase_jwks', $jwks, 'jwks');

        return JWT::encode([
            'sub' => $sub,
            'email' => $email,
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $privateKeyPem, 'RS256', self::KID);
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
