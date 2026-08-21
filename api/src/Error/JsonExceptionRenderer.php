<?php
declare(strict_types=1);

namespace App\Error;

use App\Exception\ApiException;
use Cake\Core\Configure;
use Cake\Core\Exception\HttpErrorCodeInterface;
use Cake\Error\ExceptionRendererInterface;
use Cake\Error\Renderer\WebExceptionRenderer;
use Cake\Http\Exception\HttpException;
use Cake\Http\Response;
use Cake\Http\ResponseEmitter;
use Cake\Http\ServerRequest;
use Cake\ORM\Exception\PersistenceFailedException;
use Cake\Utility\Hash;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * Renders uncaught exceptions from `/api/*` requests as the standard JSON
 * error envelope: `{ error: { message, code, fields? } }`.
 *
 * See planning/api-contract.md#error-response-shape for the authoritative
 * shape. Requests outside `/api` (the leftover CakePHP skeleton `Pages`
 * routes) are delegated to the stock `WebExceptionRenderer` unchanged, since
 * they're not part of the product surface described in that contract.
 *
 * Status/code resolution:
 * - Any exception implementing `Cake\Core\Exception\HttpErrorCodeInterface`
 *   (i.e. `Cake\Http\Exception\HttpException` and subclasses) uses its own
 *   `getCode()` as the HTTP status.
 * - `App\Exception\ApiException` additionally supplies the machine-readable
 *   `code` slug and, for 422s, the `fields` map — throw this from
 *   controllers/components for business-rule and validation failures.
 * - `Cake\ORM\Exception\PersistenceFailedException` (thrown by `saveOrFail()`)
 *   is treated as a 422 `validation_failed`, with `fields` derived from
 *   `$entity->getErrors()`.
 * - Anything else is a 500 `internal_server_error`.
 * - 404s always use `code: "not_found"`, regardless of exception type.
 * - 401s never carry a body (see `renderApiResponse()`).
 */
class JsonExceptionRenderer implements ExceptionRendererInterface
{
    /**
     * Default `error.code` slug per HTTP status, used whenever the exception
     * doesn't supply its own (via `ApiException`).
     *
     * @var array<int, string>
     */
    protected const DEFAULT_CODES = [
        400 => 'bad_request',
        401 => 'unauthorized',
        403 => 'forbidden',
        404 => 'not_found',
        405 => 'method_not_allowed',
        409 => 'conflict',
        422 => 'validation_failed',
        429 => 'too_many_requests',
        500 => 'internal_server_error',
        503 => 'service_unavailable',
    ];

    /**
     * Default `error.message` used for 500s when debug is off, so internal
     * details (stack traces, DB errors, etc.) never leak to clients.
     *
     * @var string
     */
    protected const GENERIC_SERVER_ERROR_MESSAGE = 'An internal error has occurred.';

    /**
     * @var \Throwable
     */
    protected Throwable $error;

    /**
     * @var \Psr\Http\Message\ServerRequestInterface|null
     */
    protected ?ServerRequestInterface $request;

    /**
     * @param \Throwable $exception The exception being handled.
     * @param \Psr\Http\Message\ServerRequestInterface|null $request The request, if available.
     * @param array<string, mixed> $config Renderer config, as passed by `Cake\Error\ExceptionTrap`. Unused here.
     */
    public function __construct(Throwable $exception, ?ServerRequestInterface $request = null, array $config = [])
    {
        $this->error = $exception;
        $this->request = $request;
    }

    /**
     * @return \Psr\Http\Message\ResponseInterface
     */
    public function render(): ResponseInterface
    {
        if (!$this->isApiRequest()) {
            $request = $this->request instanceof ServerRequest ? $this->request : null;

            return (new WebExceptionRenderer($this->error, $request))->render();
        }

        return $this->renderApiResponse();
    }

    /**
     * @param \Psr\Http\Message\ResponseInterface|string $output The response to output.
     * @return void
     */
    public function write(ResponseInterface|string $output): void
    {
        if (is_string($output)) {
            echo $output;

            return;
        }

        (new ResponseEmitter())->emit($output);
    }

    /**
     * Whether the current request targets the JSON API (`/api/*`), as
     * opposed to the leftover skeleton `Pages`/fallback HTML routes.
     *
     * Defaults to true when no request is available, since the product is
     * API-only and that's the safer default to fail into.
     *
     * @return bool
     */
    protected function isApiRequest(): bool
    {
        if ($this->request === null) {
            return true;
        }

        $path = $this->request->getUri()->getPath();

        return $path === '/api' || str_starts_with($path, '/api/');
    }

    /**
     * Build the JSON envelope response for an `/api/*` request.
     *
     * @return \Psr\Http\Message\ResponseInterface
     */
    protected function renderApiResponse(): ResponseInterface
    {
        $exception = $this->error;
        $status = $this->getStatusCode($exception);

        $response = (new Response())->withStatus($status);
        if ($exception instanceof HttpException) {
            foreach ($exception->getHeaders() as $name => $value) {
                $response = $response->withHeader($name, $value);
            }
        }

        // The only 401 this API produces is missing/invalid/expired JWT
        // (see planning/api-contract.md#error-response-shape) — the
        // frontend never inspects its body, so it stays bodyless rather
        // than risk leaking auth-related detail.
        if ($status === 401) {
            return $response;
        }

        [$code, $fields] = $this->resolveCodeAndFields($exception, $status);
        $message = $this->resolveMessage($exception, $status);

        $body = [
            'error' => [
                'message' => $message,
                'code' => $code,
            ],
        ];
        if ($fields !== null && $fields !== []) {
            $body['error']['fields'] = $fields;
        }

        return $response
            ->withType('application/json')
            ->withStringBody((string)json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @param \Throwable $exception The exception being rendered.
     * @return int A valid HTTP status code.
     */
    protected function getStatusCode(Throwable $exception): int
    {
        if ($exception instanceof PersistenceFailedException) {
            return 422;
        }

        if ($exception instanceof HttpErrorCodeInterface) {
            $code = $exception->getCode();
            if ($code >= 400 && $code < 600) {
                return $code;
            }
        }

        return 500;
    }

    /**
     * Resolve the `error.code` slug and `error.fields` map for an exception.
     *
     * @param \Throwable $exception The exception being rendered.
     * @param int $status The resolved HTTP status code.
     * @return array{0: string, 1: array<string, array<string>>|null}
     */
    protected function resolveCodeAndFields(Throwable $exception, int $status): array
    {
        // 404 always uses `not_found`, regardless of exception type/message.
        if ($status === 404) {
            return ['not_found', null];
        }

        if ($exception instanceof ApiException) {
            return [$exception->getErrorCode(), $this->nonEmptyFields($exception->getFields())];
        }

        if ($exception instanceof PersistenceFailedException) {
            return ['validation_failed', $this->fieldsFromEntityErrors($exception->getEntity()->getErrors())];
        }

        return [self::DEFAULT_CODES[$status] ?? 'internal_server_error', null];
    }

    /**
     * @param \Throwable $exception The exception being rendered.
     * @param int $status The resolved HTTP status code.
     * @return string
     */
    protected function resolveMessage(Throwable $exception, int $status): string
    {
        $debug = (bool)Configure::read('debug');

        if ($status >= 500 && !$debug) {
            return self::GENERIC_SERVER_ERROR_MESSAGE;
        }

        if ($exception instanceof PersistenceFailedException) {
            return 'Validation failed.';
        }

        $message = $exception->getMessage();

        return $message !== '' ? $message : self::DEFAULT_CODES[$status] ?? self::GENERIC_SERVER_ERROR_MESSAGE;
    }

    /**
     * Normalizes a `fields` map so it's only ever null or non-empty, and
     * every included field has at least one message — matching the
     * frontend's `Partial<Record<string, string[]>>` contract exactly
     * (planning/api-contract.md#error-response-shape): never an empty
     * `fields` object, never a key with no entries.
     *
     * @param array<string, array<string>>|null $fields Raw fields map.
     * @return array<string, array<string>>|null
     */
    protected function nonEmptyFields(?array $fields): ?array
    {
        if ($fields === null) {
            return null;
        }

        $result = [];
        foreach ($fields as $field => $messages) {
            $messages = array_values(array_filter(
                is_array($messages) ? $messages : [$messages],
                static fn($message): bool => $message !== null && $message !== '',
            ));
            if ($messages !== []) {
                $result[$field] = $messages;
            }
        }

        return $result === [] ? null : $result;
    }

    /**
     * Converts a CakePHP entity `getErrors()` map (field => [rule => message],
     * possibly nested for associated data) into the flat field => [messages]
     * shape the contract expects.
     *
     * @param array<string, mixed> $errors Raw errors from `EntityInterface::getErrors()`.
     * @return array<string, array<string>>|null
     */
    protected function fieldsFromEntityErrors(array $errors): ?array
    {
        $fields = [];
        foreach ($errors as $field => $ruleErrors) {
            if (!is_array($ruleErrors)) {
                $fields[$field] = [(string)$ruleErrors];
                continue;
            }
            $fields[$field] = array_values(array_map('strval', Hash::flatten($ruleErrors)));
        }

        return $this->nonEmptyFields($fields);
    }
}
