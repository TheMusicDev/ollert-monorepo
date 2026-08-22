import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { env } from '../setup/env'

/** Logs in through the real `/login` form and waits for the post-login
 * redirect to `/orgs`. */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL('**/orgs')
  await expect(
    page.getByRole('heading', { name: 'Organizations' }),
  ).toBeVisible()
}

/** Creates an org through the `CreateOrgDialog` UI and returns the id the
 * API assigned it (read off the real `POST /api/orgs` response). */
export async function createOrgViaUi(
  page: Page,
  name: string,
): Promise<string> {
  await page.getByRole('button', { name: 'New organization' }).click()
  await page.getByLabel('Name').fill(name)

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().endsWith('/orgs'),
    ),
    page.getByRole('button', { name: 'Create' }).click(),
  ])

  const body = (await response.json()) as { id: string }
  await expect(page.getByRole('dialog')).toBeHidden()
  return body.id
}

/** Attempts to create an org and asserts the quota-exceeded banner shows
 * instead — see `App\Controller\OrganizationsController` for the exact
 * copy this asserts against. */
export async function expectOrgQuotaExceeded(page: Page, name: string) {
  await page.getByRole('button', { name: 'New organization' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('alert')).toHaveText(
    'You have reached your organization quota.',
  )
  await page.getByRole('button', { name: 'Cancel' }).click()
}

/** Creates a board through `BoardFormDialog` and returns its id. */
export async function createBoardViaUi(
  page: Page,
  title: string,
): Promise<string> {
  await page.getByRole('button', { name: 'New board' }).click()
  await page.getByLabel('Board title').fill(title)

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/orgs\/[^/]+\/boards$/.test(res.url()),
    ),
    page.getByRole('button', { name: 'Create' }).click(),
  ])

  const body = (await response.json()) as { id: string }
  await expect(page.getByRole('dialog')).toBeHidden()
  return body.id
}

/** Attempts to create a board and asserts the quota-exceeded banner shows. */
export async function expectBoardQuotaExceeded(page: Page, title: string) {
  await page.getByRole('button', { name: 'New board' }).click()
  await page.getByLabel('Board title').fill(title)
  await page.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByText("You have reached this organization's board quota.")).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
}

/** Navigates straight to an org's detail page. There is currently no
 * in-app link from the `/orgs` list to a given org's detail page (the
 * `OrgTable` row renders the org name as plain text, not a link) — this
 * exercises the real route directly, the same way a user hitting
 * "back"/a bookmark/a shared link would land on it. */
export async function gotoOrg(page: Page, orgId: string) {
  await page.goto(`/orgs/${orgId}`)
}

/** Drags a dnd-kit sortable item from `source` to `target` via a manual
 * pointer sequence. A plain `dragTo()` doesn't reliably clear dnd-kit's
 * `PointerSensor` activation-distance threshold (8px) or give it enough
 * intermediate `pointermove` events to register the drag, so this steps
 * the mouse in several small increments instead of jumping straight to
 * the destination. */
export async function dragAndDrop(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('dragAndDrop: source or target has no bounding box')
  }

  const startX = sourceBox.x + sourceBox.width / 2
  const startY = sourceBox.y + sourceBox.height / 2
  const endX = targetBox.x + targetBox.width / 2
  const endY = targetBox.y + targetBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Clear the PointerSensor's activation-distance constraint first.
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 })
  await page.waitForTimeout(50)

  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await page.mouse.move(x, y, { steps: 2 })
  }
  await page.waitForTimeout(100)
  await page.mouse.up()
}

/** Locates a kanban column (`BoardList`) by its title. Scoped by the pair
 * of Tailwind classes unique to a list column's root div (`bg-gray-100
 * p-3` — the collapsed "+ Add another list" trigger uses `bg-gray-100/60`
 * and the *open* add-list form is a `<form>`, not a `<div>`, so neither
 * collides with this selector). No test ids exist in the app yet — see
 * e2e/README.md. */
export function listColumn(page: Page, title: string): Locator {
  return page.locator('div.bg-gray-100.p-3', { hasText: title })
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export { env }
