<?php
declare(strict_types=1);

namespace App\Middleware;

use Cake\Http\Response;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Applies the API's CORS allow-list policy (see planning/architecture.md#cors):
 *
 * - Origins: explicit allow-list read from the `CORS_ALLOWED_ORIGINS` env var
 *   (comma-separated), never a wildcard.
 * - Headers: `Authorization`, `Content-Type`.
 * - Methods: `GET, POST, PATCH, DELETE, OPTIONS`.
 * - Credentials: never allowed — `Access-Control-Allow-Credentials` is never set,
 *   since this API uses Bearer-token auth rather than cookies.
 *
 * Runs before ErrorHandlerMiddleware in the queue so CORS headers are applied to
 * error responses too, and short-circuits CORS preflight requests
 * (`OPTIONS` + `Access-Control-Request-Method`) before they reach
 * routing/CSRF/controller dispatch.
 */
class CorsMiddleware implements MiddlewareInterface
{
    /**
     * @var array<string>
     */
    private const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];

    /**
     * @var array<string>
     */
    private const ALLOWED_HEADERS = ['Authorization', 'Content-Type'];

    /**
     * Process the request and apply CORS headers.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request The request.
     * @param \Psr\Http\Server\RequestHandlerInterface $handler The request handler.
     * @return \Psr\Http\Message\ResponseInterface A response.
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        $allowed = $origin !== '' && in_array($origin, $this->getAllowedOrigins(), true);

        if ($this->isPreflight($request)) {
            return $this->buildPreflightResponse($origin, $allowed);
        }

        $response = $handler->handle($request);

        if (!$allowed) {
            return $response;
        }

        return $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Vary', 'Origin');
    }

    /**
     * A CORS preflight request is an OPTIONS request the browser sends ahead of the
     * real one, carrying `Access-Control-Request-Method`. A plain OPTIONS request
     * (no such header) is left for the app to handle normally.
     *
     * @param \Psr\Http\Message\ServerRequestInterface $request The request.
     * @return bool
     */
    private function isPreflight(ServerRequestInterface $request): bool
    {
        return $request->getMethod() === 'OPTIONS' && $request->hasHeader('Access-Control-Request-Method');
    }

    /**
     * @param string $origin The request's Origin header value.
     * @param bool $allowed Whether $origin is on the allow-list.
     * @return \Psr\Http\Message\ResponseInterface
     */
    private function buildPreflightResponse(string $origin, bool $allowed): ResponseInterface
    {
        $response = (new Response())->withStatus(204);

        if (!$allowed) {
            return $response;
        }

        return $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Vary', 'Origin')
            ->withHeader('Access-Control-Allow-Methods', implode(', ', self::ALLOWED_METHODS))
            ->withHeader('Access-Control-Allow-Headers', implode(', ', self::ALLOWED_HEADERS))
            ->withHeader('Access-Control-Max-Age', '86400');
    }

    /**
     * Parses the comma-separated `CORS_ALLOWED_ORIGINS` env var into a list of
     * exact origin strings (e.g. `http://localhost:5173`).
     *
     * @return array<string>
     */
    private function getAllowedOrigins(): array
    {
        $raw = (string)env('CORS_ALLOWED_ORIGINS', '');
        $origins = array_filter(array_map('trim', explode(',', $raw)));

        return array_values($origins);
    }
}
