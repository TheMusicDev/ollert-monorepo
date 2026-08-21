<?php
declare(strict_types=1);

namespace App\Auth;

/**
 * Supplies the set of public keys used to verify Supabase-issued JWT
 * signatures, keyed by `kid` (key ID) as required by
 * `Firebase\JWT\JWT::decode()`.
 *
 * Split out from `App\Middleware\AuthMiddleware` so the middleware's token
 * verification logic can be tested against a fixed, in-memory key set
 * (see `App\Test\TestCase\Middleware\AuthMiddlewareTest`) without depending
 * on network access or CakePHP's Cache layer.
 */
interface JwksProviderInterface
{
    /**
     * @return array<string, \Firebase\JWT\Key> Key ID (`kid`) => Key.
     */
    public function getKeySet(): array;
}
