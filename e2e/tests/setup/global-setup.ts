/**
 * Playwright global setup — runs once before the suite. Resolves the two
 * test identities the scenarios need (an org "owner" and a second "member"
 * account used for the org-member add/remove flow) and seeds them through
 * real HTTP calls, per planning/roadmap.md#testing-strategy ("Test data
 * seeded through the real API ... not direct DB inserts").
 *
 * Auth strategy (see e2e/README.md for the full writeup):
 *
 *   1. Preferred: SUPABASE_SERVICE_ROLE_KEY is set -> create two brand-new,
 *      pre-confirmed Supabase users via the Admin API. This is the real
 *      Supabase Auth signup path minus the email-confirmation *click*
 *      (which no automated environment can perform against a hosted
 *      inbox) — it still produces a real account with a real
 *      password-grant session, and sidesteps the project's very low
 *      built-in outbound-email rate limit, which self-serve signup was
 *      observed to hit after ~2 signups in local testing.
 *
 *   2. Fallback: no service-role key -> require pre-existing, already
 *      confirmed E2E_OWNER_EMAIL/PASSWORD and E2E_MEMBER_EMAIL/PASSWORD.
 *
 * Either way, once we have credentials, each user is signed in once (via
 * Supabase's real token endpoint) and used to make one authenticated
 * `GET /api/orgs` call — CakePHP JIT-provisions that Supabase user's local
 * `users` row on first authenticated request (planning/architecture.md
 * #auth-flow), which the "add member by email" scenario depends on (the
 * API requires the target to already have an Ollert account).
 */
import { mkdirSync, writeFileSync } from 'node:fs'

import { env } from './env'
import { AUTH_DIR, TEST_USERS_FILE } from './paths'
import { deleteOwnedOrgs, provisionUser } from './api-seed'
import { createConfirmedUser, passwordSignIn } from './supabase-admin'
import type { TestUsers, TestUsersResult } from './test-users'

const TEST_PASSWORD = 'Ollert-E2E-Test-Password-1!'

async function resolveViaAdminApi(): Promise<TestUsers> {
  const stamp = Date.now()
  const ownerEmail = `ollert-e2e-owner-${stamp}@ollert-e2e.test`
  const memberEmail = `ollert-e2e-member-${stamp}@ollert-e2e.test`

  const [owner, member] = await Promise.all([
    createConfirmedUser(ownerEmail, TEST_PASSWORD),
    createConfirmedUser(memberEmail, TEST_PASSWORD),
  ])

  return {
    owner: { email: ownerEmail, password: TEST_PASSWORD, id: owner.id },
    member: { email: memberEmail, password: TEST_PASSWORD, id: member.id },
    createdViaAdmin: true,
  }
}

function resolveViaPreExistingCreds(): TestUsers {
  const { ownerEmail, ownerPassword, memberEmail, memberPassword } = env
  const missing = [
    ['E2E_OWNER_EMAIL', ownerEmail],
    ['E2E_OWNER_PASSWORD', ownerPassword],
    ['E2E_MEMBER_EMAIL', memberEmail],
    ['E2E_MEMBER_PASSWORD', memberPassword],
  ].filter(([, value]) => !value)

  if (missing.length > 0) {
    throw new Error(
      'No SUPABASE_SERVICE_ROLE_KEY set, and pre-existing test credentials are incomplete. ' +
        `Missing: ${missing.map(([name]) => name).join(', ')}. ` +
        'Either set SUPABASE_SERVICE_ROLE_KEY (preferred — see e2e/README.md#auth-strategy) ' +
        'or provide two already-confirmed Supabase accounts via E2E_OWNER_EMAIL/PASSWORD and ' +
        'E2E_MEMBER_EMAIL/PASSWORD in e2e/.env.',
    )
  }

  return {
    owner: { email: ownerEmail!, password: ownerPassword!, id: '' },
    member: { email: memberEmail!, password: memberPassword!, id: '' },
    createdViaAdmin: false,
  }
}

export default async function globalSetup(): Promise<void> {
  let result: TestUsersResult

  try {
    const users = env.supabaseServiceRoleKey
      ? await resolveViaAdminApi()
      : resolveViaPreExistingCreds()

    // Sign in as each and hit a real authenticated endpoint so CakePHP
    // JIT-provisions their `users` row ahead of the org-members scenario.
    for (const user of [users.owner, users.member]) {
      const { accessToken } = await passwordSignIn(user.email, user.password)
      await provisionUser(accessToken)

      // Fixed pre-existing accounts persist across runs, so an org left
      // over from a prior run (or manual testing with the same creds)
      // would otherwise permanently block max_orgs: 1 from ever letting
      // the journey spec create a fresh one. Admin-created throwaway users
      // never carry this risk — skip it there, it's a wasted round trip.
      if (!users.createdViaAdmin) {
        await deleteOwnedOrgs(accessToken)
      }
    }

    result = { ok: true, users }
  } catch (err) {
    // Deliberately don't rethrow: a spec that needs a signed-in user skips
    // itself with this reason (see tests/setup/test-users.ts), but specs
    // that don't (e.g. the plain signup-form smoke test) still get to run.
    result = {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }
    // eslint-disable-next-line no-console
    console.error(
      `[global-setup] Could not seed test users — dependent specs will skip. Reason: ${result.reason}`,
    )
  }

  mkdirSync(AUTH_DIR, { recursive: true })
  writeFileSync(TEST_USERS_FILE, JSON.stringify(result, null, 2))
}
