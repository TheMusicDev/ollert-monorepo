import { expect, test } from '@playwright/test'

import { loadTestUsersResult } from '../setup/test-users'
import { login } from './helpers'

const TEST_PASSWORD = 'Ollert-E2E-Test-Password-1!'

test.describe('Auth', () => {
  test('signing up with a new email shows the check-your-email screen', async ({
    page,
  }) => {
    // Exercises the real Supabase signup call end-to-end. We don't (and,
    // per e2e/README.md#auth-strategy, can't in this environment) click
    // the confirmation link that follows, so this only verifies the
    // pre-confirmation part of the flow — the project has "Confirm email"
    // enabled, so submitting the form should never land on `/orgs`
    // directly.
    const email = `ollert-e2e-signup-${Date.now()}@ollert-e2e.test`

    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(
      page.getByRole('heading', { name: 'Check your email' }),
    ).toBeVisible()
    await expect(
      page.getByText(`We sent a confirmation link to ${email}.`),
    ).toBeVisible()
  })

  test('a confirmed user can log in and lands on /orgs', async ({ page }) => {
    const result = loadTestUsersResult()
    test.skip(!result.ok, !result.ok ? result.reason : '')
    if (!result.ok) return

    await login(page, result.users.owner.email, result.users.owner.password)
  })
})
