import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/lib/api-client'

/** One field's before/after value in an audit log entry's `changes` map. */
export interface AuditLogFieldDiff {
  from: unknown
  to: unknown
}

/**
 * Audit log row. See planning/api-contract.md#audit-log — shared shape
 * across both the admin-wide and org-scoped read endpoints.
 */
export interface AuditLogEntry {
  id: string
  actor: { id: string; email: string; display_name: string | null } | null
  org_id: string | null
  resource_type: string
  resource_id: string
  action: 'create' | 'update' | 'delete'
  changes: Record<string, AuditLogFieldDiff>
  created: string
}

/** `GET /api/admin/audit-logs` — platform admins only, every org. */
export function listAuditLogs(page: number, limit: number) {
  return apiClient.get<PaginatedResponse<AuditLogEntry>>(
    `/admin/audit-logs?page=${page}&limit=${limit}`,
  )
}

/** `GET /api/orgs/:id/audit-logs` — that org's owner only. */
export function listOrgAuditLog(orgId: string, page: number, limit: number) {
  return apiClient.get<PaginatedResponse<AuditLogEntry>>(
    `/orgs/${orgId}/audit-logs?page=${page}&limit=${limit}`,
  )
}
