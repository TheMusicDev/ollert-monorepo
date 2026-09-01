import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import type { PaginationMeta } from '@/lib/api-client'
import { listAdminUsers } from '@/lib/admin-api'
import type { AdminUser } from '@/lib/admin-api'

import { PaginationControls } from '@/components/orgs/PaginationControls'

import { AdminUsersTable } from './AdminUsersTable'
import { EditUserQuotasDialog } from './EditUserQuotasDialog'

const PAGE_SIZE = 20

type LoadStatus = 'loading' | 'ready' | 'forbidden' | 'error'

/**
 * `/admin` — platform-admin user list, quota overrides + promote/demote.
 * No dedicated "am I admin" check up front: this just calls the gated
 * endpoint and renders an inline "not authorized" state on 403, per the
 * admin+audit-logs plan (avoids an extra round-trip just to decide nav
 * visibility).
 */
export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)

  const latestRequestId = useRef(0)

  const load = useCallback(async (targetPage: number) => {
    const requestId = ++latestRequestId.current
    setStatus('loading')
    try {
      const response = await listAdminUsers(targetPage, PAGE_SIZE)
      if (requestId !== latestRequestId.current) return
      setUsers(response.data)
      setMeta(response.meta)
      setPage(targetPage)
      setStatus('ready')
    } catch (err) {
      if (requestId !== latestRequestId.current) return
      if (err instanceof ApiError && err.status === 403) {
        setStatus('forbidden')
        return
      }
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong loading users.',
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const handleSaved = (user: AdminUser) => {
    setUsers((current) => current.map((u) => (u.id === user.id ? user : u)))
    setEditTarget(null)
  }

  if (status === 'loading' && users.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading users…
      </p>
    )
  }

  if (status === 'forbidden') {
    return (
      <div
        role="alert"
        className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        You are not authorized to view this page.
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
      >
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void load(page)}
          className="mt-2 font-medium underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Users
      </h1>

      <AdminUsersTable users={users} onEdit={setEditTarget} />
      {meta && meta.totalPages > 1 && (
        <PaginationControls
          page={page}
          totalPages={meta.totalPages}
          onChange={(nextPage) => void load(nextPage)}
        />
      )}

      <EditUserQuotasDialog
        user={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}
