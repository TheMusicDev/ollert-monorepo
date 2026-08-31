import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/lib/api-client'

/**
 * Admin-visible user row. See planning/api-contract.md#admin —
 * `GET /api/admin/users` returns exactly these fields, `is_admin` gated.
 */
export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  max_orgs: number
  max_boards_per_org: number
  max_lists_per_board: number
  max_cards_per_board: number
  is_admin: boolean
}

/** Partial patch body for `PATCH /api/admin/users/:id` — only sent fields update. */
export interface AdminUserPatch {
  max_orgs?: number
  max_boards_per_org?: number
  max_lists_per_board?: number
  max_cards_per_board?: number
  is_admin?: boolean
}

const BASE_PATH = '/admin/users'

export function listAdminUsers(page: number, limit: number) {
  return apiClient.get<PaginatedResponse<AdminUser>>(
    `${BASE_PATH}?page=${page}&limit=${limit}`,
  )
}

export function updateAdminUser(id: string, patch: AdminUserPatch) {
  return apiClient.patch<AdminUser>(`${BASE_PATH}/${id}`, patch)
}
