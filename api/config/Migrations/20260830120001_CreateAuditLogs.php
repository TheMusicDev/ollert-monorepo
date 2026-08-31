<?php
declare(strict_types=1);

use Migrations\BaseMigration;

/**
 * Audit trail of every mutation across the app — who did what, to what, and
 * the before/after field values. Deliberately append-only: no `modified`
 * column (rows are never updated) and no `TrashBehavior` on the Table class
 * (rows are never deleted either) — unlike every other table in this app.
 */
class CreateAuditLogs extends BaseMigration
{
    /**
     * @var bool
     */
    public bool $autoId = false;

    /**
     * Change Method.
     *
     * @return void
     */
    public function change(): void
    {
        $table = $this->table('audit_logs');
        $table
            ->addColumn('id', 'uuid')
            ->addPrimaryKey('id')
            ->addColumn('actor_id', 'uuid', [
                'null' => false,
            ])
            ->addColumn('org_id', 'uuid', [
                'null' => true,
                'default' => null,
            ])
            ->addColumn('resource_type', 'string', [
                'limit' => 32,
                'null' => false,
            ])
            ->addColumn('resource_id', 'uuid', [
                'null' => false,
            ])
            ->addColumn('action', 'string', [
                'limit' => 16,
                'null' => false,
            ])
            ->addColumn('changes', 'text', [
                'null' => false,
            ])
            ->addColumn('created', 'datetime', [
                'null' => false,
            ])
            ->addIndex(['actor_id'])
            ->addIndex(['org_id'])
            ->addIndex(['resource_type', 'resource_id'])
            ->addForeignKey('actor_id', 'users', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->addForeignKey('org_id', 'organizations', 'id', [
                'update' => 'NO_ACTION',
                'delete' => 'NO_ACTION',
            ])
            ->create();
    }
}
