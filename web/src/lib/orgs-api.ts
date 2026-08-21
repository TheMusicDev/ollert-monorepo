import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/lib/api-client'

/**
 * Organization resource. Fields beyond `id`/`name` follow
 * planning/data-model.md#schema (`organizations` table) and
 * planning/api-contract.md#organizations.
 */
export interface Organization {
  id: string
  name: string
  /** Local `users.id` of the creator — see planning/data-model.md#schema. */
  owner_id: string
  /**
   * Not documented anywhere in the OKF bundle: `owner_id` references the
   * *local* `users.id` (see planning/data-model.md#users), which the
   * frontend has no endpoint to resolve for the signed-in user (no `/me`
   * route, and the Supabase session only exposes `supabase_uid`). Without
   * it, the client can't tell "is this org mine" to gate the owner-only
   * delete action ([api-contract.md#organizations](../../../planning/api-contract.md)).
   * Treated here as an optional, best-effort convenience flag: when the API
   * includes it, the delete action is hidden for non-owners; when absent
   * (`undefined`), the delete action stays visible and a 403 is surfaced
   * inline instead of failing closed. Flag for confirmation once
   * `feat/api-organizations` lands — either add `is_owner` to the org
   * payload or expose the current user's local id some other way.
   */
  is_owner?: boolean
  created: string
  modified: string
}

const BASE_PATH = '/orgs'

export function listOrgs(page: number, limit: number) {
  return apiClient.get<PaginatedResponse<Organization>>(
    `${BASE_PATH}?page=${page}&limit=${limit}`,
  )
}

export function createOrg(name: string) {
  return apiClient.post<Organization>(BASE_PATH, { name })
}

export function renameOrg(id: string, name: string) {
  return apiClient.patch<Organization>(`${BASE_PATH}/${id}`, { name })
}

export function deleteOrg(id: string) {
  return apiClient.delete<void>(`${BASE_PATH}/${id}`)
}
