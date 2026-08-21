<?php
declare(strict_types=1);

namespace App\Model\Entity;

use Cake\ORM\Entity;

/**
 * Card Entity
 *
 * @property string $id
 * @property string $list_id
 * @property string $title
 * @property string|null $description
 * @property \Cake\I18n\Date|null $due_date
 * @property float $position
 * @property \Cake\I18n\DateTime $created
 * @property \Cake\I18n\DateTime $modified
 * @property \Cake\I18n\DateTime|null $deleted
 *
 * @property \App\Model\Entity\BoardList $list
 */
class Card extends Entity
{
    /**
     * Fields that can be mass assigned using newEntity() or patchEntity().
     *
     * Note that when '*' is set to true, this allows all unspecified fields to
     * be mass assigned. For security purposes, it is advised to set '*' to false
     * (or remove it), and explicitly make individual fields accessible as needed.
     *
     * @var array<string, bool>
     */
    protected array $_accessible = [
        'list_id' => true,
        'title' => true,
        'description' => true,
        'due_date' => true,
        'position' => true,
        'created' => true,
        'modified' => true,
        'deleted' => true,
        'list' => true,
    ];
}
