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
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
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
      const { error } = await supabase.auth.signUp({ email, password })
      return { error }
    },
    signOut: async () => {
      await supabase.auth.signOut()
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
