import { apiClient } from './api-client'
import type { PaginatedResponse } from './api-client'

/**
 * Org resource as returned by `GET /api/orgs/:id`. `owner_id` per
 * planning/data-model.md#organizations.
 *
 * `is_owner` is NOT documented in planning/api-contract.md — the org
 * resource shape there only lists DB columns, and the frontend has no way
 * to compare `owner_id` (a local CakePHP `users.id`) against the session it
 * holds, which only carries the Supabase auth uid (`users.supabase_uid`).
 * There's no "current user" endpoint or JWT-embedded local id to bridge the
 * two. This assumes the backend adds a server-computed `is_owner` flag to
 * the org resource (the same check it already runs to 403 a non-owner's
 * `POST /boards`). Flagged as an open item for whoever builds
 * `GET /api/orgs/:id` — if the field is absent, the UI below fails safe by
 * treating the current user as a non-owner (create-board control disabled).
 */
export interface Organization {
  id: string
  owner_id: string
  name: string
  is_owner?: boolean
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
