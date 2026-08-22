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
   * Server-computed: `true` when `owner_id` is the requesting user's local
   * `users.id`. Always present per
   * [api-contract.md#organizations](../../../planning/api-contract.md) —
   * `OrganizationsController::serializeOrg()` sets it on every returned org.
   */
  is_owner: boolean
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
