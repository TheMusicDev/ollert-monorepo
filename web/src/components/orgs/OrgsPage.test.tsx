import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, screen, within } from '@/test/test-utils'
import { ApiError } from '@/lib/api-client'
import { createOrg, deleteOrg, listOrgs, renameOrg } from '@/lib/orgs-api'
import type { Organization } from '@/lib/orgs-api'

import { OrgsPage } from './OrgsPage'

vi.mock('@/lib/orgs-api', () => ({
  listOrgs: vi.fn(),
  createOrg: vi.fn(),
  renameOrg: vi.fn(),
  deleteOrg: vi.fn(),
}))

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: '1',
    name: 'Acme',
    owner_id: 'u1',
    is_owner: true,
    created: '2026-01-01',
    modified: '2026-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(listOrgs).mockReset()
  vi.mocked(createOrg).mockReset()
  vi.mocked(renameOrg).mockReset()
  vi.mocked(deleteOrg).mockReset()
})

describe('OrgsPage', () => {
  it('shows a loading state, then the empty state for zero orgs', async () => {
    vi.mocked(listOrgs).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })

    render(<OrgsPage />)

    expect(screen.getByText('Loading organizations…')).toBeInTheDocument()

    expect(
      await screen.findByText('Create your first organization'),
    ).toBeInTheDocument()
  })

  it('renders the org list once loaded', async () => {
    vi.mocked(listOrgs).mockResolvedValue({
      data: [
        makeOrg({ id: '1', name: 'Acme' }),
        makeOrg({ id: '2', name: 'Globex' }),
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })

    render(<OrgsPage />)

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
    expect(listOrgs).toHaveBeenCalledWith(1, 20)
  })

  it('shows an inline error with a retry action when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listOrgs)
      .mockRejectedValueOnce(new ApiError('Network down', 'server_error', 500))
      .mockResolvedValueOnce({
        data: [makeOrg()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })

    render(<OrgsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Acme')).toBeInTheDocument()
  })

  it('reloads page 1 after creating an org', async () => {
    const user = userEvent.setup()
    vi.mocked(listOrgs)
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
      .mockResolvedValueOnce({
        data: [makeOrg({ name: 'Fresh Org' })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
    vi.mocked(createOrg).mockResolvedValue(makeOrg({ name: 'Fresh Org' }))

    render(<OrgsPage />)

    await user.click(
      await screen.findByRole('button', { name: 'New organization' }),
    )
    await user.type(screen.getByLabelText('Name'), 'Fresh Org')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Fresh Org')).toBeInTheDocument()
    expect(listOrgs).toHaveBeenCalledTimes(2)
  })

  it('renames an org in place without a full reload', async () => {
    const user = userEvent.setup()
    vi.mocked(listOrgs).mockResolvedValue({
      data: [makeOrg({ name: 'Acme' })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    vi.mocked(renameOrg).mockResolvedValue(makeOrg({ name: 'Acme Corp' }))

    render(<OrgsPage />)

    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Name')
    await user.clear(input)
    await user.type(input, 'Acme Corp')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(listOrgs).toHaveBeenCalledTimes(1)
  })

  it('deletes an org and reloads the list', async () => {
    const user = userEvent.setup()
    vi.mocked(listOrgs)
      .mockResolvedValueOnce({
        data: [makeOrg({ name: 'Acme' })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })
    vi.mocked(deleteOrg).mockResolvedValue(undefined)

    render(<OrgsPage />)

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteOrg).toHaveBeenCalledWith('1')
    expect(
      await screen.findByText('Create your first organization'),
    ).toBeInTheDocument()
  })
})
