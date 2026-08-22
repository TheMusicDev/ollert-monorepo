<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Cache\Cache;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Shared helper for `OrganizationsControllerTest`/`OrgMembersControllerTest`:
 * signs real RS256 Supabase-shaped JWTs and seeds the `jwks` cache so
 * requests go through the *real* `App\Middleware\AuthMiddleware` end to end
 * (same technique as `App\Test\TestCase\ApiBootstrapIntegrationTest` — no
 * mocked identity/auth), rather than each controller test re-deriving its
 * own JWKS/JWT plumbing.
 *
 * Usage: call `setUpJwtAuth()` from `setUp()` and `tearDownJwtAuth()` from
 * `tearDown()`, then `authenticateAs($supabaseUid, $email)` before an
 * `IntegrationTestTrait` request to attach a valid `Authorization: Bearer`
 * header for that identity — typically one of the known fixture users in
 * `UsersFixture` (owner/member/outsider/poweruser), so the resulting
 * `identity` attribute matches an existing `users` row rather than JIT
 * provisioning a new one mid-test.
 */
trait AuthenticatedRequestTrait
{
    private const JWT_ISS = 'https://test-project.supabase.co/auth/v1';

    private const JWT_AUD = 'authenticated';

    private const JWT_KID = 'controller-test-kid';

    private string $jwtPrivateKeyPem;

    /**
     * @var array<string, string|false>
     */
    private array $jwtOriginalEnv = [];

    /**
     * @return void
     */
    private function setUpJwtAuth(): void
    {
        Cache::clear('jwks');

        [$this->jwtPrivateKeyPem, $jwks] = $this->generateJwtKeysAndJwks();
        Cache::write('supabase_jwks', $jwks, 'jwks');

        $this->setJwtEnv('SUPABASE_JWT_ISS', self::JWT_ISS);
        $this->setJwtEnv('SUPABASE_JWT_AUD', self::JWT_AUD);

        // POST/PATCH/DELETE go through the real middleware queue, including
        // `CsrfProtectionMiddleware` (App\Application::middleware()) — this
        // API is stateless/JWT-only with no CSRF-vulnerable cookie session,
        // but the middleware itself doesn't know that, so every mutating
        // request needs a valid token attached the same way a real
        // (non-browser) client wouldn't have to: `enableCsrfToken()` makes
        // `IntegrationTestTrait` attach a matching cookie + `X-CSRF-Token`
        // header automatically.
        $this->enableCsrfToken();
    }

    /**
     * @return void
     */
    private function tearDownJwtAuth(): void
    {
        Cache::clear('jwks');
        foreach ($this->jwtOriginalEnv as $key => $value) {
            if ($value === false) {
                unset($_SERVER[$key]);
            } else {
                $_SERVER[$key] = $value;
            }
        }
    }

    /**
     * Attaches a valid `Authorization: Bearer` header for the given identity
     * to the next `IntegrationTestTrait` request (`$this->get()`/`post()`/
     * etc.).
     *
     * @param string $supabaseUid The `sub` claim — a fixture user's
     *   `supabase_uid`, or any UUID for a JIT-provisioning scenario.
     * @param string $email The `email` claim.
     * @return void
     */
    private function authenticateAs(string $supabaseUid, string $email): void
    {
        $token = JWT::encode([
            'sub' => $supabaseUid,
            'email' => $email,
            'iss' => self::JWT_ISS,
            'aud' => self::JWT_AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $this->jwtPrivateKeyPem, 'RS256', self::JWT_KID);

        $this->configRequest(['headers' => ['Authorization' => 'Bearer ' . $token]]);
    }

    /**
     * @param string $key Env var name.
     * @param string $value Env var value.
     * @return void
     */
    private function setJwtEnv(string $key, string $value): void
    {
        $this->jwtOriginalEnv[$key] = $_SERVER[$key] ?? false;
        $_SERVER[$key] = $value;
    }

    /**
     * @return array{0: string, 1: array<string, mixed>} [privateKeyPem, jwks]
     */
    private function generateJwtKeysAndJwks(): array
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
                    'kid' => self::JWT_KID,
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
