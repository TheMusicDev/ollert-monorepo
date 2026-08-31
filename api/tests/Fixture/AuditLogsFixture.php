<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * AuditLogs fixture — no seed rows. Every controller test that exercises a
 * mutating action now writes a real row via `App\Service\AuditLogService`;
 * this fixture's only job is to make `audit_logs` a table the test fixture
 * strategy knows to truncate after each test, since `actor_id`/`org_id`
 * foreign keys onto `users`/`organizations` would otherwise block truncating
 * those tables between tests.
 */
class AuditLogsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [];
}
