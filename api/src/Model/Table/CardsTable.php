<?php
declare(strict_types=1);

namespace App\Model\Table;

use Cake\ORM\RulesChecker;
use Cake\ORM\Table;
use Cake\Validation\Validator;

/**
 * Cards Model
 *
 * @property \App\Model\Table\ListsTable&\Cake\ORM\Association\BelongsTo $Lists
 * @method \App\Model\Entity\Card newEmptyEntity()
 * @method \App\Model\Entity\Card newEntity(array $data, array $options = [])
 * @method array<\App\Model\Entity\Card> newEntities(array $data, array $options = [])
 * @method \App\Model\Entity\Card get(mixed $primaryKey, array|string $finder = 'all', \Psr\SimpleCache\CacheInterface|string|null $cache = null, \Closure|string|null $cacheKey = null, mixed ...$args)
 * @method \App\Model\Entity\Card findOrCreate($search, ?callable $callback = null, array $options = [])
 * @method \App\Model\Entity\Card patchEntity(\Cake\Datasource\EntityInterface $entity, array $data, array $options = [])
 * @method array<\App\Model\Entity\Card> patchEntities(iterable $entities, array $data, array $options = [])
 * @method \App\Model\Entity\Card|false save(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method \App\Model\Entity\Card saveOrFail(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method iterable<\App\Model\Entity\Card>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Card>|false saveMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Card>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Card> saveManyOrFail(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Card>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Card>|false deleteMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\Card>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\Card> deleteManyOrFail(iterable $entities, array $options = [])
 * @mixin \Cake\ORM\Behavior\TimestampBehavior
 * @mixin \Muffin\Trash\Model\Behavior\TrashBehavior
 */
class CardsTable extends Table
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

        $this->setTable('cards');
        $this->setDisplayField('title');
        $this->setPrimaryKey('id');

        $this->addBehavior('Timestamp');
        $this->addBehavior('Muffin/Trash.Trash');

        $this->belongsTo('Lists', [
            'foreignKey' => 'list_id',
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
            ->uuid('list_id')
            ->notEmptyString('list_id');

        $validator
            ->scalar('title')
            ->maxLength('title', 255)
            ->requirePresence('title', 'create')
            ->notEmptyString('title');

        $validator
            ->scalar('description')
            ->allowEmptyString('description');

        $validator
            ->date('due_date')
            ->allowEmptyDate('due_date');

        $validator
            ->numeric('position')
            ->requirePresence('position', 'create')
            ->notEmptyString('position');

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
        $rules->add($rules->existsIn(['list_id'], 'Lists'), ['errorField' => 'list_id']);

        return $rules;
    }
}
