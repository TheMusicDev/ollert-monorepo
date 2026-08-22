import { apiClient } from './api-client'
import type { PaginatedResponse } from './api-client'

/**
 * Org resource as returned by `GET /api/orgs/:id`. `owner_id` per
 * planning/data-model.md#organizations; `is_owner` is server-computed and
 * always present — `OrganizationsController::serializeOrg()` sets it on
 * every returned org (planning/api-contract.md#organizations).
 */
export interface Organization {
  id: string
  owner_id: string
  name: string
  is_owner: boolean
}

/** Board resource per planning/data-model.md#boards. */
export interface Board {
  id: string
  org_id: string
  title: string
}

export function getOrg(orgId: string) {
  return apiClient.get<Organization>(`/orgs/${orgId}`)
}

export function listBoards(orgId: string, page: number, limit: number) {
  return apiClient.get<PaginatedResponse<Board>>(
    `/orgs/${orgId}/boards?page=${page}&limit=${limit}`,
  )
}

export function createBoard(orgId: string, title: string) {
  return apiClient.post<Board>(`/orgs/${orgId}/boards`, { title })
}

export function renameBoard(boardId: string, title: string) {
  return apiClient.patch<Board>(`/boards/${boardId}`, { title })
}

export function deleteBoard(boardId: string) {
  return apiClient.delete<void>(`/boards/${boardId}`)
}
