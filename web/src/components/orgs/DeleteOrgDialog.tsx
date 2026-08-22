import { useEffect, useState } from 'react'
import { AlertDialog } from '@base-ui-components/react/alert-dialog'

import { ApiError } from '@/lib/api-client'
import { deleteOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

interface DeleteOrgDialogProps {
  /** Org pending deletion, or null when the dialog should stay closed. */
  org: Organization | null
  onOpenChange: (open: boolean) => void
  onDeleted: (org: Organization) => void
}

/**
 * Delete-org confirmation. Owner only per planning/api-contract.md#organizations
 * and planning/data-model.md#organizations — the org list hides the Delete
 * action for orgs the API has flagged `is_owner: false`. This 403 handler
 * stays as defense in depth (the backend is the real authority), not because
 * `is_owner` can be absent — it can't, the API always sets it.
 */
export function DeleteOrgDialog({
  org,
  onOpenChange,
  onDeleted,
}: DeleteOrgDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    setIsDeleting(false)
  }, [org])

  const handleDelete = async () => {
    if (!org) return
    setIsDeleting(true)
    setError('')
    try {
      await deleteOrg(org.id)
      onDeleted(org)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only the owner can delete this organization.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong deleting the organization.')
      }
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog.Root open={org !== null} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-bottom dark:bg-gray-800">
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Delete organization
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Delete “{org?.name}”? This can’t be undone.
          </AlertDialog.Description>
          {error && (
            <p
              role="alert"
              className="mt-2 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
