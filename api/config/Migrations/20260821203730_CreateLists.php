<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class CreateLists extends BaseMigration
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
        $table = $this->table('lists');
        $table
            ->addColumn('id', 'uuid')
            ->addPrimaryKey('id')
            ->addColumn('board_id', 'uuid', [
                'null' => false,
            ])
            ->addColumn('title', 'string', [
                'limit' => 255,
                'null' => false,
            ])
            ->addColumn('position', 'float', [
                'null' => false,
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
            ->addIndex(['board_id'])
            ->addForeignKey('board_id', 'boards', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->create();
    }
}
