import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'
import { renameOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

import { RenameOrgDialog } from './RenameOrgDialog'

vi.mock('@/lib/orgs-api', () => ({
  renameOrg: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(renameOrg).mockReset()
})

const org: Organization = {
  id: '1',
  name: 'Acme',
  owner_id: 'u1',
  is_owner: true,
  created: '2026-01-01',
  modified: '2026-01-01',
}

describe('RenameOrgDialog', () => {
  it('stays closed when org is null', () => {
    render(
      <RenameOrgDialog
        org={null}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('pre-fills the current name', () => {
    render(
      <RenameOrgDialog
        org={org}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    )

    expect(screen.getByLabelText('Name')).toHaveValue('Acme')
  })

  it('renames the org and reports the update back', async () => {
    const user = userEvent.setup()
    const updated = { ...org, name: 'Acme Corp' }
    vi.mocked(renameOrg).mockResolvedValue(updated)
    const onRenamed = vi.fn()

    render(
      <RenameOrgDialog
        org={org}
        onOpenChange={() => {}}
        onRenamed={onRenamed}
      />,
    )

    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'Acme Corp')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(renameOrg).toHaveBeenCalledWith('1', 'Acme Corp')
    expect(onRenamed).toHaveBeenCalledWith(updated)
  })

  it('shows a required-name error without calling the API', async () => {
    const user = userEvent.setup()
    render(
      <RenameOrgDialog
        org={org}
        onOpenChange={() => {}}
        onRenamed={() => {}}
      />,
    )

    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
    expect(renameOrg).not.toHaveBeenCalled()
  })
})
