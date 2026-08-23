import { useState } from 'react'
import type { FormEvent } from 'react'

export interface CreateListFormProps {
  onCreate: (title: string) => Promise<void>
}

/** "+ Add another list" control, rendered under the board title. */
export function CreateListForm({ onCreate }: CreateListFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create list.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-fit rounded-lg bg-gray-100/60 px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        + Add another list
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-72 space-y-2 rounded-lg bg-gray-100 p-3 dark:bg-gray-800"
    >
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="List title"
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
          Add list
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
