import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import type { PaginatedResponse, PaginationMeta } from '@/lib/api-client'
import type { AuditLogEntry } from '@/lib/audit-log-api'

import { PaginationControls } from '@/components/orgs/PaginationControls'

const PAGE_SIZE = 20

type LoadStatus = 'loading' | 'ready' | 'error'

function formatChanges(entry: AuditLogEntry): string {
  const fields = Object.keys(entry.changes)
  if (fields.length === 0) return '—'

  return fields
    .map((field) => {
      const { from, to } = entry.changes[field]
      if (entry.action === 'create') return field
      if (entry.action === 'delete') return field
      return `${field}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`
    })
    .join(', ')
}

const actionBadgeClassName: Record<AuditLogEntry['action'], string> = {
  create:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  delete: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

interface AuditLogTableProps {
  /** Fetches one page of audit log rows — admin-wide or org-scoped. */
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<AuditLogEntry>>
}

/**
 * Self-contained audit log section (load state + pagination + table),
 * reused by both the admin-wide `/admin/audit-logs` page and the org-owner
 * `/orgs/:orgId/audit-log` page — only `fetchPage` differs between them.
 * See planning/api-contract.md#audit-log.
 */
export function AuditLogTable({ fetchPage }: AuditLogTableProps) {
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')

  const latestRequestId = useRef(0)

  const load = useCallback(
    async (targetPage: number) => {
      const requestId = ++latestRequestId.current
      setStatus('loading')
      try {
        const response = await fetchPage(targetPage, PAGE_SIZE)
        if (requestId !== latestRequestId.current) return
        setEntries(response.data)
        setMeta(response.meta)
        setPage(targetPage)
        setStatus('ready')
      } catch (err) {
        if (requestId !== latestRequestId.current) return
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong loading the audit log.',
        )
        setStatus('error')
      }
    },
    [fetchPage],
  )

  useEffect(() => {
    void load(1)
  }, [load])

  if (status === 'loading' && entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading audit log…
      </p>
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

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-bottom dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Time
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Actor
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Resource
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Action
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Changes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {new Date(entry.created).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {entry.actor?.email ?? 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {entry.resource_type}
                  <span className="ml-1 font-mono text-xs">
                    {entry.resource_id.slice(0, 8)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actionBadgeClassName[entry.action]}`}
                  >
                    {entry.action}
                  </span>
                </td>
                <td className="max-w-md px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {formatChanges(entry)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <PaginationControls
          page={page}
          totalPages={meta.totalPages}
          onChange={(nextPage) => void load(nextPage)}
        />
      )}
    </div>
  )
}
