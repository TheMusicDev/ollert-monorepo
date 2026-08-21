<?php
declare(strict_types=1);

namespace App\Test\TestCase\Middleware;

use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Integration test for App\Middleware\CorsMiddleware, exercised end to end
 * through the real Application middleware queue (see App::middleware()).
 *
 * Policy under test (see planning/architecture.md#cors):
 * - Allowed origins come from the CORS_ALLOWED_ORIGINS env var.
 * - Allowed headers: Authorization, Content-Type.
 * - Allowed methods: GET, POST, PATCH, DELETE, OPTIONS.
 * - Access-Control-Allow-Credentials is never set.
 */
class CorsMiddlewareTest extends TestCase
{
    use IntegrationTestTrait;

    private const ALLOWED_ORIGIN = 'http://localhost:5173';
    private const DISALLOWED_ORIGIN = 'http://evil.example';

    /**
     * @var string|false
     */
    private string|false $originalEnv;

    protected function setUp(): void
    {
        parent::setUp();

        $this->originalEnv = $_SERVER['CORS_ALLOWED_ORIGINS'] ?? false;
        $_SERVER['CORS_ALLOWED_ORIGINS'] = self::ALLOWED_ORIGIN . ',https://ollert.example.com';
    }

    protected function tearDown(): void
    {
        if ($this->originalEnv === false) {
            unset($_SERVER['CORS_ALLOWED_ORIGINS']);
        } else {
            $_SERVER['CORS_ALLOWED_ORIGINS'] = $this->originalEnv;
        }

        parent::tearDown();
    }

    public function testAllowedOriginGetsAllowOriginHeaderOnRealRequest(): void
    {
        $this->configRequest(['headers' => ['Origin' => self::ALLOWED_ORIGIN]]);
        $this->get('/pages/home');

        $this->assertResponseOk();
        $this->assertHeader('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN);
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }

    public function testDisallowedOriginGetsNoAllowOriginHeaderOnRealRequest(): void
    {
        $this->configRequest(['headers' => ['Origin' => self::DISALLOWED_ORIGIN]]);
        $this->get('/pages/home');

        $this->assertResponseOk();
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Origin'));
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }

    public function testNoOriginHeaderGetsNoCorsHeaders(): void
    {
        $this->get('/pages/home');

        $this->assertResponseOk();
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Origin'));
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }

    public function testAllowedOriginPreflightGetsFullCorsHeaders(): void
    {
        $this->configRequest([
            'headers' => [
                'Origin' => self::ALLOWED_ORIGIN,
                'Access-Control-Request-Method' => 'POST',
            ],
        ]);
        $this->options('/pages/home');

        $this->assertResponseCode(204);
        $this->assertHeader('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN);
        $this->assertHeaderContains('Access-Control-Allow-Methods', 'GET');
        $this->assertHeaderContains('Access-Control-Allow-Methods', 'POST');
        $this->assertHeaderContains('Access-Control-Allow-Methods', 'PATCH');
        $this->assertHeaderContains('Access-Control-Allow-Methods', 'DELETE');
        $this->assertHeaderContains('Access-Control-Allow-Methods', 'OPTIONS');
        $this->assertHeaderContains('Access-Control-Allow-Headers', 'Authorization');
        $this->assertHeaderContains('Access-Control-Allow-Headers', 'Content-Type');
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }

    public function testDisallowedOriginPreflightGetsNoCorsHeaders(): void
    {
        $this->configRequest([
            'headers' => [
                'Origin' => self::DISALLOWED_ORIGIN,
                'Access-Control-Request-Method' => 'POST',
            ],
        ]);
        $this->options('/pages/home');

        $this->assertResponseCode(204);
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Origin'));
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Methods'));
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Headers'));
        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }

    public function testPreflightNeverSetsAllowCredentials(): void
    {
        $this->configRequest([
            'headers' => [
                'Origin' => self::ALLOWED_ORIGIN,
                'Access-Control-Request-Method' => 'GET',
            ],
        ]);
        $this->options('/pages/home');

        $this->assertFalse($this->_response->hasHeader('Access-Control-Allow-Credentials'));
    }
}
