/**
 * Deletes the throwaway Supabase users global-setup created via the Admin
 * API (no-op when the suite ran against pre-existing, human-managed
 * credentials — `createdViaAdmin: false`). Their CakePHP-side `users` /
 * `organizations` / `boards` rows are soft-deleted by the app's own delete
 * endpoints during the tests themselves, or simply left as harmless
 * orphaned rows in the local dev DB otherwise — nothing here does a direct
 * DB cleanup, consistent with seeding through the real API only.
 */
import { existsSync } from 'node:fs'

import { TEST_USERS_FILE } from './paths'
import { deleteUser } from './supabase-admin'
import { loadTestUsersResult } from './test-users'

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(TEST_USERS_FILE)) return

  const result = loadTestUsersResult()
  if (!result.ok || !result.users.createdViaAdmin) return

  await Promise.all([
    deleteUser(result.users.owner.id),
    deleteUser(result.users.member.id),
  ])
}
