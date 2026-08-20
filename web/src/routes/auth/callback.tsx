import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthCard } from '@/components/auth/AuthCard'
import { FormError } from '@/components/auth/FormError'
import { FormField } from '@/components/auth/FormField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { MIN_PASSWORD_LENGTH } from '@/lib/validation'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

type CallbackMode = 'verifying' | 'recovery' | 'confirmed' | 'error'

// If neither an auth event nor an `error` param ever shows up (e.g. someone
// opens this URL directly, with no tokens attached), stop showing a
// spinner forever.
const FALLBACK_TIMEOUT_MS = 6000

interface PasswordFieldErrors {
  newPassword?: string
  confirmPassword?: string
}

function AuthCallbackPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<CallbackMode>('verifying')
  const [errorMessage, setErrorMessage] = useState(
    'This link is invalid or has expired.',
  )

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordUpdated, setIsPasswordUpdated] = useState(false)

  // Supabase's redirect carries `error`/`error_description` (in the query
  // string or the URL hash, depending on the flow) when a link is invalid
  // or expired, and otherwise fires a PASSWORD_RECOVERY or SIGNED_IN auth
  // event once it finishes establishing the session from the URL. See
  // planning/architecture.md#auth-flow.
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const searchParams = new URLSearchParams(window.location.search)
    const description =
      hashParams.get('error_description') ??
      searchParams.get('error_description')
    if (description) {
      setErrorMessage(description.replace(/\+/g, ' '))
      setMode('error')
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('recovery')
      } else if (event === 'SIGNED_IN') {
        setMode((current) => (current === 'recovery' ? current : 'confirmed'))
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (mode !== 'verifying') return
    const timeout = setTimeout(() => setMode('error'), FALLBACK_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [mode])

  useEffect(() => {
    if (mode !== 'confirmed') return
    const timeout = setTimeout(() => void navigate({ to: '/orgs' }), 1500)
    return () => clearTimeout(timeout)
  }, [mode, navigate])

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const errors: PasswordFieldErrors = {}
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    const { error } = await updatePassword(newPassword)
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message)
      return
    }
    setIsPasswordUpdated(true)
  }

  if (mode === 'error') {
    return (
      <AuthCard title="Something went wrong" description={errorMessage}>
        <Link
          to="/forgot-password"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Request a new reset link
        </Link>
      </AuthCard>
    )
  }

  if (mode === 'confirmed') {
    return (
      <AuthCard
        title="Email confirmed"
        description="Redirecting you into Ollert…"
      />
    )
  }

  if (mode === 'recovery') {
    if (isPasswordUpdated) {
      return (
        <AuthCard
          title="Password updated"
          description="Your password has been changed."
        >
          <Link
            to="/orgs"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Continue to Ollert
          </Link>
        </AuthCard>
      )
    }

    return (
      <AuthCard
        title="Set a new password"
        description="Choose a new password for your account."
      >
        <form className="space-y-4" onSubmit={handlePasswordSubmit} noValidate>
          {formError && <FormError message={formError} />}
          <FormField
            id="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={fieldErrors.newPassword}
          />
          <FormField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={fieldErrors.confirmPassword}
          />
          <SubmitButton pending={isSubmitting} pendingLabel="Updating…">
            Update password
          </SubmitButton>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Verifying…"
      description="Hang tight, this only takes a moment."
    />
  )
}
