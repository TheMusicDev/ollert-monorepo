<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\RulesChecker;
use Cake\ORM\Table;
use Cake\Validation\Validator;

/**
 * OrgMembers Model
 *
 * @property \App\Model\Table\OrganizationsTable&\Cake\ORM\Association\BelongsTo $Organizations
 * @property \App\Model\Table\UsersTable&\Cake\ORM\Association\BelongsTo $Users
 * @method \App\Model\Entity\OrgMember newEmptyEntity()
 * @method \App\Model\Entity\OrgMember newEntity(array $data, array $options = [])
 * @method array<\App\Model\Entity\OrgMember> newEntities(array $data, array $options = [])
 * @method \App\Model\Entity\OrgMember get(mixed $primaryKey, array|string $finder = 'all', \Psr\SimpleCache\CacheInterface|string|null $cache = null, \Closure|string|null $cacheKey = null, mixed ...$args)
 * @method \App\Model\Entity\OrgMember findOrCreate($search, ?callable $callback = null, array $options = [])
 * @method \App\Model\Entity\OrgMember patchEntity(\Cake\Datasource\EntityInterface $entity, array $data, array $options = [])
 * @method array<\App\Model\Entity\OrgMember> patchEntities(iterable $entities, array $data, array $options = [])
 * @method \App\Model\Entity\OrgMember|false save(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method \App\Model\Entity\OrgMember saveOrFail(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method iterable<\App\Model\Entity\OrgMember>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\OrgMember>|false saveMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\OrgMember>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\OrgMember> saveManyOrFail(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\OrgMember>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\OrgMember>|false deleteMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\OrgMember>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\OrgMember> deleteManyOrFail(iterable $entities, array $options = [])
 * @mixin \Cake\ORM\Behavior\TimestampBehavior
 * @mixin \Muffin\Trash\Model\Behavior\TrashBehavior
 */
class OrgMembersTable extends Table
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

        $this->setTable('org_members');
        $this->setDisplayField('id');
        $this->setPrimaryKey('id');

        $this->addBehavior('Timestamp');
        $this->addBehavior('Muffin/Trash.Trash');

        $this->belongsTo('Organizations', [
            'foreignKey' => 'org_id',
            'joinType' => 'INNER',
        ]);
        $this->belongsTo('Users', [
            'foreignKey' => 'user_id',
            'joinType' => 'INNER',
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
            ->uuid('org_id')
            ->notEmptyString('org_id');

        $validator
            ->uuid('user_id')
            ->notEmptyString('user_id');

        $validator
            ->dateTime('deleted')
            ->allowEmptyDateTime('deleted');

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
        $rules->add(
            $rules->isUnique(['org_id', 'user_id']),
            ['errorField' => 'org_id', 'message' => __('This combination of org_id and user_id already exists')],
        );
        $rules->add($rules->existsIn(['org_id'], 'Organizations'), ['errorField' => 'org_id']);
        $rules->add($rules->existsIn(['user_id'], 'Users'), ['errorField' => 'user_id']);

        return $rules;
    }
}
