import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import * as orgMembers from '@/lib/org-members'
import type * as OrgMembersModule from '@/lib/org-members'

import { OrgMembersPage } from './OrgMembersPage'

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    session: null,
    user: { email: 'owner@example.com' },
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/lib/org-members', async (importOriginal) => {
  const actual = await importOriginal<typeof OrgMembersModule>()
  return {
    ...actual,
    fetchOrg: vi.fn(),
    fetchOrgMembers: vi.fn(),
    addOrgMemberByEmail: vi.fn(),
    removeOrgMember: vi.fn(),
  }
})

const org = { id: 'org-1', ownerId: 'u-owner', name: 'Acme' }
const ownerRow = {
  id: 'm1',
  userId: 'u-owner',
  email: 'owner@example.com',
  displayName: 'Owner',
  created: '2026-01-01',
}
const page1 = {
  data: [ownerRow],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

beforeEach(() => {
  vi.mocked(orgMembers.fetchOrg).mockReset().mockResolvedValue(org)
  vi.mocked(orgMembers.fetchOrgMembers).mockReset().mockResolvedValue(page1)
  vi.mocked(orgMembers.addOrgMemberByEmail).mockReset()
  vi.mocked(orgMembers.removeOrgMember).mockReset()
})

describe('OrgMembersPage', () => {
  it('loads the org and members, and renders the heading + table', async () => {
    render(<OrgMembersPage orgId="org-1" />)

    expect(await screen.findByText('Members of Acme')).toBeInTheDocument()
    expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
    expect(orgMembers.fetchOrgMembers).toHaveBeenCalledWith('org-1', 1)
  })

  it('surfaces an org load error', async () => {
    vi.mocked(orgMembers.fetchOrg).mockRejectedValue(new Error('boom'))
    render(<OrgMembersPage orgId="org-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /failed to load organization/i,
    )
  })

  it('shows an owner-only Remove button for the other member once loaded', async () => {
    vi.mocked(orgMembers.fetchOrgMembers).mockResolvedValue({
      data: [
        ownerRow,
        {
          id: 'm2',
          userId: 'u-member',
          email: 'member@example.com',
          displayName: null,
          created: '2026-01-02',
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    })
    render(<OrgMembersPage orgId="org-1" />)

    await screen.findByText('member@example.com')
    // Owner can remove both themself and the other member.
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(2)
  })

  it('reloads the member list after adding a member', async () => {
    vi.mocked(orgMembers.addOrgMemberByEmail).mockResolvedValue({
      id: 'm2',
      userId: 'u-new',
      email: 'new@example.com',
      displayName: null,
      created: '2026-01-03',
    })
    render(<OrgMembersPage orgId="org-1" />)

    await screen.findByText('owner@example.com')
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'new@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(orgMembers.addOrgMemberByEmail).toHaveBeenCalledWith(
      'org-1',
      'new@example.com',
    )
    await waitFor(() =>
      expect(orgMembers.fetchOrgMembers).toHaveBeenCalledTimes(2),
    )
  })
})
