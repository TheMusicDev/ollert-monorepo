<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class CreateCards extends BaseMigration
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
        $table = $this->table('cards');
        $table
            ->addColumn('id', 'uuid')
            ->addPrimaryKey('id')
            ->addColumn('list_id', 'uuid', [
                'null' => false,
            ])
            ->addColumn('title', 'string', [
                'limit' => 255,
                'null' => false,
            ])
            ->addColumn('description', 'text', [
                'null' => true,
                'default' => null,
            ])
            ->addColumn('due_date', 'date', [
                'null' => true,
                'default' => null,
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
            ->addIndex(['list_id'])
            ->addForeignKey('list_id', 'lists', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->create();
    }
}
