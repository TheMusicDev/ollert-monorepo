import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'

import { ApiError } from '@/lib/api-client'
import type { PaginationMeta } from '@/lib/api-client'
import { createBoard, getOrg, listBoards, renameBoard } from '@/lib/boards-api'
import type { Board, Organization } from '@/lib/boards-api'

import { BoardCard } from './BoardCard'
import { BoardFormDialog } from './BoardFormDialog'
import { DeleteBoardDialog } from './DeleteBoardDialog'
import { Pagination } from './Pagination'

const PAGE_SIZE = 12

type OrgState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; org: Organization }

type BoardsState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; boards: Board[]; meta: PaginationMeta }

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/** `/orgs/:orgId` — board list for the org, create/rename/delete, and the
 * members entry point. See planning/api-contract.md#boards. */
export function OrgBoardsPage({ orgId }: { orgId: string }) {
  const [orgState, setOrgState] = useState<OrgState>({ status: 'loading' })
  const [boardsState, setBoardsState] = useState<BoardsState>({
    status: 'loading',
  })
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Board | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null)

  // Reset pagination when the org changes so a page retained from a
  // previous org doesn't get requested against the new one. Adjusting
  // state during render (rather than in an effect keyed on orgId) means
  // the reset lands before loadBoards' effect fires, so we never issue a
  // wasted fetch for the old page against the new org.
  const [prevOrgId, setPrevOrgId] = useState(orgId)
  if (orgId !== prevOrgId) {
    setPrevOrgId(orgId)
    setPage(1)
  }

  // Request generation counters guard against out-of-order responses: if a
  // newer request (from an orgId/page change or a manual retry) is issued
  // before an older one resolves, the older response is discarded instead
  // of overwriting fresher state.
  const orgRequestRef = useRef(0)
  const boardsRequestRef = useRef(0)

  const loadOrg = useCallback(() => {
    const requestId = ++orgRequestRef.current
    setOrgState({ status: 'loading' })
    getOrg(orgId)
      .then((org) => {
        if (orgRequestRef.current === requestId) {
          setOrgState({ status: 'ready', org })
        }
      })
      .catch((error: unknown) => {
        if (orgRequestRef.current === requestId) {
          setOrgState({
            status: 'error',
            error: errorMessage(error, 'Failed to load organization.'),
          })
        }
      })
  }, [orgId])

  const loadBoards = useCallback(() => {
    const requestId = ++boardsRequestRef.current
    setBoardsState({ status: 'loading' })
    listBoards(orgId, page, PAGE_SIZE)
      .then((res) => {
        if (boardsRequestRef.current === requestId) {
          setBoardsState({ status: 'ready', boards: res.data, meta: res.meta })
        }
      })
      .catch((error: unknown) => {
        if (boardsRequestRef.current === requestId) {
          setBoardsState({
            status: 'error',
            error: errorMessage(error, 'Failed to load boards.'),
          })
        }
      })
  }, [orgId, page])

  useEffect(loadOrg, [loadOrg])
  useEffect(loadBoards, [loadBoards, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  // Fails safe: an org still loading, errored, or missing `is_owner`
  // (undocumented field — see planning notes in src/lib/boards-api.ts)
  // is treated as non-owner, so the create control stays disabled.
  const isOwner = orgState.status === 'ready' && orgState.org.is_owner === true

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {orgState.status === 'ready' ? orgState.org.name : 'Organization'}
          </h1>
          <Link
            to="/orgs/$orgId/members"
            params={{ orgId }}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Manage members
          </Link>
        </div>
        <div className="text-right">
          <button
            type="button"
            disabled={!isOwner}
            onClick={() => setCreateOpen(true)}
            title={
              isOwner
                ? undefined
                : 'Only the organization owner can create boards.'
            }
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            New board
          </button>
          {orgState.status === 'ready' && !isOwner && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Only the organization owner can create boards.
            </p>
          )}
        </div>
      </div>

      {orgState.status === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
        >
          {orgState.error}{' '}
          <button
            type="button"
            onClick={loadOrg}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {boardsState.status === 'loading' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading boards…
        </p>
      )}

      {boardsState.status === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
        >
          {boardsState.error}{' '}
          <button
            type="button"
            onClick={reload}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {boardsState.status === 'ready' && boardsState.boards.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          No boards yet.
          {isOwner ? ' Create your first board to get started.' : ''}
        </div>
      )}

      {boardsState.status === 'ready' && boardsState.boards.length > 0 && (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boardsState.boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
          <Pagination meta={boardsState.meta} onPageChange={setPage} />
        </>
      )}

      <BoardFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New board"
        submitLabel="Create"
        onSubmit={async (title) => {
          await createBoard(orgId, title)
          reload()
        }}
      />

      {renameTarget && (
        <BoardFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setRenameTarget(null)
          }}
          title="Rename board"
          submitLabel="Save"
          initialTitle={renameTarget.title}
          onSubmit={async (title) => {
            await renameBoard(renameTarget.id, title)
            reload()
          }}
        />
      )}

      {deleteTarget && (
        <DeleteBoardDialog
          board={deleteTarget}
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          onDeleted={() => {
            setDeleteTarget(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
