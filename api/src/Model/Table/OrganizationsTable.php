<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\RulesChecker;
use Cake\ORM\Table;
use Cake\Validation\Validator;

/**
 * Organizations Model
 *
 * @property \App\Model\Table\UsersTable&\Cake\ORM\Association\BelongsTo $Users
 * @property \App\Model\Table\OrgMembersTable&\Cake\ORM\Association\HasMany $OrgMembers
 * @property \App\Model\Table\BoardsTable&\Cake\ORM\Association\HasMany $Boards
 * @method \App\Model\Entity\Organization newEmptyEntity()
 * @method \App\Model\Entity\Organization newEntity(array $data, array $options = [])
 * @method array<\App\Model\Entity\Organization> newEntities(array $data, array $options = [])
 * @method \App\Model\Entity\Organization get(mixed $primaryKey, array|string $finder = 'all', \Psr\SimpleCache\CacheInterface|string|null $cache = null, \Closure|string|null $cacheKey = null, mixed ...$args)
 * @method \App\Model\Entity\Organization findOrCreate($search, ?callable $callback = null, array $options = [])
 * @method \App\Model\Entity\Organization patchEntity(\Cake\Datasource\EntityInterface $entity, array $data, array $options = [])
 * @method array<\App\Model\Entity\Organization> patchEntities(iterable $entities, array $data, array $options = [])
 * @method \App\Model\Entity\Organization|false save(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method \App\Model\Entity\Organization saveOrFail(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method iterable<\App\Model\Entity\Organization>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Organization>|false saveMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Organization>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Organization> saveManyOrFail(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Organization>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Organization>|false deleteMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Organization>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Organization> deleteManyOrFail(iterable $entities, array $options = [])
 * @mixin \Cake\ORM\Behavior\TimestampBehavior
 * @mixin \Muffin\Trash\Model\Behavior\TrashBehavior
 */
class OrganizationsTable extends Table
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

        $this->setTable('organizations');
        $this->setDisplayField('name');
        $this->setPrimaryKey('id');

        $this->addBehavior('Timestamp');
        $this->addBehavior('Muffin/Trash.Trash');

        $this->belongsTo('Users', [
            'foreignKey' => 'owner_id',
            'joinType' => 'INNER',
        ]);
        $this->hasMany('OrgMembers', [
            'foreignKey' => 'org_id',
        ]);
        $this->hasMany('Boards', [
            'foreignKey' => 'org_id',
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
            ->uuid('owner_id')
            ->notEmptyString('owner_id');

        $validator
            ->scalar('name')
            ->maxLength('name', 255)
            ->requirePresence('name', 'create')
            ->notEmptyString('name');

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
        $rules->add($rules->existsIn(['owner_id'], 'Users'), ['errorField' => 'owner_id']);

        return $rules;
    }
}
