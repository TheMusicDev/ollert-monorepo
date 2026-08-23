import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

interface OrgsContextValue {
  /** Bumped whenever an org is created/renamed/deleted, so other components
   * (e.g. the sidebar switcher) know their cached org list is stale —
   * event-driven, not polled, since every mutation already goes through
   * orgs-api.ts and can call invalidateOrgs() directly. */
  orgsVersion: number
  invalidateOrgs: () => void
}

const OrgsContext = createContext<OrgsContextValue | undefined>(undefined)

export function OrgsProvider({ children }: { children: ReactNode }) {
  const [orgsVersion, setOrgsVersion] = useState(0)
  const invalidateOrgs = useCallback(() => setOrgsVersion((v) => v + 1), [])

  return (
    <OrgsContext.Provider value={{ orgsVersion, invalidateOrgs }}>
      {children}
    </OrgsContext.Provider>
  )
}

export function useOrgsInvalidation(): OrgsContextValue {
  const ctx = useContext(OrgsContext)
  if (!ctx) {
    throw new Error('useOrgsInvalidation must be used within OrgsProvider')
  }
  return ctx
}
