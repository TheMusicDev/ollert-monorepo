<?php
declare(strict_types=1);

namespace App\Exception;

use Cake\Http\Exception\HttpException;
use Throwable;

/**
 * General-purpose exception for application/business-rule failures that need
 * to surface a specific machine-readable `code` (and, for 422s, per-field
 * validation `fields`) through the standard JSON error envelope.
 *
 * See planning/api-contract.md#error-response-shape for the envelope shape,
 * and App\Error\JsonExceptionRenderer for how this is turned into a response.
 *
 * Usage:
 * ```php
 * // 422, no fields (business rule failure)
 * throw new ApiException('You have reached your organization quota.', 'quota_exceeded', 422);
 *
 * // 422, with fields (form validation failure)
 * throw new ApiException('Validation failed.', 'validation_failed', 422, [
 *     'title' => ['Title is required'],
 * ]);
 *
 * // 403 with a specific machine-readable code
 * throw new ApiException('You are not a member of this organization.', 'not_org_member', 403);
 * ```
 */
class ApiException extends HttpException
{
    /**
     * Machine-readable slug for the `error.code` field of the envelope.
     *
     * @var string
     */
    protected string $errorCode;

    /**
     * Per-field validation errors for the `error.fields` object, or null when
     * this failure isn't tied to specific fields.
     *
     * @var array<string, array<string>>|null
     */
    protected ?array $fields;

    /**
     * @param string $message Human-readable summary, safe to show/log.
     * @param string $errorCode Machine-readable slug, e.g. `quota_exceeded`.
     * @param int $httpStatus HTTP status code to respond with, e.g. 422.
     * @param array<string, array<string>>|null $fields Field name => list of
     *   error strings, for 422s from form validation. Only include keys for
     *   fields that actually failed — never an empty array or an empty list.
     * @param \Throwable|null $previous The previous exception.
     */
    public function __construct(
        string $message,
        string $errorCode,
        int $httpStatus = 500,
        ?array $fields = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $httpStatus, $previous);
        $this->errorCode = $errorCode;
        $this->fields = $fields;
    }

    /**
     * @return string
     */
    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /**
     * @return array<string, array<string>>|null
     */
    public function getFields(): ?array
    {
        return $this->fields;
    }
}
