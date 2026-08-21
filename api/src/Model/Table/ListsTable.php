<?php
declare(strict_types=1);

namespace App\Model\Table;

use App\Model\Entity\BoardList;
use Cake\ORM\RulesChecker;
use Cake\ORM\Table;
use Cake\Validation\Validator;

/**
 * Lists Model
 *
 * @property \App\Model\Table\BoardsTable&\Cake\ORM\Association\BelongsTo $Boards
 * @property \App\Model\Table\CardsTable&\Cake\ORM\Association\HasMany $Cards
 * @method \App\Model\Entity\BoardList newEmptyEntity()
 * @method \App\Model\Entity\BoardList newEntity(array $data, array $options = [])
 * @method array<\App\Model\Entity\BoardList> newEntities(array $data, array $options = [])
 * @method \App\Model\Entity\BoardList get(mixed $primaryKey, array|string $finder = 'all', \Psr\SimpleCache\CacheInterface|string|null $cache = null, \Closure|string|null $cacheKey = null, mixed ...$args)
 * @method \App\Model\Entity\BoardList findOrCreate($search, ?callable $callback = null, array $options = [])
 * @method \App\Model\Entity\BoardList patchEntity(\Cake\Datasource\EntityInterface $entity, array $data, array $options = [])
 * @method array<\App\Model\Entity\BoardList> patchEntities(iterable $entities, array $data, array $options = [])
 * @method \App\Model\Entity\BoardList|false save(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method \App\Model\Entity\BoardList saveOrFail(\Cake\Datasource\EntityInterface $entity, array $options = [])
 * @method iterable<\App\Model\Entity\BoardList>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\BoardList>|false saveMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\BoardList>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\BoardList> saveManyOrFail(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\BoardList>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\BoardList>|false deleteMany(iterable $entities, array $options = [])
 * @method iterable<\App\Model\Entity\BoardList>|\Cake\Datasource\ResultSetInterface<\App\Model\Entity\BoardList> deleteManyOrFail(iterable $entities, array $options = [])
 * @mixin \Cake\ORM\Behavior\TimestampBehavior
 * @mixin \Muffin\Trash\Model\Behavior\TrashBehavior
 */
class ListsTable extends Table
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

        $this->setTable('lists');
        $this->setDisplayField('title');
        $this->setPrimaryKey('id');
        // `list` is a reserved word in PHP and can't be a class name, so the
        // entity for this table is `BoardList` instead of the conventional `List`.
        $this->setEntityClass(BoardList::class);

        $this->addBehavior('Timestamp');
        $this->addBehavior('Muffin/Trash.Trash');

        $this->belongsTo('Boards', [
            'foreignKey' => 'board_id',
            'joinType' => 'INNER',
        ]);
        $this->hasMany('Cards', [
            'foreignKey' => 'list_id',
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
            ->uuid('board_id')
            ->notEmptyString('board_id');

        $validator
            ->scalar('title')
            ->maxLength('title', 255)
            ->requirePresence('title', 'create')
            ->notEmptyString('title');

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
        $rules->add($rules->existsIn(['board_id'], 'Boards'), ['errorField' => 'board_id']);

        return $rules;
    }
}
