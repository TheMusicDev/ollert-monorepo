import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthCard } from '@/components/auth/AuthCard'
import { FormError } from '@/components/auth/FormError'
import { FormField } from '@/components/auth/FormField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useAuth } from '@/lib/auth-context'
import { MIN_PASSWORD_LENGTH, isValidEmail } from '@/lib/validation'

export const Route = createFileRoute('/signup')({ component: SignupPage })

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

function SignupPage() {
  const { session, signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Set once Supabase confirms the project requires email confirmation
  // before issuing a session (`data.session` came back null).
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)

  useEffect(() => {
    if (session) {
      void navigate({ to: '/orgs' })
    }
  }, [session, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const errors: FieldErrors = {}
    if (!isValidEmail(email)) {
      errors.email = 'Enter a valid email address.'
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    const { data, error } = await signUp(email, password)
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }
    if (!data.session) {
      setNeedsEmailConfirmation(true)
    }
    // Otherwise the project auto-confirms: the `session` effect above
    // navigates once the AuthProvider's listener catches up.
  }

  if (needsEmailConfirmation) {
    return (
      <AuthCard
        title="Check your email"
        description={`We sent a confirmation link to ${email}.`}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click the link in that email to activate your account, then log in.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to log in
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Sign up"
      description="Create your Ollert account."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Log in
          </Link>
        </span>
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
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Signing up…">
          Sign up
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
