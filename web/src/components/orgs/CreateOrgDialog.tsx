import { useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

import { ApiError } from '@/lib/api-client'
import { createOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

interface CreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (org: Organization) => void
}

/**
 * Create-org form. Surfaces the 422 `quota_exceeded` error inline — since
 * `max_orgs` defaults to 1, most users hit this right after creating their
 * first org, so the message is framed as expected, not a failure. See
 * planning/data-model.md#quotas.
 */
export function CreateOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrgDialogProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false)

  const reset = () => {
    setName('')
    setError('')
    setIsQuotaExceeded(false)
    setIsSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required.')
      setIsQuotaExceeded(false)
      return
    }

    setIsSubmitting(true)
    setError('')
    setIsQuotaExceeded(false)
    try {
      const org = await createOrg(trimmed)
      reset()
      onCreated(org)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'quota_exceeded') {
          setIsQuotaExceeded(true)
          setError(err.message)
        } else if (err.fields?.name) {
          setError(err.fields.name.join(' '))
        } else {
          setError(err.message)
        }
      } else {
        setError('Something went wrong creating the organization.')
      }
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-bottom dark:bg-gray-800">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            New organization
          </Dialog.Title>
          <form className="mt-4 space-y-1" onSubmit={handleSubmit} noValidate>
            <label
              htmlFor="create-org-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Name
            </label>
            <input
              id="create-org-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            {error && (
              <p
                role="alert"
                className={
                  isQuotaExceeded
                    ? 'mt-2 text-sm text-yellow-700 dark:text-yellow-400'
                    : 'mt-2 text-sm text-red-600 dark:text-red-400'
                }
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
                {isSubmitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
