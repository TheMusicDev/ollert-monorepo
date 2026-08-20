import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

import { ApiError } from '@/lib/api-client'

/** Matches `boards.title` — `varchar(255)`, required. See planning/data-model.md. */
const MAX_TITLE_LENGTH = 255

interface BoardFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialTitle?: string
  onSubmit: (title: string) => Promise<void>
}

/**
 * Shared title-only form dialog for both creating and renaming a board.
 * Handles client-side required/length validation plus the 422 envelope
 * (`fields.title` -> inline field error, otherwise a form-level banner —
 * covers `quota_exceeded` on create). See planning/api-contract.md#error-response-shape.
 */
export function BoardFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialTitle = '',
  onSubmit,
}: BoardFormDialogProps) {
  const [value, setValue] = useState(initialTitle)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(initialTitle)
      setFieldError(null)
      setFormError(null)
      setSubmitting(false)
    }
  }, [open, initialTitle])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()

    if (!trimmed) {
      setFieldError('Title is required.')
      return
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      setFieldError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`)
      return
    }

    setFieldError(null)
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setSubmitting(false)
      onOpenChange(false)
    } catch (error) {
      setSubmitting(false)
      if (error instanceof ApiError) {
        const titleFieldError = error.fields?.title[0]
        if (titleFieldError) {
          setFieldError(titleFieldError)
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-white p-6 shadow-bottom dark:border-gray-700 dark:bg-gray-800">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </Dialog.Title>
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="board-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Board title
              </label>
              <input
                id="board-title"
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              {fieldError && (
                <p
                  role="alert"
                  className="mt-1 text-sm text-red-600 dark:text-red-400"
                >
                  {fieldError}
                </p>
              )}
            </div>

            {formError && (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Dialog.Close
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Saving…' : submitLabel}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
