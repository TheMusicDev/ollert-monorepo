<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Cards fixture. Two cards under the "To Do" list (`ListsFixture`'s
 * `60000000-...-0001`, itself on "Board One"), giving `BoardsControllerTest`
 * fixed, ordered (`position`) nested data two levels deep to assert on for
 * `BoardsController::view()`'s unpaginated nested lists+cards response.
 */
class CardsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '70000000-0000-4000-8000-000000000001',
            'list_id' => '60000000-0000-4000-8000-000000000001',
            'title' => 'Card A',
            'description' => null,
            'due_date' => null,
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '70000000-0000-4000-8000-000000000002',
            'list_id' => '60000000-0000-4000-8000-000000000001',
            'title' => 'Card B',
            'description' => null,
            'due_date' => null,
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
