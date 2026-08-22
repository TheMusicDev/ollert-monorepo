import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/lib/api-client'

/**
 * Org detail, scoped to what the members page needs (name for the heading,
 * `is_owner` to gate member removal). Confirmed against
 * `OrganizationsController::serializeOrg()`/`view()`: the org resource is
 * `$org->toArray()` (raw entity — snake_case, matching the underlying
 * `organizations` table, see planning/data-model.md#organizations) plus the
 * server-computed `is_owner` boolean (planning/api-contract.md#organizations).
 * Only the pagination `meta` envelope uses camelCase (`totalPages`, see
 * planning/api-contract.md#pagination) — resource bodies don't.
 */
export interface OrgSummary {
  id: string
  name: string
  is_owner: boolean
}

/**
 * A row from `GET /api/orgs/:id/members`. Confirmed against
 * `OrgMembersController`: `$member->toArray()` on the `OrgMember` entity —
 * snake_case (`org_id`, `user_id`, matching planning/data-model.md#org_members)
 * — with the target user's data nested under `user` per
 * `OrgMembersTable`'s `belongsTo('Users')` association, not flattened onto
 * the member row.
 */
export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  user: {
    id: string
    email: string
    display_name: string | null
  }
  created: string
}

export function fetchOrg(orgId: string): Promise<OrgSummary> {
  return apiClient.get<OrgSummary>(`/orgs/${orgId}`)
}

export function fetchOrgMembers(
  orgId: string,
  page: number,
  limit = 20,
): Promise<PaginatedResponse<OrgMember>> {
  return apiClient.get<PaginatedResponse<OrgMember>>(
    `/orgs/${orgId}/members?page=${page}&limit=${limit}`,
  )
}

export function addOrgMemberByEmail(
  orgId: string,
  email: string,
): Promise<OrgMember> {
  return apiClient.post<OrgMember>(`/orgs/${orgId}/members`, { email })
}

export function removeOrgMember(orgId: string, userId: string): Promise<void> {
  return apiClient.delete<void>(`/orgs/${orgId}/members/${userId}`)
}

/**
 * Owner-only, or self-removal. See planning/api-contract.md#org-members.
 * `isOwner` comes straight from the org resource's server-computed
 * `is_owner` field (`OrgSummary.is_owner`) — no client-side derivation
 * needed, unlike the member-list email-matching this used to do before
 * `feat/api-organizations` shipped that field for real.
 */
export function canRemoveMember(
  member: OrgMember,
  currentUserEmail: string | null | undefined,
  isOwner: boolean,
): boolean {
  if (isOwner) return true
  if (!currentUserEmail) return false
  return member.user.email.toLowerCase() === currentUserEmail.toLowerCase()
}
