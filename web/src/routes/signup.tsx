import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  // Stub — form + Supabase sign-up wired up in feat/web-auth.
  return <div>Sign up</div>
}
