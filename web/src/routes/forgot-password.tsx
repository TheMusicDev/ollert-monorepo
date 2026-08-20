import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { AuthCard } from '@/components/auth/AuthCard'
import { FormError } from '@/components/auth/FormError'
import { FormField } from '@/components/auth/FormField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useAuth } from '@/lib/auth-context'
import { isValidEmail } from '@/lib/validation'

// Own top-level route rather than a `/login` mode: keeps the "request a
// reset link" flow bookmarkable/linkable (from `/login` and from
// `/auth/callback`'s error state) without extra state threaded through the
// login form. planning/design.md doesn't specify a convention here.
export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const { resetPasswordForEmail } = useAuth()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.')
      return
    }
    setEmailError(undefined)

    setIsSubmitting(true)
    const { error } = await resetPasswordForEmail(email)
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }
    setIsSent(true)
  }

  if (isSent) {
    return (
      <AuthCard
        title="Check your email"
        description={`If an account exists for ${email}, we've sent a password reset link.`}
      >
        <Link
          to="/login"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to log in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to set a new password."
      footer={
        <Link
          to="/login"
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to log in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {formError && <FormError message={formError} />}
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
