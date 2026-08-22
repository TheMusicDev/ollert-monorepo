import { readFileSync } from 'node:fs'

import { TEST_USERS_FILE } from './paths'

export interface TestUser {
  email: string
  password: string
  id: string
}

export interface TestUsers {
  owner: TestUser
  member: TestUser
  /** True when both accounts were created fresh by global-setup via the
   * Supabase Admin API (and so are safe for global-teardown to delete). */
  createdViaAdmin: boolean
}

/**
 * global-setup never throws just because it couldn't resolve test
 * credentials — it writes `{ ok: false, reason }` instead, so specs that
 * don't need a signed-in user (e.g. the plain signup-form smoke test) can
 * still run and pass. Specs that do need a user read this and call
 * `test.skip(!result.ok, result.reason)`.
 */
export type TestUsersResult =
  | { ok: true; users: TestUsers }
  | { ok: false; reason: string }

/** Reads what global-setup produced. Call only from specs — by the time a
 * test runs, global-setup has already written this file. */
export function loadTestUsersResult(): TestUsersResult {
  const raw = readFileSync(TEST_USERS_FILE, 'utf-8')
  return JSON.parse(raw) as TestUsersResult
}

/** Convenience for specs that require a signed-in user unconditionally —
 * throws with the recorded reason if global-setup couldn't provide one. */
export function loadTestUsers(): TestUsers {
  const result = loadTestUsersResult()
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.users
}
