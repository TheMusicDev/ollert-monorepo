<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Auth\JwksProviderInterface;
use App\Auth\SupabaseJwksProvider;
use App\Model\Entity\User;
use App\Model\Table\UsersTable;
use Cake\Database\Exception\QueryException;
use Cake\Http\Exception\UnauthorizedException;
use Cake\ORM\Locator\LocatorAwareTrait;
use Firebase\JWT\JWT;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use stdClass;
use Throwable;

/**
 * Verifies the Supabase-issued JWT on every `/api/*` request (except the
 * unauthenticated `/api/health` liveness check) and just-in-time provisions
 * a local `users` row for the token's `sub` claim.
 *
 * See planning/architecture.md#auth-flow for the authoritative flow this
 * implements:
 * 1. Fetch + cache Supabase's JWKS (`App\Auth\SupabaseJwksProvider`, 15 min
 *    TTL by default via `JWKS_CACHE_TTL`).
 * 2. Verify the JWT's RS256 signature and standard claims (`exp` is checked
 *    by `firebase/php-jwt` itself; `aud`/`iss` are checked here against
 *    `SUPABASE_JWT_AUD`/`SUPABASE_JWT_ISS`).
 * 3. Extract `sub` (the Supabase user UUID) and find-or-create the matching
 *    `users` row by `supabase_uid`, using the token's `email` claim on
 *    first sight.
 * 4. Attach the resulting `App\Model\Entity\User` to the request as the
 *    `identity` attribute (`$request->getAttribute('identity')`) for
 *    downstream controllers to read — no session, every request stands on
 *    its own.
 *
 * Any failure in steps 1-3 (missing/malformed header, bad signature,
 * expired token, wrong `aud`/`iss`, unreachable/malformed JWKS) results in a
 * bare 401 with no body — see planning/api-contract.md#error-response-shape
 * and `App\Error\JsonExceptionRenderer::renderApiResponse()`, which strips
 * the body from every 401 regardless of exception type/message. Requests
 * outside `/api/*` (the leftover CakePHP skeleton routes) and the health
 * check are passed through unauthenticated.
 */
class AuthMiddleware implements MiddlewareInterface
{
    use LocatorAwareTrait;

    private const UNAUTHENTICATED_PATHS = ['/api/health'];

    private JwksProviderInterface $jwksProvider;

    /**
     * @param \App\Auth\JwksProviderInterface|null $jwksProvider Defaults to
     *   `App\Auth\SupabaseJwksProvider`; injectable for tests.
     */
    public function __construct(?JwksProviderInterface $jwksProvider = null)
    {
        $this->jwksProvider = $jwksProvider ?? new SupabaseJwksProvider();
    }

    /**
     * @param \Psr\Http\Message\ServerRequestInterface $request The request.
     * @param \Psr\Http\Server\RequestHandlerInterface $handler The request handler.
     * @return \Psr\Http\Message\ResponseInterface A response.
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (!$this->requiresAuth($request)) {
            return $handler->handle($request);
        }

        $token = $this->extractBearerToken($request);
        if ($token === null) {
            throw new UnauthorizedException();
        }

        $payload = $this->verifyToken($token);
        $user = $this->findOrCreateUser($payload);

        return $handler->handle($request->withAttribute('identity', $user));
    }

    /**
     * Every `/api/*` path requires auth except the explicitly unauthenticated
     * ones (currently just the health check). Everything outside `/api`
     * (the leftover CakePHP skeleton `Pages` routes) is left alone.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request The request.
     * @return bool
     */
    private function requiresAuth(ServerRequestInterface $request): bool
    {
        $path = $request->getUri()->getPath();
        if ($path !== '/api' && !str_starts_with($path, '/api/')) {
            return false;
        }

        return !in_array($path, self::UNAUTHENTICATED_PATHS, true);
    }

    /**
     * @param \Psr\Http\Message\ServerRequestInterface $request The request.
     * @return string|null The bearer token, or null if the header is missing/malformed.
     */
    private function extractBearerToken(ServerRequestInterface $request): ?string
    {
        $header = $request->getHeaderLine('Authorization');
        if (!str_starts_with($header, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($header, 7));

        return $token === '' ? null : $token;
    }

    /**
     * Verifies the JWT's signature (via the JWKS key set) and standard
     * claims, throwing a bodyless 401 on any failure — signature, `exp`
     * (checked internally by `firebase/php-jwt`), `aud`, `iss`, or a
     * missing/malformed `sub`/`email` claim are all treated identically so
     * nothing about *why* verification failed leaks to the client.
     *
     * @param string $token The raw JWT.
     * @return \stdClass The decoded, claim-validated payload.
     */
    private function verifyToken(string $token): stdClass
    {
        try {
            $keySet = $this->jwksProvider->getKeySet();
            $payload = JWT::decode($token, $keySet);
        } catch (Throwable) {
            throw new UnauthorizedException();
        }

        $this->assertClaims($payload);

        return $payload;
    }

    /**
     * @param \stdClass $payload The decoded JWT payload.
     * @return void
     */
    private function assertClaims(stdClass $payload): void
    {
        $expectedIss = (string)env('SUPABASE_JWT_ISS', '');
        $expectedAud = (string)env('SUPABASE_JWT_AUD', '');

        $iss = $payload->iss ?? null;
        $aud = $payload->aud ?? null;
        // `aud` is a string for Supabase tokens but the JWT spec allows an
        // array of intended audiences, so accept either shape.
        $audMatches = is_array($aud)
            ? in_array($expectedAud, $aud, true)
            : $aud === $expectedAud;

        $subValid = isset($payload->sub) && is_string($payload->sub) && $payload->sub !== '';
        $emailValid = isset($payload->email) && is_string($payload->email) && $payload->email !== '';

        if (
            $expectedIss === ''
            || $expectedAud === ''
            || $iss !== $expectedIss
            || !$audMatches
            || !$subValid
            || !$emailValid
        ) {
            throw new UnauthorizedException();
        }
    }

    /**
     * Find-or-create the local `users` row for this token's `sub`, using the
     * `email` claim to populate a newly created row (see
     * planning/architecture.md#auth-flow, step 4 — JIT provisioning, no
     * separate signup endpoint).
     *
     * Two edge cases beyond the happy path, both because `supabase_uid` is
     * unique across *all* rows (trashed or not — see the migration) rather
     * than just active ones:
     * - A soft-deleted row (`Muffin/Trash`, scoped out of the default find)
     *   still owns the `supabase_uid`. A still-valid Supabase token means
     *   the identity is legitimate again, so it's revived rather than
     *   left to collide with a doomed insert attempt.
     * - Two first-ever requests for the same `sub` can race: both see no
     *   row and both attempt to create one. The loser's insert fails on
     *   the unique index (`Cake\Database\Exception\QueryException`); rather
     *   than surface that as a 500, re-read the row the winner just
     *   created.
     *
     * @param \stdClass $payload The decoded, claim-validated JWT payload.
     * @return \App\Model\Entity\User
     */
    private function findOrCreateUser(stdClass $payload): User
    {
        $usersTable = $this->fetchUsersTable();
        $supabaseUid = $payload->sub;

        $existing = $this->findBySupabaseUid($usersTable, $supabaseUid);
        if ($existing !== null) {
            return $this->reviveIfTrashed($usersTable, $existing, $payload);
        }

        try {
            $user = $usersTable->newEntity([
                'supabase_uid' => $supabaseUid,
                'email' => $payload->email,
            ]);

            return $usersTable->saveOrFail($user);
        } catch (QueryException $e) {
            // Lost the create race to a concurrent first request for the
            // same identity — use the row it created instead of failing.
            $existing = $this->findBySupabaseUid($usersTable, $supabaseUid);
            if ($existing === null) {
                throw $e;
            }

            return $this->reviveIfTrashed($usersTable, $existing, $payload);
        }
    }

    /**
     * @return \App\Model\Table\UsersTable
     */
    private function fetchUsersTable(): UsersTable
    {
        /** @var \App\Model\Table\UsersTable */
        return $this->fetchTable('Users');
    }

    /**
     * Looks up a `users` row by `supabase_uid` regardless of trashed status
     * — the unique index covers every row, so a match here (trashed or not)
     * is always the one this `sub` belongs to.
     *
     * @param \App\Model\Table\UsersTable $usersTable The table.
     * @param string $supabaseUid The `sub` claim.
     * @return \App\Model\Entity\User|null
     */
    private function findBySupabaseUid(UsersTable $usersTable, string $supabaseUid): ?User
    {
        /** @var \App\Model\Entity\User|null */
        return $usersTable->find('withTrashed')
            ->where(['supabase_uid' => $supabaseUid])
            ->first();
    }

    /**
     * @param \App\Model\Table\UsersTable $usersTable The table.
     * @param \App\Model\Entity\User $user The row matching this token's `sub`.
     * @param \stdClass $payload The decoded, claim-validated JWT payload.
     * @return \App\Model\Entity\User
     */
    private function reviveIfTrashed(UsersTable $usersTable, User $user, stdClass $payload): User
    {
        if ($user->deleted === null) {
            return $user;
        }

        $user->deleted = null;
        $user->email = $payload->email;

        return $usersTable->saveOrFail($user);
    }
}
