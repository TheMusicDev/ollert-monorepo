<?php
declare(strict_types=1);

namespace App\Model\Entity;

use Cake\ORM\Entity;

/**
 * Organization Entity
 *
 * @property string $id
 * @property string $owner_id
 * @property string $name
 * @property \Cake\I18n\DateTime $created
 * @property \Cake\I18n\DateTime $modified
 * @property \Cake\I18n\DateTime|null $deleted
 *
 * @property \App\Model\Entity\User $user Org owner (association name is Users; owner_id is the FK).
 * @property \App\Model\Entity\OrgMember[] $org_members
 * @property \App\Model\Entity\Board[] $boards
 */
class Organization extends Entity
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
        'owner_id' => true,
        'name' => true,
        'created' => true,
        'modified' => true,
        'deleted' => true,
        'user' => true,
        'org_members' => true,
        'boards' => true,
    ];
}
