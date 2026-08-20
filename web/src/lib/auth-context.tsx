import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

import { supabase } from './supabase'

interface AuthContextValue {
  /** Current Supabase session, or null when signed out. */
  session: Session | null
  /** Convenience accessor for `session.user`. */
  user: User | null
  /** True until the initial `getSession()` call resolves. */
  isLoading: boolean
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>
  /**
   * `data.session` is null when the Supabase project requires email
   * confirmation before a session is issued — callers use that to decide
   * between "signed in immediately" and "check your email" UI.
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{
    data: { user: User | null; session: Session | null }
    error: AuthError | null
  }>
  signOut: () => Promise<void>
  /** Sends a password-reset email; the link redirects to `/auth/callback`. */
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>
  /**
   * Sets a new password for the current session — only meaningful once
   * Supabase's recovery-link redirect has established a recovery session
   * (see `/auth/callback`).
   */
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
}

/**
 * Absolute URL Supabase redirects back to after a password-reset or
 * email-confirmation link is clicked. See planning/architecture.md#auth-flow
 * — this URL must also be added to the Supabase project's allowed redirect
 * URLs.
 */
function authCallbackUrl(): string | undefined {
  return typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : undefined
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    // Supabase's client auto-refreshes the access token ahead of expiry and
    // fires this listener with the refreshed session — the frontend never
    // triggers a refresh itself. See planning/architecture.md#auth-flow.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authCallbackUrl() },
      })
      return { data, error }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
    resetPasswordForEmail: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: authCallbackUrl(),
      })
      return { error }
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password })
      return { error }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}
