import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

import { ApiError } from '@/lib/api-client'
import { updateAdminUser } from '@/lib/admin-api'
import type { AdminUser } from '@/lib/admin-api'

interface EditUserQuotasDialogProps {
  /** User being edited, or null when the dialog should stay closed. */
  user: AdminUser | null
  onOpenChange: (open: boolean) => void
  onSaved: (user: AdminUser) => void
}

const QUOTA_FIELDS = [
  { key: 'max_orgs', label: 'Max organizations' },
  { key: 'max_boards_per_org', label: 'Max boards per org' },
  { key: 'max_lists_per_board', label: 'Max lists per board' },
  { key: 'max_cards_per_board', label: 'Max cards per board' },
] as const

type QuotaFormState = Record<(typeof QUOTA_FIELDS)[number]['key'], string>

const EMPTY_FORM: QuotaFormState = {
  max_orgs: '',
  max_boards_per_org: '',
  max_lists_per_board: '',
  max_cards_per_board: '',
}

/**
 * Admin-only quota override + promote/demote form. See
 * planning/api-contract.md#admin — `PATCH /api/admin/users/:id`.
 */
export function EditUserQuotasDialog({
  user,
  onOpenChange,
  onSaved,
}: EditUserQuotasDialogProps) {
  const [form, setForm] = useState<QuotaFormState>(EMPTY_FORM)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(
      user
        ? {
            max_orgs: String(user.max_orgs),
            max_boards_per_org: String(user.max_boards_per_org),
            max_lists_per_board: String(user.max_lists_per_board),
            max_cards_per_board: String(user.max_cards_per_board),
          }
        : EMPTY_FORM,
    )
    setIsAdmin(user?.is_admin ?? false)
    setError('')
    setIsSubmitting(false)
  }, [user])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) return

    const parsed: Record<string, number> = {}
    for (const { key, label } of QUOTA_FIELDS) {
      const value = Number(form[key])
      if (!Number.isInteger(value) || value < 0) {
        setError(`${label} must be a non-negative whole number.`)
        return
      }
      parsed[key] = value
    }

    setIsSubmitting(true)
    setError('')
    try {
      const updated = await updateAdminUser(user.id, {
        ...parsed,
        is_admin: isAdmin,
      })
      onSaved(updated)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong saving this user.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={user !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-bottom dark:bg-gray-800">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit {user?.email}
          </Dialog.Title>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
            {QUOTA_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label
                  htmlFor={`edit-user-${key}`}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {label}
                </label>
                <input
                  id={`edit-user-${key}`}
                  type="number"
                  min={0}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(event) => setIsAdmin(event.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Platform admin
            </label>
            {error && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
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
