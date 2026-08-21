import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'
import type { Organization } from '@/lib/orgs-api'

import { OrgTable } from './OrgTable'

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: '1',
    name: 'Acme',
    owner_id: 'owner-1',
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('OrgTable', () => {
  it('renders a row per org', () => {
    render(
      <OrgTable
        orgs={[
          makeOrg({ id: '1', name: 'Acme' }),
          makeOrg({ id: '2', name: 'Globex' }),
        ]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
  })

  it('shows an Owner badge and Delete action when is_owner is true', () => {
    render(
      <OrgTable
        orgs={[makeOrg({ is_owner: true })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('hides the Delete action when is_owner is explicitly false', () => {
    render(
      <OrgTable
        orgs={[makeOrg({ is_owner: false })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('shows the Delete action when is_owner is unknown (undefined)', () => {
    render(
      <OrgTable
        orgs={[makeOrg({ is_owner: undefined })]}
        onRename={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('fires onRename/onDelete with the clicked org', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    const org = makeOrg({ is_owner: true })
    render(<OrgTable orgs={[org]} onRename={onRename} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onRename).toHaveBeenCalledWith(org)
    expect(onDelete).toHaveBeenCalledWith(org)
  })
})
