<?php
declare(strict_types=1);

namespace App\Test\TestCase\Error;

use App\Error\JsonExceptionRenderer;
use App\Exception\ApiException;
use Cake\Core\Configure;
use Cake\Http\Exception\ForbiddenException;
use Cake\Http\Exception\NotFoundException;
use Cake\Http\Exception\UnauthorizedException;
use Cake\Http\ServerRequest;
use Cake\ORM\Entity;
use Cake\ORM\Exception\PersistenceFailedException;
use Cake\TestSuite\TestCase;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;

/**
 * Tests for the custom `/api/*` JSON error envelope renderer.
 *
 * See planning/api-contract.md#error-response-shape for the contract this
 * exercises.
 */
class JsonExceptionRendererTest extends TestCase
{
    /**
     * @var bool
     */
    protected bool $originalDebug;

    /**
     * @return void
     */
    public function setUp(): void
    {
        parent::setUp();
        $this->originalDebug = (bool)Configure::read('debug');
    }

    /**
     * @return void
     */
    public function tearDown(): void
    {
        Configure::write('debug', $this->originalDebug);
        parent::tearDown();
    }

    /**
     * @param string $url The request URL to build.
     * @return \Cake\Http\ServerRequest
     */
    protected function apiRequest(string $url = '/api/orgs'): ServerRequest
    {
        return new ServerRequest(['url' => $url]);
    }

    /**
     * @return array{0: array<string, mixed>, 1: int}
     */
    protected function decode(ResponseInterface $response): array
    {
        $body = (string)$response->getBody();
        $decoded = $body === '' ? [] : json_decode($body, true);

        return [$decoded, $response->getStatusCode()];
    }

    /**
     * @return void
     */
    public function testNotFoundUsesNotFoundCode(): void
    {
        $exception = new NotFoundException('Board not found');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/boards/999'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(404, $status);
        $this->assertSame('Board not found', $json['error']['message']);
        $this->assertSame('not_found', $json['error']['code']);
        $this->assertArrayNotHasKey('fields', $json['error']);
    }

    /**
     * @return void
     */
    public function testNotFoundCodeIsForcedEvenForApiException(): void
    {
        // Even a custom code slug on a 404 must come out as `not_found`,
        // per the contract: "404 uses code: not_found".
        $exception = new ApiException('Board not found', 'board_missing', 404);
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/boards/999'));

        [$json] = $this->decode($renderer->render());

        $this->assertSame('not_found', $json['error']['code']);
    }

    /**
     * @return void
     */
    public function testForbiddenRendersEnvelope(): void
    {
        $exception = new ForbiddenException('You are not a member of this organization.');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs/1'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(403, $status);
        $this->assertSame('You are not a member of this organization.', $json['error']['message']);
        $this->assertSame('forbidden', $json['error']['code']);
    }

    /**
     * @return void
     */
    public function testForbiddenApiExceptionCarriesCustomCode(): void
    {
        $exception = new ApiException(
            'You are not a member of this organization.',
            'not_org_member',
            403,
        );
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs/1'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(403, $status);
        $this->assertSame('not_org_member', $json['error']['code']);
    }

    /**
     * A bare 401 (missing/invalid/expired JWT) stays bodyless — no envelope.
     * See planning/api-contract.md#error-response-shape.
     *
     * @return void
     */
    public function testUnauthorizedHasNoBody(): void
    {
        $exception = new UnauthorizedException('Invalid token');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        $response = $renderer->render();

        $this->assertSame(401, $response->getStatusCode());
        $this->assertSame('', (string)$response->getBody());
    }

    /**
     * @return void
     */
    public function testGenericExceptionRendersGenericMessageWhenDebugOff(): void
    {
        Configure::write('debug', false);

        $exception = new RuntimeException('Connection refused: mysql://internal-host');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(500, $status);
        $this->assertSame('An internal error has occurred.', $json['error']['message']);
        $this->assertSame('internal_server_error', $json['error']['code']);
        $this->assertStringNotContainsString('mysql://', $json['error']['message']);
    }

    /**
     * @return void
     */
    public function testGenericExceptionRendersActualMessageWhenDebugOn(): void
    {
        Configure::write('debug', true);

        $exception = new RuntimeException('Something specific broke');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(500, $status);
        $this->assertSame('Something specific broke', $json['error']['message']);
    }

    /**
     * The critical contract: `fields` is present only for the field(s) that
     * actually failed, never an empty array and never a key with no entries.
     * The frontend's `ApiErrorFields` type is `Partial<Record<string, string[]>>`
     * specifically because of this — see web/src/lib/api-client.ts.
     *
     * @return void
     */
    public function testFieldsOnlyIncludesFieldsThatActuallyFailed(): void
    {
        $exception = new ApiException(
            'Validation failed.',
            'validation_failed',
            422,
            [
                'title' => ['Title is required'],
                // Simulates a caller accidentally including a field with no
                // actual errors — must be dropped, not passed through empty.
                'description' => [],
            ],
        );
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/boards'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(422, $status);
        $this->assertSame('validation_failed', $json['error']['code']);
        $this->assertSame(['title' => ['Title is required']], $json['error']['fields']);
        $this->assertArrayNotHasKey('description', $json['error']['fields']);
    }

    /**
     * A 422 with no field-level errors (e.g. a quota check) must omit
     * `fields` entirely rather than send `fields: {}` or `fields: null`.
     *
     * @return void
     */
    public function testFieldsKeyOmittedWhenNoFieldsFailed(): void
    {
        $exception = new ApiException(
            'You have reached your organization quota.',
            'quota_exceeded',
            422,
        );
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(422, $status);
        $this->assertSame('quota_exceeded', $json['error']['code']);
        $this->assertArrayNotHasKey('fields', $json['error']);
    }

    /**
     * An `ApiException` whose `fields` map has only empty-array entries must
     * behave identically to one with no `fields` at all: key omitted.
     *
     * @return void
     */
    public function testFieldsKeyOmittedWhenAllProvidedFieldsAreEmpty(): void
    {
        $exception = new ApiException(
            'Validation failed.',
            'validation_failed',
            422,
            ['title' => []],
        );
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/boards'));

        [$json] = $this->decode($renderer->render());

        $this->assertArrayNotHasKey('fields', $json['error']);
    }

    /**
     * `Cake\ORM\Exception\PersistenceFailedException` (thrown by `saveOrFail()`)
     * is a realistic source of 422s from Section 2 controllers — its entity
     * errors must reshape into the same field => [messages] contract.
     *
     * @return void
     */
    public function testPersistenceFailedExceptionRendersFieldsFromEntityErrors(): void
    {
        $entity = new Entity();
        $entity->setErrors([
            'title' => ['_required' => 'This field is required'],
            'position' => [],
        ]);
        $exception = new PersistenceFailedException($entity, 'Entity failure.');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/boards'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(422, $status);
        $this->assertSame('validation_failed', $json['error']['code']);
        $this->assertSame(['title' => ['This field is required']], $json['error']['fields']);
        $this->assertArrayNotHasKey('position', $json['error']['fields']);
    }

    /**
     * With no request context available, default to the JSON envelope
     * (this is an API-only app) rather than the HTML renderer.
     *
     * @return void
     */
    public function testNullRequestDefaultsToJsonEnvelope(): void
    {
        $exception = new NotFoundException('Not found');
        $renderer = new JsonExceptionRenderer($exception, null);

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(404, $status);
        $this->assertSame('not_found', $json['error']['code']);
    }

    /**
     * Requests outside `/api` (the leftover CakePHP skeleton routes) must not
     * get the JSON envelope — they fall back to the stock HTML renderer.
     *
     * @return void
     */
    public function testNonApiRequestIsNotRenderedAsJson(): void
    {
        $exception = new NotFoundException('Not found');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/pages/not-a-page'));

        $response = $renderer->render();

        $this->assertStringNotContainsString('application/json', $response->getHeaderLine('Content-Type'));
    }

    /**
     * @return void
     */
    public function testResponseContentTypeIsJson(): void
    {
        $exception = new ForbiddenException('Forbidden');
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        $response = $renderer->render();

        $this->assertStringContainsString('application/json', $response->getHeaderLine('Content-Type'));
    }

    /**
     * An exception message containing invalid UTF-8 must not collapse the
     * envelope into an empty body: `json_encode()` would otherwise return
     * `false`, and casting that to string silently discards the promised
     * `code` (and any `fields`). Invalid bytes are substituted instead.
     *
     * @return void
     */
    public function testInvalidUtf8MessageStillRendersEnvelope(): void
    {
        Configure::write('debug', true);

        $exception = new ApiException("Bad byte: \xB1\x31", 'bad_input', 400);
        $renderer = new JsonExceptionRenderer($exception, $this->apiRequest('/api/orgs'));

        [$json, $status] = $this->decode($renderer->render());

        $this->assertSame(400, $status);
        $this->assertSame('bad_input', $json['error']['code']);
        $this->assertNotSame('', $json['error']['message']);
    }
}
