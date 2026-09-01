<?php
declare(strict_types=1);

namespace App\Service;

use Cake\Datasource\EntityInterface;
use Cake\I18n\DateTime;
use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * Writes append-only audit trail rows for every mutating controller action.
 * Follows the same explicit-call-from-controller style as QuotaService and
 * OrgAuthorizationService — no ORM-event/behavior magic.
 *
 * Usage for an update: call diffForUpdate() right after patchEntity() but
 * before saveOrFail(), since save() clears the entity's dirty-tracking.
 * Usage for create/delete: call diffForCreate()/diffForDelete() any time
 * before or after the mutation, then write() once the mutation has
 * succeeded, so a failed save never produces a log entry.
 */
class AuditLogService
{
    use LocatorAwareTrait;

    /**
     * Diff for a newly created entity — every field's `from` is null.
     *
     * @param \Cake\Datasource\EntityInterface $entity Freshly saved entity.
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public function diffForCreate(EntityInterface $entity): array
    {
        $changes = [];
        foreach ($entity->toArray() as $field => $value) {
            $changes[$field] = ['from' => null, 'to' => $value];
        }

        return $changes;
    }

    /**
     * Diff for an updated entity. Must be called after patchEntity() but
     * before saveOrFail() — save() cleans the entity's dirty-tracking.
     *
     * @param \Cake\Datasource\EntityInterface $entity Patched, not-yet-saved entity.
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public function diffForUpdate(EntityInterface $entity): array
    {
        $changes = [];
        foreach ($entity->getDirty() as $field) {
            $changes[$field] = [
                'from' => $entity->getOriginal($field),
                'to' => $entity->get($field),
            ];
        }

        return $changes;
    }

    /**
     * Diff for a deleted entity — every field's `to` is null. Safe to call
     * before or after the actual delete() call.
     *
     * @param \Cake\Datasource\EntityInterface $entity Entity being (or already) deleted.
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public function diffForDelete(EntityInterface $entity): array
    {
        $changes = [];
        foreach ($entity->toArray() as $field => $value) {
            $changes[$field] = ['from' => $value, 'to' => null];
        }

        return $changes;
    }

    /**
     * Persists one audit log row. Call only after the real mutation has
     * already succeeded.
     *
     * @param string $actorId `users.id` of whoever performed the action.
     * @param string|null $orgId `organizations.id` the action is scoped to, or
     *   null for actions with no natural org scope (e.g. admin editing a
     *   user's quotas directly).
     * @param string $resourceType `organization`|`org_member`|`board`|`list`|`card`|`user`.
     * @param string $resourceId Primary key of the affected resource.
     * @param string $action `create`|`update`|`delete`.
     * @param array<string, array{from: mixed, to: mixed}> $changes From diffForCreate()/diffForUpdate()/diffForDelete().
     * @return void
     */
    public function write(
        string $actorId,
        ?string $orgId,
        string $resourceType,
        string $resourceId,
        string $action,
        array $changes,
    ): void {
        $auditLogsTable = $this->fetchTable('AuditLogs');
        $auditLog = $auditLogsTable->newEntity([
            'actor_id' => $actorId,
            'org_id' => $orgId,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'action' => $action,
            'changes' => json_encode($changes, JSON_THROW_ON_ERROR),
        ]);
        $auditLog->created = new DateTime();
        $auditLogsTable->saveOrFail($auditLog);
    }
}
