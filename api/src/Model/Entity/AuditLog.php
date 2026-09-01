<?php
declare(strict_types=1);

namespace App\Model\Entity;

use Cake\ORM\Entity;

/**
 * AuditLog Entity
 *
 * @property string $id
 * @property string $actor_id
 * @property string|null $org_id
 * @property string $resource_type
 * @property string $resource_id
 * @property string $action
 * @property string $changes
 * @property \Cake\I18n\DateTime $created
 *
 * @property \App\Model\Entity\User $actor
 * @property \App\Model\Entity\Organization|null $organization
 */
class AuditLog extends Entity
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
        'actor_id' => true,
        'org_id' => true,
        'resource_type' => true,
        'resource_id' => true,
        'action' => true,
        'changes' => true,
        'created' => true,
        'actor' => true,
        'organization' => true,
    ];
}
