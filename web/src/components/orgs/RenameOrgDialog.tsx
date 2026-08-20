import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

import { ApiError } from '@/lib/api-client'
import { renameOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

interface RenameOrgDialogProps {
  /** Org being renamed, or null when the dialog should stay closed. */
  org: Organization | null
  onOpenChange: (open: boolean) => void
  onRenamed: (org: Organization) => void
}

/** Rename-org form. Any org member may rename — see planning/api-contract.md#organizations. */
export function RenameOrgDialog({
  org,
  onOpenChange,
  onRenamed,
}: RenameOrgDialogProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setName(org?.name ?? '')
    setError('')
    setIsSubmitting(false)
  }, [org])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!org) return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const updated = await renameOrg(org.id, trimmed)
      onRenamed(updated)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.fields?.name.join(' ') ?? err.message)
      } else {
        setError('Something went wrong renaming the organization.')
      }
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={org !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-bottom dark:bg-gray-800">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Rename organization
          </Dialog.Title>
          <form className="mt-4 space-y-1" onSubmit={handleSubmit} noValidate>
            <label
              htmlFor="rename-org-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Name
            </label>
            <input
              id="rename-org-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            {error && (
              <p
                role="alert"
                className="mt-2 text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
