<?php
declare(strict_types=1);

namespace App\Test\TestCase\Exception;

use App\Exception\ApiException;
use Cake\Core\Exception\HttpErrorCodeInterface;
use Cake\TestSuite\TestCase;

/**
 * Tests for the general-purpose app/business-rule exception used to drive
 * the JSON error envelope. See App\Error\JsonExceptionRenderer.
 */
class ApiExceptionTest extends TestCase
{
    /**
     * @return void
     */
    public function testCarriesMessageCodeStatusAndFields(): void
    {
        $exception = new ApiException(
            'Validation failed.',
            'validation_failed',
            422,
            ['title' => ['Title is required']],
        );

        $this->assertSame('Validation failed.', $exception->getMessage());
        $this->assertSame('validation_failed', $exception->getErrorCode());
        $this->assertSame(422, $exception->getCode());
        $this->assertSame(['title' => ['Title is required']], $exception->getFields());
    }

    /**
     * @return void
     */
    public function testFieldsDefaultToNull(): void
    {
        $exception = new ApiException('You have reached your organization quota.', 'quota_exceeded', 422);

        $this->assertNull($exception->getFields());
    }

    /**
     * @return void
     */
    public function testIsAnHttpErrorCodeException(): void
    {
        $exception = new ApiException('Forbidden', 'forbidden', 403);

        $this->assertInstanceOf(HttpErrorCodeInterface::class, $exception);
    }
}
