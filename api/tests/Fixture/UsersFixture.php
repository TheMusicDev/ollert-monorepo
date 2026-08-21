<?php
declare(strict_types=1);

namespace App\Test\Fixture;

use Cake\TestSuite\Fixture\TestFixture;

/**
 * Users fixture.
 *
 * No seed records — table schema comes from the migrated test DB (see
 * config/Migrations/20260821203724_CreateUsers.php); tests insert whatever
 * rows they need via `UsersTable::findOrCreate()`/`save()` directly.
 */
class UsersFixture extends TestFixture
{
}
