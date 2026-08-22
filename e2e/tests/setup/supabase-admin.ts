/**
 * Thin wrapper around Supabase Auth's (GoTrue) REST API — used only from
 * Node (global-setup), never from a page context. Two capabilities:
 *
 *  - `createConfirmedUser` — the Admin API (requires the project's
 *    service_role key), used to provision throwaway, pre-confirmed test
 *    users without sending (and burning the rate limit on) a real
 *    confirmation email.
 *  - `passwordSignIn` — the public token endpoint (same one the FE's
 *    `supabase-js` client calls under the hood for
 *    `signInWithPassword`), used to mint an access token for a seeded user
 *    so global-setup can make one authenticated API call and
 *    JIT-provision that user's CakePHP `users` row (see
 *    planning/architecture.md#auth-flow) — real HTTP calls against the
 *    real API, not a direct DB insert.
 */
import { env } from './env'

interface SignInResult {
  accessToken: string
  userId: string
}

export async function passwordSignIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const res = await fetch(
    `${env.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: env.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    },
  )

  const body = (await res.json()) as {
    access_token?: string
    user?: { id?: string }
    error_description?: string
    msg?: string
  }

  if (!res.ok || !body.access_token) {
    const detail = body.error_description ?? body.msg ?? JSON.stringify(body)
    throw new Error(
      `Supabase password sign-in failed for ${email} (${res.status}): ${detail}`,
    )
  }

  return { accessToken: body.access_token, userId: body.user?.id ?? '' }
}

/**
 * Creates a new Supabase user via the Admin API with `email_confirm: true`
 * — pre-confirmed, so it can sign in immediately without clicking an email
 * link. Requires `SUPABASE_SERVICE_ROLE_KEY`.
 */
export async function createConfirmedUser(
  email: string,
  password: string,
): Promise<{ id: string }> {
  const serviceRoleKey = env.supabaseServiceRoleKey
  if (!serviceRoleKey) {
    throw new Error(
      'createConfirmedUser requires SUPABASE_SERVICE_ROLE_KEY to be set.',
    )
  }

  const res = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })

  const body = (await res.json()) as { id?: string; msg?: string; message?: string }

  if (!res.ok || !body.id) {
    const detail = body.msg ?? body.message ?? JSON.stringify(body)
    throw new Error(
      `Supabase admin user creation failed for ${email} (${res.status}): ${detail}`,
    )
  }

  return { id: body.id }
}

/** Deletes a Supabase user via the Admin API — used by global-teardown to
 * clean up throwaway accounts created via `createConfirmedUser`. */
export async function deleteUser(id: string): Promise<void> {
  const serviceRoleKey = env.supabaseServiceRoleKey
  if (!serviceRoleKey || !id) return

  await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })
}
