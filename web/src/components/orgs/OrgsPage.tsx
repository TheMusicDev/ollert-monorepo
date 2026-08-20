import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/lib/api-client'
import type { PaginationMeta } from '@/lib/api-client'
import { listOrgs } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

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

  const load = useCallback(async (targetPage: number) => {
    setStatus('loading')
    try {
      const response = await listOrgs(targetPage, PAGE_SIZE)
      setOrgs(response.data)
      setMeta(response.meta)
      setPage(targetPage)
      setStatus('ready')
    } catch (err) {
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
  }

  const handleRenamed = (org: Organization) => {
    setOrgs((current) => current.map((o) => (o.id === org.id ? org : o)))
    setRenameTarget(null)
  }

  const handleDeleted = (_org: Organization) => {
    setDeleteTarget(null)
    const isLastOnPage = orgs.length === 1
    void load(isLastOnPage && page > 1 ? page - 1 : page)
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
