<?php
declare(strict_types=1);

namespace App\Auth;

use Cake\Cache\Cache;
use Cake\Http\Client;
use Firebase\JWT\JWK;
use RuntimeException;
use Throwable;

/**
 * Fetches Supabase's JWKS (JSON Web Key Set) from `SUPABASE_JWKS_URL` and
 * caches the raw response under the `jwks` cache config (see
 * `config/app.php`'s `Cache` block; TTL configurable via `JWKS_CACHE_TTL`,
 * default 900s / 15 minutes — see planning/architecture.md#auth-flow).
 *
 * The actual fetch is behind an injectable callable rather than a hard
 * dependency on `Cake\Http\Client` so tests can supply a fixed, in-memory
 * JWKS (built from a throwaway RSA keypair) and assert on caching behavior
 * (e.g. "the fetcher only runs once across two calls") without mocking HTTP.
 */
class SupabaseJwksProvider implements JwksProviderInterface
{
    private const CACHE_CONFIG = 'jwks';

    private const CACHE_KEY = 'supabase_jwks';

    /**
     * @var callable(): array<string, mixed>
     */
    private $fetcher;

    /**
     * @param callable(): array<string, mixed>|null $fetcher Returns the raw
     *   decoded JWKS response (`['keys' => [...]]`). Defaults to an HTTP GET
     *   against `SUPABASE_JWKS_URL` via `Cake\Http\Client`.
     */
    public function __construct(?callable $fetcher = null)
    {
        $this->fetcher = $fetcher ?? $this->fetchFromSupabase(...);
    }

    /**
     * @return array<string, \Firebase\JWT\Key>
     */
    public function getKeySet(): array
    {
        $jwks = Cache::remember(self::CACHE_KEY, $this->fetcher, self::CACHE_CONFIG);

        // Parsing (not just the raw HTTP fetch) happens *before* deciding
        // whether the cached value is usable: `JWK::parseKeySet()` can
        // itself throw on a structurally-plausible-but-bad response (e.g.
        // an empty or all-unsupported-algorithm `keys` array). If that
        // parse failure isn't caught here too, the bad response stays
        // cached for the full TTL and every request 401s until it expires,
        // even after Supabase's endpoint recovers.
        try {
            if (!is_array($jwks) || !isset($jwks['keys'])) {
                throw new RuntimeException('Malformed Supabase JWKS response: missing "keys".');
            }

            return JWK::parseKeySet($jwks);
        } catch (Throwable $e) {
            Cache::delete(self::CACHE_KEY, self::CACHE_CONFIG);
            throw $e instanceof RuntimeException ? $e : new RuntimeException(
                'Failed to parse Supabase JWKS response: ' . $e->getMessage(),
                0,
                $e,
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchFromSupabase(): array
    {
        $url = (string)env('SUPABASE_JWKS_URL', '');
        if ($url === '') {
            throw new RuntimeException('SUPABASE_JWKS_URL is not configured.');
        }

        $response = (new Client())->get($url);
        if (!$response->isOk()) {
            throw new RuntimeException(sprintf(
                'Failed to fetch Supabase JWKS from %s (HTTP %d).',
                $url,
                $response->getStatusCode(),
            ));
        }

        $jwks = $response->getJson();
        if (!is_array($jwks)) {
            throw new RuntimeException('Malformed Supabase JWKS response: not a JSON object.');
        }

        return $jwks;
    }
}
