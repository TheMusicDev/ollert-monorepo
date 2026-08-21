<?php
declare(strict_types=1);

namespace App\Model\Entity;

use Cake\ORM\Entity;

/**
 * User Entity
 *
 * @property string $id
 * @property string $supabase_uid
 * @property string $email
 * @property string|null $display_name
 * @property int $max_orgs
 * @property int $max_boards_per_org
 * @property int $max_lists_per_board
 * @property int $max_cards_per_board
 * @property \Cake\I18n\DateTime $created
 * @property \Cake\I18n\DateTime $modified
 * @property \Cake\I18n\DateTime|null $deleted
 *
 * @property \App\Model\Entity\Organization[] $organizations
 * @property \App\Model\Entity\OrgMember[] $org_members
 */
class User extends Entity
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
        'supabase_uid' => true,
        'email' => true,
        'display_name' => true,
        'max_orgs' => true,
        'max_boards_per_org' => true,
        'max_lists_per_board' => true,
        'max_cards_per_board' => true,
        'created' => true,
        'modified' => true,
        'deleted' => true,
        'organizations' => true,
        'org_members' => true,
    ];
}
