<?php
declare(strict_types=1);

namespace App\Test\TestCase\Auth;

use App\Auth\SupabaseJwksProvider;
use Cake\Cache\Cache;
use Cake\TestSuite\TestCase;
use Firebase\JWT\Key;
use RuntimeException;

/**
 * Tests for App\Auth\SupabaseJwksProvider: JWKS parsing and the 15-minute
 * cache in front of it (see planning/architecture.md#auth-flow and the
 * `jwks` Cache config in config/app.php, TTL from `JWKS_CACHE_TTL`).
 *
 * The HTTP fetch itself is replaced with an injected callable (rather than
 * mocking `Cake\Http\Client`) so caching behavior — "does a second call
 * reuse the cached response" — is directly observable via a call counter,
 * without any network or HTTP-mocking machinery.
 */
class SupabaseJwksProviderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::clear('jwks');
    }

    protected function tearDown(): void
    {
        Cache::clear('jwks');
        parent::tearDown();
    }

    /**
     * @return array<string, mixed> A single-key JWKS response, RSA/RS256.
     */
    private function sampleJwks(): array
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $details = openssl_pkey_get_details($resource);
        $rsa = $details['rsa'];

        $b64url = static fn(string $bin): string => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');

        return [
            'keys' => [
                [
                    'kty' => 'RSA',
                    'kid' => 'sample-kid',
                    'alg' => 'RS256',
                    'use' => 'sig',
                    'n' => $b64url($rsa['n']),
                    'e' => $b64url($rsa['e']),
                ],
            ],
        ];
    }

    public function testGetKeySetParsesJwksIntoKeyObjects(): void
    {
        $jwks = $this->sampleJwks();
        $provider = new SupabaseJwksProvider(fn() => $jwks);

        $keySet = $provider->getKeySet();

        $this->assertArrayHasKey('sample-kid', $keySet);
        $this->assertInstanceOf(Key::class, $keySet['sample-kid']);
        $this->assertSame('RS256', $keySet['sample-kid']->getAlgorithm());
    }

    public function testSecondCallReusesCachedResponseInsteadOfRefetching(): void
    {
        $jwks = $this->sampleJwks();
        $calls = 0;
        $provider = new SupabaseJwksProvider(function () use ($jwks, &$calls) {
            $calls++;

            return $jwks;
        });

        $provider->getKeySet();
        $provider->getKeySet();

        $this->assertSame(1, $calls);
    }

    public function testClearingTheCacheCausesARefetch(): void
    {
        $jwks = $this->sampleJwks();
        $calls = 0;
        $provider = new SupabaseJwksProvider(function () use ($jwks, &$calls) {
            $calls++;

            return $jwks;
        });

        $provider->getKeySet();
        Cache::clear('jwks');
        $provider->getKeySet();

        $this->assertSame(2, $calls);
    }

    public function testMalformedJwksResponseThrowsAndIsNotCached(): void
    {
        $provider = new SupabaseJwksProvider(fn() => ['not-keys' => []]);

        $this->expectException(RuntimeException::class);

        try {
            $provider->getKeySet();
        } finally {
            // A malformed response must not poison the cache for the TTL —
            // confirm nothing was left behind under the cache key.
            $this->assertNull(Cache::read('supabase_jwks', 'jwks'));
        }
    }

    /**
     * A response with the right shape (`{"keys": [...]}`) but an
     * unparseable key set (e.g. empty, or every key using an unsupported
     * algorithm) fails inside `Firebase\JWT\JWK::parseKeySet()`, not the
     * provider's own shape check — this must be caught too, or the bad
     * response sits cached for the full TTL and every request 401s until
     * it expires, even after the endpoint recovers.
     *
     * @return void
     */
    public function testUnparseableJwksResponseThrowsAndIsNotCached(): void
    {
        $calls = 0;
        $provider = new SupabaseJwksProvider(function () use (&$calls) {
            $calls++;

            return ['keys' => []];
        });

        try {
            $provider->getKeySet();
            $this->fail('Expected a RuntimeException.');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertNull(Cache::read('supabase_jwks', 'jwks'));

        // A subsequent call must refetch rather than reuse the poisoned
        // (now-cleared) cache entry.
        try {
            $provider->getKeySet();
        } catch (RuntimeException) {
            // still unparseable — only the refetch count matters here.
        }
        $this->assertSame(2, $calls);
    }
}
