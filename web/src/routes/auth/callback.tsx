import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  // Route only. Receives Supabase's password-reset/email-confirm redirects;
  // the confirmation/reset-completion UI is wired up in feat/web-auth.
  // See planning/architecture.md#auth-flow.
  return <div>Auth callback</div>
}
