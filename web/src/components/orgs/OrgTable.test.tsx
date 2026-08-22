import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { screen } from '@/test/test-utils'
import { renderWithRouter } from '@/test/router-test-utils'
import type { Organization } from '@/lib/orgs-api'

import { OrgTable } from './OrgTable'

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: '1',
    name: 'Acme',
    owner_id: 'owner-1',
    is_owner: true,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('OrgTable', () => {
  it('renders a row per org', async () => {
    renderWithRouter(
      <OrgTable
        orgs={[
          makeOrg({ id: '1', name: 'Acme' }),
          makeOrg({ id: '2', name: 'Globex' }),
        ]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
  })

  it('links each org name to its detail page', async () => {
    renderWithRouter(
      <OrgTable
        orgs={[makeOrg({ id: 'org-42', name: 'Acme' })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(await screen.findByRole('link', { name: 'Acme' })).toHaveAttribute(
      'href',
      '/orgs/org-42',
    )
  })

  it('shows an Owner badge and Delete action when is_owner is true', async () => {
    renderWithRouter(
      <OrgTable
        orgs={[makeOrg({ is_owner: true })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(await screen.findByText('Owner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('hides the Delete action when is_owner is explicitly false', async () => {
    renderWithRouter(
      <OrgTable
        orgs={[makeOrg({ is_owner: false })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    await screen.findByRole('link', { name: 'Acme' })
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('fires onRename/onDelete with the clicked org', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    const org = makeOrg({ is_owner: true })
    renderWithRouter(
      <OrgTable orgs={[org]} onRename={onRename} onDelete={onDelete} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onRename).toHaveBeenCalledWith(org)
    expect(onDelete).toHaveBeenCalledWith(org)
  })
})
