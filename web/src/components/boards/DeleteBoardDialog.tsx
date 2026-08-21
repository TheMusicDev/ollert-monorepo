import { useState } from 'react'
import { AlertDialog } from '@base-ui-components/react/alert-dialog'

import { ApiError } from '@/lib/api-client'
import { deleteBoard } from '@/lib/boards-api'
import type { Board } from '@/lib/boards-api'

interface DeleteBoardDialogProps {
  board: Board
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

/** Confirm-then-delete dialog for a single board. */
export function DeleteBoardDialog({
  board,
  open,
  onOpenChange,
  onDeleted,
}: DeleteBoardDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await deleteBoard(board.id)
      setSubmitting(false)
      onDeleted()
    } catch (err) {
      setSubmitting(false)
      setError(
        err instanceof ApiError ? err.message : 'Failed to delete board.',
      )
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-white p-6 shadow-bottom dark:border-gray-700 dark:bg-gray-800">
          <AlertDialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Delete board
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Delete &ldquo;{board.title}&rdquo;? This can&rsquo;t be undone.
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
            <AlertDialog.Close
              type="button"
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
