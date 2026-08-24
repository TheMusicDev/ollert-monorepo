// Supabase OAuth 2.1 server consent screen. Supabase's `/oauth/authorize`
// redirects the resource owner here with `?authorization_id=…` once they've
// authenticated with Supabase; this page shows what the OAuth client (claude.ai)
// is requesting and calls `approveAuthorization`/`denyAuthorization`, then
// bounces the browser back to the client's redirect_uri with the code (or error).
//
// Must be a PUBLIC route (not under `_authenticated/`) — it's reached before a
// session is guaranteed. If the user isn't logged in, show an inline sign-in
// (reusing the auth components) rather than bouncing to /login, so the
// authorization_id in the URL isn't lost on a round-trip.
//
// See planning/mcp-server.md §"web/ consent route".

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AuthCard } from '@/components/auth/AuthCard'
import { FormError } from '@/components/auth/FormError'
import { FormField } from '@/components/auth/FormField'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation'

export const Route = createFileRoute('/oauth/consent')({ component: ConsentPage })

// Subset of Supabase's `OAuthAuthorizationDetails` that the consent UI renders.
// Kept local (not imported) so a supabase-js re-export rename can't break the
// build — structural assignment from the SDK's narrowed response still typechecks.
interface ConsentDetails {
  client: { name: string; uri: string; logo_uri: string }
  redirect_uri: string
  scope: string
}

interface SignInFieldErrors {
  email?: string
  password?: string
}

function ConsentPage() {
  const { session, signIn } = useAuth()

  const [authorizationId, setAuthorizationId] = useState<string | null>(null)
  const [details, setDetails] = useState<ConsentDetails | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>(
    'This authorization request is invalid or has expired.',
  )
  // 'idle' = not yet decided what to render; 'consent' = show approve/deny;
  // 'busy' = approve/deny in flight; 'error' = show error card.
  const [phase, setPhase] = useState<'idle' | 'consent' | 'busy' | 'error'>('idle')

  // inline sign-in state (only used when no session)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Read authorization_id from the URL once.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('authorization_id')
    if (!id) {
      setErrorMessage('Missing authorization_id.')
      setPhase('error')
      return
    }
    setAuthorizationId(id)
  }, [])

  // Once we have a session + an id, fetch what the client is asking for.
  useEffect(() => {
    if (!authorizationId || !session) return
    let cancelled = false
    supabase.auth.oauth
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (error) {
          if (!cancelled) {
            setErrorMessage(error.message)
            setPhase('error')
          }
          return
        }
        // Already consented to these scopes → Supabase hands back a redirect
        // URL with the code; bounce immediately, no UI needed.
        if (!('authorization_id' in data)) {
          window.location.href = data.redirect_url
          return
        }
        if (cancelled) return
        setDetails({
          client: data.client,
          redirect_uri: data.redirect_uri,
          scope: data.scope,
        })
        setPhase('consent')
      })
    return () => {
      cancelled = true
    }
  }, [authorizationId, session])

  async function decide(approve: boolean) {
    if (!authorizationId) return
    setPhase('busy')
    // skipBrowserRedirect so we control the redirect via data.redirect_url
    // (the SDK auto-redirect path + the docs' `redirect_to` naming are both
    // footguns — issue supabase/supabase#45006).
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
    if (error) {
      setErrorMessage(error.message)
      setPhase('error')
      return
    }
    window.location.href = data.redirect_url
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const errors: SignInFieldErrors = {}
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH)
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    setIsSigningIn(true)
    const { error } = await signIn(email, password)
    setIsSigningIn(false)
    if (error) setFormError(error.message)
    // on success, AuthProvider's session update re-runs the fetch effect above.
  }

  if (phase === 'error') {
    return (
      <AuthCard title="Authorization problem" description={errorMessage}>
        <a
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Back to Ollert
        </a>
      </AuthCard>
    )
  }

  // No session yet → inline sign-in. (authLoading only true on first paint;
  // once it clears with no session we show the form.)
  if (!session) {
    return (
      <AuthCard
        title="Sign in to authorize"
        description="Log in to your Ollert account to approve this request."
      >
        <form className="space-y-4" onSubmit={handleSignIn} noValidate>
          {formError && <FormError message={formError} />}
          <FormField
            id="consentEmail"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <FormField
            id="consentPassword"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
          />
          <SubmitButton pending={isSigningIn} pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </AuthCard>
    )
  }

  if (phase === 'idle' || !details) {
    return (
      <AuthCard
        title="Authorizing…"
        description="Loading the authorization request."
      />
    )
  }

  const scopes = details.scope.split(' ').filter(Boolean)
  const clientName = details.client.name || 'an application'

  return (
    <AuthCard
      title={`Authorize ${clientName}`}
      description={`${clientName} is requesting access to your Ollert account.`}
    >
      <div className="space-y-4 text-sm">
        {details.client.logo_uri && (
          <img
            src={details.client.logo_uri}
            alt={`${clientName} logo`}
            className="h-12 w-12 rounded"
          />
        )}
        {details.client.uri && (
          <p className="text-slate-600 dark:text-slate-400">
            <a
              href={details.client.uri}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {details.client.uri}
            </a>
          </p>
        )}
        <div>
          <p className="font-medium text-slate-700 dark:text-slate-300">
            Requested permissions
          </p>
          <ul className="mt-1 list-disc pl-5 text-slate-600 dark:text-slate-400">
            {scopes.length > 0 ? (
              scopes.map((s) => <li key={s}>{s}</li>)
            ) : (
              <li>Read your basic profile information</li>
            )}
          </ul>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          Redirects to{' '}
          <span className="font-mono">{details.redirect_uri}</span>
        </p>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => void decide(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-500"
          >
            {phase === 'busy' ? 'Working…' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => void decide(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Deny
          </button>
        </div>
      </div>
    </AuthCard>
  )
}