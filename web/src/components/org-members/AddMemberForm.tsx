import { useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '@/lib/api-client'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface AddMemberFormProps {
  /** Throw (an `ApiError` for API failures) to surface an inline error. */
  onAdd: (email: string) => Promise<void>
}

/**
 * Add-by-email form for `/orgs/:orgId/members`. Surfaces the 404 ("no
 * Ollert account with that email") and 422 (validation) cases called out in
 * fe-tasks.md inline, next to the input.
 */
export function AddMemberForm({ onAdd }: AddMemberFormProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = email.trim()

    if (!trimmed) {
      setError('Enter an email address.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onAdd(trimmed)
      setEmail('')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('No Ollert account found for that email.')
        } else if (err.status === 422) {
          setError(err.fields?.email[0] ?? err.message)
        } else {
          setError(err.message)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      noValidate
    >
      <div className="flex-1">
        <label htmlFor="member-email" className="sr-only">
          Email address
        </label>
        <input
          id="member-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          disabled={submitting}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'member-email-error' : undefined}
        />
        {error && (
          <p
            id="member-email-error"
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Adding…' : 'Add member'}
      </button>
    </form>
  )
}
