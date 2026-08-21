import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'

import type { CardEntity } from '@/lib/board-types'

export interface CardDetailUpdates {
  title: string
  description: string | null
  due_date: string | null
}

export interface CardDetailModalProps {
  /** The card being edited, or `null` when the modal should be closed. */
  card: CardEntity | null
  onClose: () => void
  onSave: (updates: CardDetailUpdates) => Promise<void>
  onDelete: () => Promise<void>
}

/** Card detail modal: title/description/due_date editing + delete. Built
 * on Base UI's Dialog primitives. */
export function CardDetailModal({
  card,
  onClose,
  onSave,
  onDelete,
}: CardDetailModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description ?? '')
      setDueDate(card.due_date ?? '')
      setError(null)
      setIsSubmitting(false)
    }
  }, [card])

  if (!card) return null

  async function handleSave() {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() === '' ? null : description,
        due_date: dueDate === '' ? null : dueDate,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save card.')
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this card? This cannot be undone.')) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onDelete()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete card.')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-bottom dark:bg-gray-800">
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Card details
          </Dialog.Title>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Due date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <Dialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
