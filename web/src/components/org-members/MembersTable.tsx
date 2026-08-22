import { useState } from 'react'
import { AlertDialog } from '@base-ui-components/react/alert-dialog'

import type { PaginationMeta } from '@/lib/api-client'
import type { OrgMember } from '@/lib/org-members'
import { canRemoveMember } from '@/lib/org-members'

interface MembersTableProps {
  members: OrgMember[]
  meta: PaginationMeta | null
  loading: boolean
  error: string | null
  currentUserEmail: string | null | undefined
  isOwner: boolean
  page: number
  onPageChange: (page: number) => void
  /** Throw to surface an inline error in the confirmation dialog. */
  onRemove: (member: OrgMember) => Promise<void>
}

/**
 * Paginated org members table, per planning/design.md#layout-pattern
 * ("tables for list views, e.g. org members"). Owner-only-or-self removal:
 * see `canRemoveMember` in `@/lib/org-members`.
 */
export function MembersTable({
  members,
  meta,
  loading,
  error,
  currentUserEmail,
  isOwner,
  page,
  onPageChange,
  onRemove,
}: MembersTableProps) {
  const [pendingRemoval, setPendingRemoval] = useState<OrgMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const handleConfirmRemove = async () => {
    if (!pendingRemoval) return
    setRemoving(true)
    setRemoveError(null)
    try {
      await onRemove(pendingRemoval)
      setPendingRemoval(null)
    } catch (err) {
      setRemoveError(
        err instanceof Error ? err.message : 'Failed to remove member.',
      )
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Loading members…
      </p>
    )
  }

  if (error) {
    return (
      <p
        role="alert"
        className="py-8 text-center text-sm text-red-600 dark:text-red-400"
      >
        {error}
      </p>
    )
  }

  if (members.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No members yet. Add someone by email above.
      </p>
    )
  }

  return (
    <div>
      <div className="shadow-bottom overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
              >
                Name
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {members.map((member) => {
              const isSelf =
                !!currentUserEmail &&
                member.user.email.toLowerCase() ===
                  currentUserEmail.toLowerCase()
              const canRemove = canRemoveMember(
                member,
                currentUserEmail,
                isOwner,
              )
              return (
                <tr key={member.id}>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {member.user.email}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {member.user.display_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => setPendingRemoval(member)}
                        className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            {meta.total} member{meta.total === 1 ? '' : 's'} · page {meta.page}{' '}
            of {Math.max(meta.totalPages, 1)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-gray-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= meta.totalPages}
              className="rounded-md border border-gray-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AlertDialog.Root
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoval(null)
            setRemoveError(null)
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 bg-black/50" />
          <AlertDialog.Popup className="shadow-bottom fixed top-1/2 left-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 dark:bg-gray-800">
            <AlertDialog.Title className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Remove member?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {pendingRemoval &&
                `Remove ${pendingRemoval.user.email} from this organization? They'll lose access to every board here.`}
            </AlertDialog.Description>
            {removeError && (
              <p
                role="alert"
                className="mt-2 text-sm text-red-600 dark:text-red-400"
              >
                {removeError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={removing}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemove()}
                disabled={removing}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
