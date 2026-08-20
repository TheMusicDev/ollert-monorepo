import { Navigate, createFileRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/AppShell'
import { useAuth } from '@/lib/auth-context'

/**
 * Pathless layout route: every route nested under `_authenticated/` gets the
 * app shell (sidebar + navbar) and a session guard, without the segment
 * appearing in the URL.
 */
export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" />
  }

  return <AppShell />
}
