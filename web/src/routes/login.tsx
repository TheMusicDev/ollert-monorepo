import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  // Stub — form + Supabase sign-in wired up in feat/web-auth.
  return <div>Login</div>
}
