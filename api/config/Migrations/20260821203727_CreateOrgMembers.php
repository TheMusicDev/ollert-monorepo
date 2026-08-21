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
            // Not unique at the DB level: TrashBehavior soft-deletes (sets `deleted`) rather than
            // removing the row, so a unique DB constraint here would block a removed member from
            // rejoining. Uniqueness among active memberships is enforced in
            // OrgMembersTable::buildRules() via isUnique(), which is correctly scoped to
            // non-trashed rows because TrashBehavior's beforeFind excludes `deleted IS NOT NULL`
            // rows from the default finder used by that rule.
            ->addIndex(['org_id', 'user_id'])
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
