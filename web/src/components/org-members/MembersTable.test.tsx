import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { render, screen, within } from '@/test/test-utils'
import type { OrgMember } from '@/lib/org-members'

import { MembersTable } from './MembersTable'

const owner: OrgMember = {
  id: 'm1',
  org_id: 'org-1',
  user_id: 'u-owner',
  user: { id: 'u-owner', email: 'owner@example.com', display_name: 'Owner' },
  created: '2026-01-01',
}

const member: OrgMember = {
  id: 'm2',
  org_id: 'org-1',
  user_id: 'u-member',
  user: { id: 'u-member', email: 'member@example.com', display_name: null },
  created: '2026-01-02',
}

const members = [owner, member]
const meta = { page: 1, limit: 20, total: 2, totalPages: 1 }

describe('MembersTable', () => {
  it('shows a loading state', () => {
    render(
      <MembersTable
        members={[]}
        meta={null}
        loading
        error={null}
        currentUserEmail={null}
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByText(/loading members/i)).toBeInTheDocument()
  })

  it('shows an error state', () => {
    render(
      <MembersTable
        members={[]}
        meta={null}
        loading={false}
        error="Failed to load members."
        currentUserEmail={null}
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /failed to load members/i,
    )
  })

  it('shows an empty state', () => {
    render(
      <MembersTable
        members={[]}
        meta={{ page: 1, limit: 20, total: 0, totalPages: 0 }}
        loading={false}
        error={null}
        currentUserEmail={null}
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })

  it('renders member rows and marks the current user', () => {
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail="member@example.com"
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    expect(screen.getByText('member@example.com')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('only shows a Remove button for self when not the owner', () => {
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail="member@example.com"
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(1)
  })

  it('shows Remove for every row when the current user is the owner', () => {
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail="owner@example.com"
        isOwner
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(2)
  })

  it('confirms before calling onRemove, and closes the dialog on success', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail="owner@example.com"
        isOwner
        page={1}
        onPageChange={vi.fn()}
        onRemove={onRemove}
      />,
    )

    await userEvent.click(
      screen.getAllByRole('button', { name: /^remove$/i })[1],
    )
    expect(onRemove).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(/member@example\.com/i)
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^remove$/i }),
    )

    expect(onRemove).toHaveBeenCalledWith(member)
    await screen.findByText('owner@example.com')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('surfaces a remove failure inline in the dialog', async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error('cannot remove'))
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail="owner@example.com"
        isOwner
        page={1}
        onPageChange={vi.fn()}
        onRemove={onRemove}
      />,
    )

    await userEvent.click(
      screen.getAllByRole('button', { name: /^remove$/i })[1],
    )
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^remove$/i }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /cannot remove/i,
    )
  })

  it('disables Previous on the first page and Next on the last', () => {
    render(
      <MembersTable
        members={members}
        meta={meta}
        loading={false}
        error={null}
        currentUserEmail={null}
        isOwner={false}
        page={1}
        onPageChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('calls onPageChange with the next page', async () => {
    const onPageChange = vi.fn()
    render(
      <MembersTable
        members={members}
        meta={{ page: 1, limit: 1, total: 2, totalPages: 2 }}
        loading={false}
        error={null}
        currentUserEmail={null}
        isOwner={false}
        page={1}
        onPageChange={onPageChange}
        onRemove={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
