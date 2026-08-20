import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api-client'
import type { Board, Organization } from '@/lib/boards-api'
import { renderWithRouter } from '@/test/router-test-utils'
import { screen, waitFor, within } from '@/test/test-utils'

import { OrgBoardsPage } from './OrgBoardsPage'

const { getOrg, listBoards, createBoard, renameBoard, deleteBoard } =
  vi.hoisted(() => ({
    getOrg: vi.fn(),
    listBoards: vi.fn(),
    createBoard: vi.fn(),
    renameBoard: vi.fn(),
    deleteBoard: vi.fn(),
  }))

vi.mock('@/lib/boards-api', () => ({
  getOrg,
  listBoards,
  createBoard,
  renameBoard,
  deleteBoard,
}))

const org: Organization = {
  id: 'org-1',
  owner_id: 'owner-1',
  name: 'Acme Inc',
  is_owner: true,
}

const boards: Board[] = [
  { id: 'board-1', org_id: 'org-1', title: 'Sprint board' },
  { id: 'board-2', org_id: 'org-1', title: 'Roadmap' },
]

function emptyPage() {
  return { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } }
}

function boardsPage(data: Board[], page = 1, totalPages = 1) {
  return { data, meta: { page, limit: 12, total: data.length, totalPages } }
}

beforeEach(() => {
  getOrg.mockReset()
  listBoards.mockReset()
  createBoard.mockReset()
  renameBoard.mockReset()
  deleteBoard.mockReset()
})

describe('OrgBoardsPage', () => {
  it('renders the org name, members link, and board list', async () => {
    getOrg.mockResolvedValue(org)
    listBoards.mockResolvedValue(boardsPage(boards))

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)

    expect(await screen.findByText('Sprint board')).toBeInTheDocument()
    expect(screen.getByText('Roadmap')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Acme Inc' }),
    ).toBeInTheDocument()

    const membersLink = screen.getByRole('link', { name: 'Manage members' })
    expect(membersLink).toHaveAttribute('href', '/orgs/org-1/members')

    const boardLink = screen.getByRole('link', { name: 'Sprint board' })
    expect(boardLink).toHaveAttribute('href', '/boards/board-1')
  })

  it('shows an empty state when the org has no boards', async () => {
    getOrg.mockResolvedValue(org)
    listBoards.mockResolvedValue(emptyPage())

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)

    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument()
  })

  it('shows a retry-able error state when the boards request fails', async () => {
    getOrg.mockResolvedValue(org)
    listBoards.mockRejectedValue(
      new ApiError('Network error', 'unknown_error', 500),
    )

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)

    expect(await screen.findByText('Network error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('disables board creation for a non-owner', async () => {
    getOrg.mockResolvedValue({ ...org, is_owner: false })
    listBoards.mockResolvedValue(boardsPage(boards))

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)

    await screen.findByText('Sprint board')
    expect(screen.getByRole('button', { name: 'New board' })).toBeDisabled()
    expect(
      screen.getByText(/only the organization owner can create boards/i),
    ).toBeInTheDocument()
  })

  it('lets an owner create a board and reloads the list', async () => {
    const user = userEvent.setup()
    getOrg.mockResolvedValue(org)
    listBoards
      .mockResolvedValueOnce(boardsPage(boards))
      .mockResolvedValueOnce(
        boardsPage([
          ...boards,
          { id: 'board-3', org_id: 'org-1', title: 'New board' },
        ]),
      )
    createBoard.mockResolvedValue({
      id: 'board-3',
      org_id: 'org-1',
      title: 'New board',
    })

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)
    await screen.findByText('Sprint board')

    await user.click(screen.getByRole('button', { name: 'New board' }))
    await user.type(screen.getByLabelText('Board title'), 'New board')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(createBoard).toHaveBeenCalledWith('org-1', 'New board'),
    )
    expect(
      await screen.findByRole('link', { name: 'New board' }),
    ).toBeInTheDocument()
    expect(listBoards).toHaveBeenCalledTimes(2)
  })

  it('surfaces a quota_exceeded 422 inline without closing the dialog', async () => {
    const user = userEvent.setup()
    getOrg.mockResolvedValue(org)
    listBoards.mockResolvedValue(boardsPage(boards))
    createBoard.mockRejectedValue(
      new ApiError(
        "You've reached your board limit for this organization.",
        'quota_exceeded',
        422,
      ),
    )

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)
    await screen.findByText('Sprint board')

    await user.click(screen.getByRole('button', { name: 'New board' }))
    await user.type(screen.getByLabelText('Board title'), 'One too many')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByText(
        "You've reached your board limit for this organization.",
      ),
    ).toBeInTheDocument()
    // Dialog stayed open — the title field is still present.
    expect(screen.getByLabelText('Board title')).toBeInTheDocument()
  })

  it('lets a member rename a board', async () => {
    const user = userEvent.setup()
    getOrg.mockResolvedValue(org)
    listBoards
      .mockResolvedValueOnce(boardsPage(boards))
      .mockResolvedValueOnce(
        boardsPage([
          { id: 'board-1', org_id: 'org-1', title: 'Renamed' },
          boards[1],
        ]),
      )
    renameBoard.mockResolvedValue({
      id: 'board-1',
      org_id: 'org-1',
      title: 'Renamed',
    })

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)
    await screen.findByText('Sprint board')

    const renameButtons = screen.getAllByRole('button', { name: 'Rename' })
    await user.click(renameButtons[0])

    const input = await screen.findByLabelText('Board title')
    expect(input).toHaveValue('Sprint board')
    await user.clear(input)
    await user.type(input, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(renameBoard).toHaveBeenCalledWith('board-1', 'Renamed'),
    )
    expect(await screen.findByText('Renamed')).toBeInTheDocument()
  })

  it('lets a member delete a board after confirming', async () => {
    const user = userEvent.setup()
    getOrg.mockResolvedValue(org)
    listBoards
      .mockResolvedValueOnce(boardsPage(boards))
      .mockResolvedValueOnce(boardsPage([boards[1]]))
    deleteBoard.mockResolvedValue(undefined)

    renderWithRouter(<OrgBoardsPage orgId="org-1" />)
    await screen.findByText('Sprint board')

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])

    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(/delete “sprint board”/i),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteBoard).toHaveBeenCalledWith('board-1'))
    await waitFor(() =>
      expect(screen.queryByText('Sprint board')).not.toBeInTheDocument(),
    )
  })
})
