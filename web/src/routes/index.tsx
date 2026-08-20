import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Index })

function Index() {
  // Org list is the authenticated landing page; the `/_authenticated` layout
  // route redirects to `/login` when there's no session.
  return <Navigate to="/orgs" />
}
