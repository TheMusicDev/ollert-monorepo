import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'
import { ApiError } from '@/lib/api-client'
import { deleteOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

import { DeleteOrgDialog } from './DeleteOrgDialog'

vi.mock('@/lib/orgs-api', () => ({
  deleteOrg: vi.fn(),
}))

const org: Organization = {
  id: '1',
  name: 'Acme',
  owner_id: 'u1',
  is_owner: true,
  created: '2026-01-01',
  modified: '2026-01-01',
}

describe('DeleteOrgDialog', () => {
  it('stays closed when org is null', () => {
    render(
      <DeleteOrgDialog
        org={null}
        onOpenChange={() => {}}
        onDeleted={() => {}}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('confirms with the org name and deletes on confirm', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteOrg).mockResolvedValue(undefined)
    const onDeleted = vi.fn()

    render(
      <DeleteOrgDialog
        org={org}
        onOpenChange={() => {}}
        onDeleted={onDeleted}
      />,
    )

    expect(screen.getByText(/Delete “Acme”\?/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteOrg).toHaveBeenCalledWith('1')
    expect(onDeleted).toHaveBeenCalledWith(org)
  })

  it('surfaces a 403 as an owner-only message', async () => {
    const user = userEvent.setup()
    vi.mocked(deleteOrg).mockRejectedValue(
      new ApiError('Forbidden', 'forbidden', 403),
    )

    render(
      <DeleteOrgDialog
        org={org}
        onOpenChange={() => {}}
        onDeleted={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only the owner can delete this organization.',
    )
  })
})
