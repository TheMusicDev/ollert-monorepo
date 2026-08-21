<?php
declare(strict_types=1);

namespace App\Service;

use Cake\ORM\Locator\LocatorAwareTrait;

/**
 * Org-membership authorization helper. Every Section 2 controller needs this
 * for its 403 checks (planning/api-contract.md#conventions): "403 for a valid
 * user acting on a board/org they're not a member of, or a non-owner
 * attempting an owner-only action" (e.g. board creation, org delete, member
 * removal of someone other than yourself).
 *
 * Membership convention — resolves the open question in
 * planning/data-model.md ("Owner is implicitly a member too (or: owner row
 * also present here for uniform membership checks — pick one convention
 * during implementation)") and planning/log.md's "org-ownership check" item:
 * the org *owner* is always treated as a member, via `organizations.owner_id`,
 * regardless of whether `org_members` also carries an explicit row for them.
 * `feat/api-organizations` (Section 2) may or may not insert an owner row
 * into `org_members` on org creation — either way, `isOrgMember()` returns
 * true for the owner, so this helper's behavior doesn't depend on that
 * implementation detail.
 *
 * Both checks scope to non-trashed rows only (Muffin/Trash's default finder,
 * applied automatically to `OrganizationsTable`/`OrgMembersTable`), so a
 * soft-deleted org or membership never grants access.
 */
class OrgAuthorizationService
{
    use LocatorAwareTrait;

    /**
     * Whether $userId is a member of $orgId — either an explicit `org_members`
     * row, or the org's owner (see class docblock).
     *
     * @param string $userId Local `users.id` (UUID).
     * @param string $orgId `organizations.id` (UUID).
     * @return bool
     */
    public function isOrgMember(string $userId, string $orgId): bool
    {
        if ($this->isOrgOwner($userId, $orgId)) {
            return true;
        }

        return $this->fetchTable('OrgMembers')
            ->exists(['org_id' => $orgId, 'user_id' => $userId]);
    }

    /**
     * Whether $userId owns $orgId. Also the basis for the server-computed
     * `is_owner` field documented on the org resource
     * (planning/api-contract.md#endpoints) — `feat/api-organizations` should
     * call this per-row when serializing `index`/`view` results.
     *
     * @param string $userId Local `users.id` (UUID).
     * @param string $orgId `organizations.id` (UUID).
     * @return bool
     */
    public function isOrgOwner(string $userId, string $orgId): bool
    {
        return $this->fetchTable('Organizations')
            ->exists(['id' => $orgId, 'owner_id' => $userId]);
    }
}
