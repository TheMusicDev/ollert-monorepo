import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { loadTestUsersResult } from '../setup/test-users'
import type { TestUsers } from '../setup/test-users'
import {
  createBoardViaUi,
  createOrgViaUi,
  dragAndDrop,
  expectBoardQuotaExceeded,
  expectOrgQuotaExceeded,
  gotoOrg,
  listColumn,
  login,
  uniqueName,
} from './helpers'

/**
 * The full happy-path journey, run as one ordered story against a single
 * shared page/session rather than isolated tests — required by the app's
 * own data model: `max_orgs` defaults to 1 (planning/data-model.md#quotas),
 * so the owner test user can only ever have *one* org for the whole run,
 * and every later step (boards, kanban, members) has to happen inside it.
 */
test.describe.serial('Ollert end-to-end journey', () => {
  const usersResult = loadTestUsersResult()
  const users: TestUsers = usersResult.ok
    ? usersResult.users
    : {
        owner: { email: '', password: '', id: '' },
        member: { email: '', password: '', id: '' },
        createdViaAdmin: false,
      }

  test.beforeEach(async () => {
    test.skip(!usersResult.ok, !usersResult.ok ? usersResult.reason : '')
  })

  const orgName = uniqueName('E2E Org')
  const firstBoardName = uniqueName('E2E Board')
  const listA = 'To Do'
  const listB = 'Done'
  const cardTitle = 'Design homepage'
  const cardTitleEdited = 'Design homepage v2'

  let page: Page
  let orgId: string
  let firstBoardId: string

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    await page.close()
  })

  test('owner logs in', async () => {
    await login(page, users.owner.email, users.owner.password)
  })

  test('owner creates an organization', async () => {
    orgId = await createOrgViaUi(page, orgName)
    await expect(page.getByText(orgName)).toBeVisible()
  })

  test('creating a second organization hits the max_orgs quota', async () => {
    // max_orgs defaults to 1 (planning/data-model.md#quotas) — the org
    // created above already used this user's only slot.
    await expectOrgQuotaExceeded(page, uniqueName('Should Fail Org'))
  })

  test('owner views the organization detail page', async () => {
    // No in-app link from the org list to its detail page yet (see
    // helpers.ts `gotoOrg`) — navigate directly.
    await gotoOrg(page, orgId)
    await expect(page.getByRole('heading', { name: orgName })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Manage members' }),
    ).toBeVisible()
  })

  test('owner creates a board', async () => {
    firstBoardId = await createBoardViaUi(page, firstBoardName)
    await expect(page.getByRole('link', { name: firstBoardName })).toBeVisible()
  })

  test('creating boards up to the quota then hitting it', async () => {
    // max_boards_per_org defaults to 3 — one more board fills it, and a
    // fourth should be rejected.
    await createBoardViaUi(page, uniqueName('E2E Board 2'))
    await createBoardViaUi(page, uniqueName('E2E Board 3'))
    await expectBoardQuotaExceeded(page, uniqueName('Should Fail Board'))
  })

  test('owner opens the board detail kanban view', async () => {
    await page.getByRole('link', { name: firstBoardName }).click()
    await page.waitForURL(`**/boards/${firstBoardId}`)
    await expect(
      page.getByRole('heading', { name: firstBoardName }),
    ).toBeVisible()
  })

  test('owner creates a list', async () => {
    await page.getByRole('button', { name: '+ Add another list' }).click()
    await page.getByPlaceholder('List title').fill(listA)
    await page.getByRole('button', { name: 'Add list' }).click()
    await expect(
      page.getByRole('button', { name: listA, exact: true }),
    ).toBeVisible()
  })

  test('owner creates a card', async () => {
    const column = listColumn(page, listA)
    await column.getByRole('button', { name: '+ Add a card' }).click()
    await column.getByPlaceholder('Card title').fill(cardTitle)
    await column.getByRole('button', { name: 'Add card' }).click()
    await expect(
      column.getByRole('button', { name: cardTitle, exact: true }),
    ).toBeVisible()
  })

  test('owner edits the card', async () => {
    const column = listColumn(page, listA)
    await column.getByRole('button', { name: cardTitle, exact: true }).click()

    await expect(
      page.getByRole('heading', { name: 'Card details' }),
    ).toBeVisible()
    await page.getByLabel('Title').fill(cardTitleEdited)
    await page
      .getByLabel('Description')
      .fill('Wireframe the landing page layout.')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(
      page.getByRole('heading', { name: 'Card details' }),
    ).toBeHidden()
    await expect(
      column.getByRole('button', { name: cardTitleEdited, exact: true }),
    ).toBeVisible()
  })

  test('owner creates a second list and drags the card into it', async () => {
    await page.getByRole('button', { name: '+ Add another list' }).click()
    await page.getByPlaceholder('List title').fill(listB)
    await page.getByRole('button', { name: 'Add list' }).click()
    await expect(
      page.getByRole('button', { name: listB, exact: true }),
    ).toBeVisible()

    const source = listColumn(page, listA).getByRole('button', {
      name: cardTitleEdited,
      exact: true,
    })
    const target = listColumn(page, listB)

    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === 'PATCH' &&
          /\/cards\/[^/]+$/.test(res.url()),
      ),
      dragAndDrop(page, source, target),
    ])

    await expect(
      listColumn(page, listB).getByRole('button', {
        name: cardTitleEdited,
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      listColumn(page, listA).getByRole('button', {
        name: cardTitleEdited,
        exact: true,
      }),
    ).toHaveCount(0)
  })

  test('owner adds a member by email', async () => {
    await page.goto(`/orgs/${orgId}/members`)
    await expect(
      page.getByRole('heading', { name: `Members of ${orgName}` }),
    ).toBeVisible()

    await page.getByLabel('Email address').fill(users.member.email)
    await page.getByRole('button', { name: 'Add member' }).click()

    await expect(page.getByText(users.member.email)).toBeVisible()
  })

  test('owner removes the member', async () => {
    const row = page.getByRole('row', {
      name: new RegExp(users.member.email.replace(/[.+]/g, '\\$&')),
    })
    await row.getByRole('button', { name: 'Remove' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading', { name: 'Remove member?' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove' }).click()

    await expect(page.getByText(users.member.email)).toBeHidden()
  })
})
