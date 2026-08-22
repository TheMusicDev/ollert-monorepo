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

/**
 * Deletes every org this user owns. Only needed for the pre-existing-creds
 * fallback path (E2E_OWNER_EMAIL/etc.) — those accounts are the same fixed
 * users every run, so an org one of them owns from a prior run permanently
 * blocks `max_orgs: 1` from ever letting the journey spec create a fresh
 * one. Admin-API-created throwaway users never need this: they're deleted
 * outright in global-teardown, orgs and all.
 */
export async function deleteOwnedOrgs(accessToken: string): Promise<void> {
  const res = await fetch(`${env.apiBaseUrl}/orgs?limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(
      `Listing orgs failed (${res.status}) while cleaning up a test user's leftover orgs.`,
    )
  }
  const body = (await res.json()) as {
    data: Array<{ id: string; is_owner: boolean }>
  }

  for (const org of body.data.filter((o) => o.is_owner)) {
    const del = await fetch(`${env.apiBaseUrl}/orgs/${org.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!del.ok) {
      throw new Error(
        `Deleting leftover org ${org.id} failed (${del.status}) during test cleanup.`,
      )
    }
  }
}
