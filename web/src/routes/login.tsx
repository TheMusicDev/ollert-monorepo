import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthCard } from '@/components/auth/AuthCard'
import { FormError } from '@/components/auth/FormError'
import { FormField } from '@/components/auth/FormField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useAuth } from '@/lib/auth-context'
import { isValidEmail } from '@/lib/validation'

export const Route = createFileRoute('/login')({ component: LoginPage })

interface FieldErrors {
  email?: string
  password?: string
}

function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sign-in updates `session` via the AuthProvider's onAuthStateChange
  // listener asynchronously — navigate once that catches up rather than
  // racing it right after `signIn` resolves.
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
    if (!password) {
      errors.password = 'Password is required.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    const { error } = await signIn(email, password)
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message)
    }
  }

  return (
    <AuthCard
      title="Log in"
      description="Welcome back to Ollert."
      footer={
        <div className="flex items-center justify-between">
          <Link
            to="/forgot-password"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Forgot password?
          </Link>
          <span>
            No account?{' '}
            <Link
              to="/signup"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign up
            </Link>
          </span>
        </div>
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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
