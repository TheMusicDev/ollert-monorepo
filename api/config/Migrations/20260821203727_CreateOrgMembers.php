<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class CreateOrgMembers extends BaseMigration
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
        $table = $this->table('org_members');
        $table
            ->addColumn('id', 'uuid')
            ->addPrimaryKey('id')
            ->addColumn('org_id', 'uuid', [
                'null' => false,
            ])
            ->addColumn('user_id', 'uuid', [
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
            ->addIndex(['org_id'])
            ->addIndex(['user_id'])
            ->addIndex(['org_id', 'user_id'], ['unique' => true])
            ->addForeignKey('org_id', 'organizations', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->addForeignKey('user_id', 'users', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->create();
    }
}
