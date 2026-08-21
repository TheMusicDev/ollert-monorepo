<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;

/**
 * Tests for `GET /api/health` (App\Controller\HealthController) — the
 * unauthenticated liveness check (planning/api-contract.md#misc).
 */
class HealthControllerTest extends TestCase
{
    use IntegrationTestTrait;

    public function testHealthCheckRespondsOkWithoutAuthentication(): void
    {
        $this->get('/api/health');

        $this->assertResponseOk();
        $this->assertContentType('application/json');
        $this->assertSame(['status' => 'ok'], json_decode((string)$this->_response->getBody(), true));
    }

    public function testHealthCheckDoesNotAcceptNonGetMethods(): void
    {
        $this->post('/api/health', []);

        $this->assertResponseError();
    }
}
