<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Boards fixture. A single board under the fixture org
 * (OrganizationsFixture's "Acme Org"), used only by
 * `OrganizationsControllerTest` to assert `GET /api/orgs/:id` nests its
 * org's boards. `feat/api-boards` owns `BoardsController` and its own
 * fixtures/tests for board CRUD; this fixture only exercises the read-only
 * containment on the org resource, not board behavior itself.
 */
class BoardsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '50000000-0000-4000-8000-000000000001',
            'org_id' => '30000000-0000-4000-8000-000000000001',
            'title' => 'Launch Board',
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
