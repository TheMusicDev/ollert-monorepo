<?php
declare(strict_types=1);

namespace App\Controller;

use Cake\Http\Response;

/**
 * `GET /api/health` — unauthenticated liveness check
 * (planning/api-contract.md#misc). Excluded from JWT verification by
 * `App\Middleware\AuthMiddleware::UNAUTHENTICATED_PATHS`.
 *
 * Deliberately trivial: no DB/cache/external dependency is checked here.
 * This confirms the app booted and is routing requests, not that every
 * downstream dependency is healthy.
 */
class HealthController extends AppController
{
    /**
     * @return \Cake\Http\Response
     */
    public function index(): Response
    {
        $this->request->allowMethod('GET');
        $this->autoRender = false;

        return $this->response
            ->withType('application/json')
            ->withStringBody((string)json_encode(['status' => 'ok']));
    }
}
