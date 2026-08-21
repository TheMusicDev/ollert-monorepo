import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/lib/api-client'

/**
 * Org detail, scoped to what the members page needs (name for the heading,
 * `ownerId` to gate member removal). See
 * planning/api-contract.md#organizations.
 */
export interface OrgSummary {
  id: string
  ownerId: string
  name: string
}

/**
 * A row from `GET /api/orgs/:id/members`. Field names assume the API's JSON
 * responses use camelCase throughout — the documented pagination `meta`
 * envelope uses `totalPages`, not `total_pages` (see
 * planning/api-contract.md#pagination) — even though the underlying MySQL
 * columns are snake_case (see planning/data-model.md#org_members).
 */
export interface OrgMember {
  id: string
  userId: string
  email: string
  displayName: string | null
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
 * Finds the current signed-in user's own row within a (possibly paginated)
 * page of members, matched by email. There's no `/users/me` endpoint mapping
 * the Supabase session to the API's local `users.id`, so email — known
 * client-side from the Supabase session — is the only stable link available.
 *
 * Caveat: if the current user isn't present on the currently loaded page,
 * this returns `undefined` rather than fetching every page to find them —
 * see `isOrgOwner`.
 */
export function findCurrentMember(
  members: OrgMember[],
  email: string | null | undefined,
): OrgMember | undefined {
  if (!email) return undefined
  const needle = email.toLowerCase()
  return members.find((member) => member.email.toLowerCase() === needle)
}

/**
 * True when the current user's own membership row — if found on the loaded
 * page, see `findCurrentMember` — belongs to the org's owner. Data model
 * notes the owner-as-explicit-member convention is still an open backend
 * decision (planning/data-model.md#org_members); this only ever grants
 * owner-only UI (like removing *other* members) once we've positively
 * matched the current user's row against `org.ownerId`, so it fails closed
 * (under-grants rather than over-grants) if that row isn't loaded yet.
 */
export function isOrgOwner(
  org: OrgSummary | null,
  currentMember: OrgMember | undefined,
): boolean {
  return !!org && !!currentMember && currentMember.userId === org.ownerId
}

/**
 * Owner-only, or self-removal. See planning/api-contract.md#org-members.
 */
export function canRemoveMember(
  member: OrgMember,
  currentUserEmail: string | null | undefined,
  isOwner: boolean,
): boolean {
  if (isOwner) return true
  if (!currentUserEmail) return false
  return member.email.toLowerCase() === currentUserEmail.toLowerCase()
}
