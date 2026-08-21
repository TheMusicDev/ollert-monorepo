<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class CreateUsers extends BaseMigration
{
    /**
     * @var bool
     */
    public bool $autoId = false;

    /**
     * Change Method.
     *
     * More information on this method is available here:
     * https://book.cakephp.org/migrations/5/guides/writing-migrations/migration-methods.html#the-change-method
     *
     * @return void
     */
    public function change(): void
    {
        $table = $this->table('users');
        $table
            ->addColumn('id', 'uuid')
            ->addPrimaryKey('id')
            ->addColumn('supabase_uid', 'uuid', [
                'null' => false,
            ])
            ->addColumn('email', 'string', [
                'limit' => 255,
                'null' => false,
            ])
            ->addColumn('display_name', 'string', [
                'limit' => 255,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('max_orgs', 'integer', [
                'null' => false,
                'default' => 1,
            ])
            ->addColumn('max_boards_per_org', 'integer', [
                'null' => false,
                'default' => 3,
            ])
            ->addColumn('max_lists_per_board', 'integer', [
                'null' => false,
                'default' => 5,
            ])
            ->addColumn('max_cards_per_board', 'integer', [
                'null' => false,
                'default' => 100,
            ])
            ->addColumn('created', 'datetime', [
                'null' => false,
            ])
            ->addColumn('modified', 'datetime', [
                'null' => false,
            ])
            ->addColumn('deleted', 'datetime', [
                'null' => true,
                'default' => null,
            ])
            ->addIndex(['supabase_uid'], ['unique' => true])
            ->create();
    }
}
