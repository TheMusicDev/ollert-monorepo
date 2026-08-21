<?php
declare(strict_types=1);

namespace App\Test\TestCase\Middleware;

use App\Auth\JwksProviderInterface;
use App\Middleware\AuthMiddleware;
use App\Model\Entity\User;
use App\Model\Table\UsersTable;
use Cake\Http\Exception\UnauthorizedException;
use Cake\Http\Response;
use Cake\Http\ServerRequest;
use Cake\TestSuite\TestCase;
use Cake\Utility\Text;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use RuntimeException;

/**
 * Tests for App\Middleware\AuthMiddleware: RS256 JWT verification (signature,
 * exp/aud/iss claims) and JIT provisioning of the local `users` row.
 *
 * See planning/architecture.md#auth-flow for the flow under test and
 * planning/api-contract.md#error-response-shape for why every failure below
 * results in a bare `UnauthorizedException` (401, no body — asserted
 * separately in App\Test\TestCase\Error\JsonExceptionRendererTest) rather
 * than a specific error message.
 *
 * Verification is exercised directly against `AuthMiddleware::process()`
 * with a fake `JwksProviderInterface` (real RS256 keypair generated
 * per-test, no network) rather than through a real routed HTTP request,
 * since `/api/*` routes don't exist yet (routes.php is subsection F/G) —
 * a request to any `/api/*` path would 404 in RoutingMiddleware before ever
 * reaching this middleware.
 */
class AuthMiddlewareTest extends TestCase
{
    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users'];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'test-kid-1';

    /**
     * @var string
     */
    private string $privateKeyPem;

    /**
     * @var \Firebase\JWT\Key
     */
    private Key $publicKey;

    /**
     * @var array<string, string|false>
     */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        parent::setUp();

        [$this->privateKeyPem, $publicKeyPem] = $this->generateRsaKeyPair();
        $this->publicKey = new Key($publicKeyPem, 'RS256');

        $this->setEnv('SUPABASE_JWT_ISS', self::ISS);
        $this->setEnv('SUPABASE_JWT_AUD', self::AUD);
    }

    protected function tearDown(): void
    {
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
     * @return array{0: string, 1: string} [privateKeyPem, publicKeyPem]
     */
    private function generateRsaKeyPair(): array
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

        return [$privateKeyPem, $details['key']];
    }

    /**
     * @param array<string, mixed> $claimOverrides Overrides merged onto a valid default claim set.
     * @param string|null $signingKey Defaults to the matching test keypair's private key.
     * @param string|null $kid Defaults to the matching test keypair's kid.
     * @return string
     */
    private function makeToken(
        array $claimOverrides = [],
        ?string $signingKey = null,
        ?string $kid = self::KID,
    ): string {
        $claims = array_merge([
            'sub' => '11111111-1111-1111-1111-111111111111',
            'email' => 'newuser@example.com',
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $claimOverrides);

        return JWT::encode($claims, $signingKey ?? $this->privateKeyPem, 'RS256', $kid);
    }

    /**
     * @return \App\Auth\JwksProviderInterface
     */
    private function fakeJwksProvider(): JwksProviderInterface
    {
        $publicKey = $this->publicKey;
        $kid = self::KID;

        return new class ($kid, $publicKey) implements JwksProviderInterface {
            public function __construct(
                private readonly string $kid,
                private readonly Key $key,
            ) {
            }

            public function getKeySet(): array
            {
                return [$this->kid => $this->key];
            }
        };
    }

    /**
     * @param string|null $bearerToken Set as `Authorization: Bearer <token>` when provided.
     * @param string $url The request path.
     * @return \Cake\Http\ServerRequest
     */
    private function makeRequest(?string $bearerToken, string $url = '/api/orgs'): ServerRequest
    {
        $request = new ServerRequest(['url' => $url]);
        if ($bearerToken !== null) {
            $request = $request->withHeader('Authorization', 'Bearer ' . $bearerToken);
        }

        return $request;
    }

    /**
     * A handler stub that records the request it was called with and
     * returns a fixed 200 response, standing in for "the rest of the
     * middleware queue + controller dispatch".
     *
     * @return \Psr\Http\Server\RequestHandlerInterface
     */
    private function recordingHandler(): RequestHandlerInterface
    {
        return new class implements RequestHandlerInterface {
            public ?ServerRequestInterface $capturedRequest = null;

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                $this->capturedRequest = $request;

                return new Response(['status' => 200]);
            }
        };
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

    public function testValidTokenProvisionsNewUser(): void
    {
        $sub = Text::uuid();
        $token = $this->makeToken([
            'sub' => $sub,
            'email' => 'brandnew@example.com',
        ]);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $handler = $this->recordingHandler();

        $response = $middleware->process($this->makeRequest($token), $handler);

        $this->assertSame(200, $response->getStatusCode());
        $identity = $handler->capturedRequest?->getAttribute('identity');
        $this->assertInstanceOf(User::class, $identity);
        $this->assertSame($sub, $identity->supabase_uid);
        $this->assertSame('brandnew@example.com', $identity->email);

        $row = $this->usersTable()->find()
            ->where(['supabase_uid' => $sub])
            ->firstOrFail();
        $this->assertSame('brandnew@example.com', $row->email);
    }

    public function testValidTokenForKnownSupabaseUidReusesExistingUser(): void
    {
        $sub = Text::uuid();
        $existing = $this->usersTable()->newEntity([
            'supabase_uid' => $sub,
            'email' => 'already-here@example.com',
        ]);
        $existing = $this->usersTable()->saveOrFail($existing);

        // Token carries a different email claim — the existing row must win,
        // JIT provisioning only creates on first sight.
        $token = $this->makeToken([
            'sub' => $sub,
            'email' => 'different-now@example.com',
        ]);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $handler = $this->recordingHandler();

        $middleware->process($this->makeRequest($token), $handler);

        $identity = $handler->capturedRequest?->getAttribute('identity');
        $this->assertInstanceOf(User::class, $identity);
        $this->assertSame($existing->id, $identity->id);
        $this->assertSame('already-here@example.com', $identity->email);

        $count = $this->usersTable()->find()
            ->where(['supabase_uid' => $sub])
            ->count();
        $this->assertSame(1, $count);
    }

    /**
     * A soft-deleted local row (Muffin/Trash's `deleted` column) still owns
     * the unique `supabase_uid` — the default find scopes it out, but a
     * still-valid Supabase token means the identity is legitimate again, so
     * the middleware must revive the row rather than collide with a doomed
     * insert attempt (see `AuthMiddleware::reviveIfTrashed()`).
     *
     * @return void
     */
    public function testValidTokenForSoftDeletedUserRevivesTheExistingRow(): void
    {
        $sub = Text::uuid();
        $trashed = $this->usersTable()->newEntity([
            'supabase_uid' => $sub,
            'email' => 'was-deleted@example.com',
        ]);
        $trashed = $this->usersTable()->saveOrFail($trashed);
        $this->usersTable()->delete($trashed);
        $this->assertNotNull(
            $this->usersTable()->find('withTrashed')->where(['id' => $trashed->id])->firstOrFail()->deleted,
        );

        $token = $this->makeToken([
            'sub' => $sub,
            'email' => 'revived@example.com',
        ]);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $handler = $this->recordingHandler();

        $middleware->process($this->makeRequest($token), $handler);

        $identity = $handler->capturedRequest?->getAttribute('identity');
        $this->assertInstanceOf(User::class, $identity);
        $this->assertSame($trashed->id, $identity->id);
        $this->assertNull($identity->deleted);
        $this->assertSame('revived@example.com', $identity->email);

        $row = $this->usersTable()->find()->where(['supabase_uid' => $sub])->firstOrFail();
        $this->assertNull($row->deleted);
    }

    public function testMissingAuthorizationHeaderIsUnauthorized(): void
    {
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest(null), $this->recordingHandler());
    }

    public function testNonBearerAuthorizationHeaderIsUnauthorized(): void
    {
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $request = (new ServerRequest(['url' => '/api/orgs']))
            ->withHeader('Authorization', 'Basic dXNlcjpwYXNz');

        $this->expectException(UnauthorizedException::class);
        $middleware->process($request, $this->recordingHandler());
    }

    public function testExpiredTokenIsUnauthorized(): void
    {
        $token = $this->makeToken(['exp' => time() - 60, 'iat' => time() - 120]);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testWrongAudienceIsUnauthorized(): void
    {
        $token = $this->makeToken(['aud' => 'some-other-audience']);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testWrongIssuerIsUnauthorized(): void
    {
        $token = $this->makeToken(['iss' => 'https://not-our-project.supabase.co/auth/v1']);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testMissingEmailClaimIsUnauthorized(): void
    {
        $claims = [
            'sub' => '44444444-4444-4444-4444-444444444444',
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ];
        $token = JWT::encode($claims, $this->privateKeyPem, 'RS256', self::KID);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testBadSignatureIsUnauthorized(): void
    {
        [$otherPrivateKey] = $this->generateRsaKeyPair();
        // Signed with a key that doesn't match anything in the (fake) JWKS.
        $token = $this->makeToken([], $otherPrivateKey);
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testUnknownKeyIdIsUnauthorized(): void
    {
        $token = $this->makeToken([], null, 'a-kid-not-in-the-jwks');
        $middleware = new AuthMiddleware($this->fakeJwksProvider());

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testJwksProviderFailureIsUnauthorized(): void
    {
        $failingProvider = new class implements JwksProviderInterface {
            public function getKeySet(): array
            {
                throw new RuntimeException('JWKS endpoint unreachable');
            }
        };
        $token = $this->makeToken();
        $middleware = new AuthMiddleware($failingProvider);

        $this->expectException(UnauthorizedException::class);
        $middleware->process($this->makeRequest($token), $this->recordingHandler());
    }

    public function testHealthCheckPathSkipsAuthEvenWithoutAToken(): void
    {
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $handler = $this->recordingHandler();

        $response = $middleware->process($this->makeRequest(null, '/api/health'), $handler);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($handler->capturedRequest?->getAttribute('identity'));
    }

    public function testNonApiPathSkipsAuthEvenWithoutAToken(): void
    {
        $middleware = new AuthMiddleware($this->fakeJwksProvider());
        $handler = $this->recordingHandler();

        $response = $middleware->process($this->makeRequest(null, '/pages/home'), $handler);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertNull($handler->capturedRequest?->getAttribute('identity'));
    }
}
