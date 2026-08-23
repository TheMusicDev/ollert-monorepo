import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import type { PaginationMeta } from '@/lib/api-client'
import { listOrgs } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'
import { useOrgsInvalidation } from '@/lib/orgs-context'

import { CreateOrgDialog } from './CreateOrgDialog'
import { DeleteOrgDialog } from './DeleteOrgDialog'
import { EmptyOrgsState } from './EmptyOrgsState'
import { OrgTable } from './OrgTable'
import { PaginationControls } from './PaginationControls'
import { RenameOrgDialog } from './RenameOrgDialog'

const PAGE_SIZE = 20

type LoadStatus = 'loading' | 'ready' | 'error'

/** `/orgs` — paginated org list, create/rename/delete, empty state. */
export function OrgsPage() {
  const [page, setPage] = useState(1)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Organization | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null)

  const { invalidateOrgs } = useOrgsInvalidation()

  // Tracks the most recently issued request so an older, slower response
  // can't overwrite state committed by a newer one when requests overlap.
  const latestRequestId = useRef(0)

  const load = useCallback(async (targetPage: number) => {
    const requestId = ++latestRequestId.current
    setStatus('loading')
    try {
      const response = await listOrgs(targetPage, PAGE_SIZE)
      if (requestId !== latestRequestId.current) return
      setOrgs(response.data)
      setMeta(response.meta)
      setPage(targetPage)
      setStatus('ready')
    } catch (err) {
      if (requestId !== latestRequestId.current) return
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong loading your organizations.',
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const handleCreated = (_org: Organization) => {
    setIsCreateOpen(false)
    // New orgs are most likely to want to be seen immediately — reload the
    // first page rather than the (possibly stale) current page.
    void load(1)
    invalidateOrgs()
  }

  const handleRenamed = (org: Organization) => {
    // Invalidate any in-flight load — otherwise a slower, already-issued
    // request (e.g. from pagination or a retry) can resolve after this
    // optimistic update and overwrite the just-renamed row with stale data.
    latestRequestId.current += 1
    setOrgs((current) => current.map((o) => (o.id === org.id ? org : o)))
    setRenameTarget(null)
    invalidateOrgs()
  }

  const handleDeleted = (_org: Organization) => {
    setDeleteTarget(null)
    const isLastOnPage = orgs.length === 1
    void load(isLastOnPage && page > 1 ? page - 1 : page)
    invalidateOrgs()
  }

  if (status === 'loading' && orgs.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading organizations…
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

  const showEmptyState = orgs.length === 0 && (meta?.total ?? 0) === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Organizations
        </h1>
        {!showEmptyState && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            New organization
          </button>
        )}
      </div>

      {showEmptyState ? (
        <EmptyOrgsState onCreate={() => setIsCreateOpen(true)} />
      ) : (
        <>
          <OrgTable
            orgs={orgs}
            onRename={setRenameTarget}
            onDelete={setDeleteTarget}
          />
          {meta && meta.totalPages > 1 && (
            <PaginationControls
              page={page}
              totalPages={meta.totalPages}
              onChange={(nextPage) => void load(nextPage)}
            />
          )}
        </>
      )}

      <CreateOrgDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={handleCreated}
      />
      <RenameOrgDialog
        org={renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        onRenamed={handleRenamed}
      />
      <DeleteOrgDialog
        org={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
