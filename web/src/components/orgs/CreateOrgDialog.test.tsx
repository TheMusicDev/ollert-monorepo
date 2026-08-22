import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'
import { ApiError } from '@/lib/api-client'
import { createOrg } from '@/lib/orgs-api'

import { CreateOrgDialog } from './CreateOrgDialog'

vi.mock('@/lib/orgs-api', () => ({
  createOrg: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(createOrg).mockReset()
})

describe('CreateOrgDialog', () => {
  it('renders nothing interactive when closed', () => {
    render(
      <CreateOrgDialog
        open={false}
        onOpenChange={() => {}}
        onCreated={() => {}}
      />,
    )

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('creates an org and reports it back on submit', async () => {
    const user = userEvent.setup()
    const created = {
      id: '1',
      name: 'Acme',
      owner_id: 'u1',
      is_owner: true,
      created: '2026-01-01',
      modified: '2026-01-01',
    }
    vi.mocked(createOrg).mockResolvedValue(created)
    const onCreated = vi.fn()

    render(
      <CreateOrgDialog
        open={true}
        onOpenChange={() => {}}
        onCreated={onCreated}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(createOrg).toHaveBeenCalledWith('Acme')
    expect(onCreated).toHaveBeenCalledWith(created)
  })

  it('shows a required-name error without calling the API', async () => {
    const user = userEvent.setup()
    render(
      <CreateOrgDialog
        open={true}
        onOpenChange={() => {}}
        onCreated={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.')
    expect(createOrg).not.toHaveBeenCalled()
  })

  it('surfaces the 422 quota_exceeded error inline', async () => {
    const user = userEvent.setup()
    vi.mocked(createOrg).mockRejectedValue(
      new ApiError(
        "You've reached your organization limit.",
        'quota_exceeded',
        422,
      ),
    )

    render(
      <CreateOrgDialog
        open={true}
        onOpenChange={() => {}}
        onCreated={() => {}}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You've reached your organization limit.",
    )
  })

  it('surfaces a 422 field validation error inline', async () => {
    const user = userEvent.setup()
    vi.mocked(createOrg).mockRejectedValue(
      new ApiError('Validation failed', 'validation_failed', 422, {
        name: ['Name is too long'],
      }),
    )

    render(
      <CreateOrgDialog
        open={true}
        onOpenChange={() => {}}
        onCreated={() => {}}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name is too long',
    )
  })
})
