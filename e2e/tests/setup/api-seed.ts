/**
 * Real HTTP calls against the running CakePHP API — used by global-setup to
 * seed the one thing the UI-driven scenarios can't do themselves: get a
 * brand-new Supabase user's local `users` row provisioned in MySQL before
 * another user tries to add them to an org by email (the API requires the
 * target to already have an Ollert account — see
 * planning/api-contract.md#org-members). CakePHP provisions that row
 * just-in-time on the *first* authenticated request from a given Supabase
 * `sub` (planning/architecture.md#auth-flow), so a single authenticated
 * GET is enough — no direct DB insert involved.
 */
import { env } from './env'

export async function provisionUser(accessToken: string): Promise<void> {
  const res = await fetch(`${env.apiBaseUrl}/orgs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(
      `Seeding call to GET /api/orgs failed (${res.status}) while provisioning a test user — is the API running at ${env.apiBaseUrl}?`,
    )
  }
}
