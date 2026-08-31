<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\RulesChecker;
use Cake\ORM\Table;
use Cake\Validation\Validator;

/**
 * AuditLogs Model
 *
 * Append-only: no TrashBehavior, no `modified` column. Rows are written once
 * by App\Service\AuditLogService and never updated or deleted.
 *
 * @property \App\Model\Table\UsersTable&\Cake\ORM\Association\BelongsTo $Actors
 * @property \App\Model\Table\OrganizationsTable&\Cake\ORM\Association\BelongsTo $Organizations
 * @method \App\Model\Entity\AuditLog newEmptyEntity()
 * @method \App\Model\Entity\AuditLog newEntity(array $data, array $options = [])
 * @method array<\App\Model\Entity\AuditLog> newEntities(array $data, array $options = [])
 * @method \App\Model\Entity\AuditLog get(mixed $primaryKey, array|string $finder = 'all', \Psr\SimpleCache\CacheInterface|string|null $cache = null, \Closure|string|null $cacheKey = null, mixed ...$args)
 * @method \App\Model\Entity\AuditLog findOrCreate($search, ?callable $callback = null, array $options = [])
 * @method \App\Model\Entity\AuditLog patchEntity(\Cake\Datasource\EntityInterface $entity, array $data, array $options = [])
 * @method array<\App\Model\Entity\AuditLog> patchEntities(iterable $entities, array $data, array $options = [])
 * @method \App\Model\Entity\AuditLog|false save(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method \App\Model\Entity\AuditLog saveOrFail(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method iterable<\App\Model\Entity\AuditLog>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\AuditLog>|false saveMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\AuditLog>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\AuditLog> saveManyOrFail(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\AuditLog>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\AuditLog>|false deleteMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\AuditLog>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\AuditLog> deleteManyOrFail(iterable $entities, array $options = [])
 */
class AuditLogsTable extends Table
{
    /**
     * Initialize method
     *
     * @param array<string, mixed> $config The configuration for the Table.
     * @return void
     */
    public function initialize(array $config): void
    {
        parent::initialize($config);

        $this->setTable('audit_logs');
        $this->setDisplayField('action');
        $this->setPrimaryKey('id');

        $this->belongsTo('Actors', [
            'className' => 'Users',
            'foreignKey' => 'actor_id',
            'joinType' => 'INNER',
        ]);
        $this->belongsTo('Organizations', [
            'foreignKey' => 'org_id',
            'joinType' => 'LEFT',
        ]);
    }

    /**
     * Default validation rules.
     *
     * @param \Cake\Validation\Validator $validator Validator instance.
     * @return \Cake\Validation\Validator
     */
    public function validationDefault(Validator $validator): Validator
    {
        $validator
            ->uuid('actor_id')
            ->notEmptyString('actor_id');

        $validator
            ->uuid('org_id')
            ->allowEmptyString('org_id');

        $validator
            ->scalar('resource_type')
            ->maxLength('resource_type', 32)
            ->requirePresence('resource_type', 'create')
            ->notEmptyString('resource_type');

        $validator
            ->uuid('resource_id')
            ->requirePresence('resource_id', 'create')
            ->notEmptyString('resource_id');

        $validator
            ->scalar('action')
            ->maxLength('action', 16)
            ->requirePresence('action', 'create')
            ->notEmptyString('action');

        $validator
            ->scalar('changes')
            ->requirePresence('changes', 'create')
            ->notEmptyString('changes');

        return $validator;
    }

    /**
     * Returns a rules checker object that will be used for validating
     * application integrity.
     *
     * @param \Cake\ORM\RulesChecker $rules The rules object to be modified.
     * @return \Cake\ORM\RulesChecker
     */
    public function buildRules(RulesChecker $rules): RulesChecker
    {
        $rules->add($rules->existsIn(['actor_id'], 'Actors'), ['errorField' => 'actor_id']);

        // No existsIn rule on org_id: `Organizations`' default finder is
        // scoped by `Muffin/Trash.Trash` to exclude soft-deleted rows, but an
        // audit log for the org's own deletion (or any action logged after
        // it) must still reference it — the row still physically exists, and
        // the DB-level foreign key (see the CreateAuditLogs migration) is
        // enough to guarantee it always did.

        return $rules;
    }
}
