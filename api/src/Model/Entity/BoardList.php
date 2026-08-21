<?php
declare(strict_types=1);

namespace App\Model\Entity;

use Cake\ORM\Entity;

/**
 * BoardList Entity
 *
 * Named `BoardList` (not `List`) because `list` is a reserved word in PHP and
 * cannot be used as a class name, even though the underlying table is `lists`.
 *
 * @property string $id
 * @property string $board_id
 * @property string $title
 * @property float $position
 * @property \Cake\I18n\DateTime $created
 * @property \Cake\I18n\DateTime $modified
 * @property \Cake\I18n\DateTime|null $deleted
 *
 * @property \App\Model\Entity\Board $board
 * @property \App\Model\Entity\Card[] $cards
 */
class BoardList extends Entity
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
        'board_id' => true,
        'title' => true,
        'position' => true,
        'created' => true,
        'modified' => true,
        'deleted' => true,
        'board' => true,
        'cards' => true,
    ];
}
