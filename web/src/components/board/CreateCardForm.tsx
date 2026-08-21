import { useState } from 'react'
import type { FormEvent } from 'react'

export interface CreateCardFormProps {
  onCreate: (title: string) => Promise<void>
}

/** Inline "+ Add a card" affordance at the bottom of a `BoardList` column. */
export function CreateCardForm({ onCreate }: CreateCardFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
      >
        + Add a card
      </button>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onCreate(title.trim())
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create card.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Card title"
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            setTitle('')
            setError(null)
          }}
          className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
