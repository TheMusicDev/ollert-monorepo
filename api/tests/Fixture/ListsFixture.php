<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Lists fixture. Two lists under "Board One" (`BoardsFixture`'s
 * `50000000-...-0001`), giving `BoardsControllerTest` fixed, ordered
 * (`position`) nested data to assert on for `BoardsController::view()`'s
 * unpaginated nested lists+cards response.
 */
class ListsFixture extends TestFixture
{
    /**
     * @var array<int, array<string, mixed>>
     */
    public array $records = [
        [
            'id' => '60000000-0000-4000-8000-000000000001',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'To Do',
            'position' => 1.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
        [
            'id' => '60000000-0000-4000-8000-000000000002',
            'board_id' => '50000000-0000-4000-8000-000000000001',
            'title' => 'Done',
            'position' => 2.0,
            'created' => '2026-01-01 00:00:00',
            'modified' => '2026-01-01 00:00:00',
            'deleted' => null,
        ],
    ];
}
