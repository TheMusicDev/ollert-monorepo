import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { fireEvent, render, screen } from '@/test/test-utils'

import { BoardList } from './BoardList'
import type { ListEntity } from '@/lib/board-types'

const list: ListEntity = {
  id: 'list-1',
  board_id: 'board-1',
  title: 'To Do',
  position: 1,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-01T00:00:00.000Z',
  cards: [
    {
      id: 'card-2',
      list_id: 'list-1',
      title: 'Second',
      description: null,
      due_date: null,
      position: 2,
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'card-1',
      list_id: 'list-1',
      title: 'First',
      description: null,
      due_date: null,
      position: 1,
      created: '2026-01-01T00:00:00.000Z',
      modified: '2026-01-01T00:00:00.000Z',
    },
  ],
}

function renderList(overrides: Partial<ComponentProps<typeof BoardList>> = {}) {
  const props = {
    list,
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onCreateCard: vi.fn().mockResolvedValue(undefined),
    onOpenCard: vi.fn(),
    ...overrides,
  }
  render(
    <DndContext>
      <BoardList {...props} />
    </DndContext>,
  )
  return props
}

describe('BoardList', () => {
  it('renders cards sorted by position, not array order', () => {
    renderList()
    const cardTitles = screen.getAllByRole('button', { name: /First|Second/ })
    expect(cardTitles.map((el) => el.textContent)).toEqual(['First', 'Second'])
  })

  it('opens a card on click', () => {
    // fireEvent: see BoardCard.test.tsx — the card tile carries dnd-kit
    // sortable listeners that swallow userEvent's simulated pointer
    // sequence under jsdom.
    const onOpenCard = vi.fn()
    renderList({ onOpenCard })

    fireEvent.click(screen.getByText('First'))
    expect(onOpenCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'card-1' }),
    )
  })

  it('renames the list on submit', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(undefined)
    renderList({ onRename })

    await user.click(screen.getByRole('button', { name: 'To Do' }))
    const input = screen.getByDisplayValue('To Do')
    await user.clear(input)
    await user.type(input, 'Doing{Enter}')

    expect(onRename).toHaveBeenCalledWith('Doing')
  })

  it('does not call onRename when the title is unchanged', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    renderList({ onRename })

    await user.click(screen.getByRole('button', { name: 'To Do' }))
    await user.keyboard('{Enter}')

    expect(onRename).not.toHaveBeenCalled()
  })

  describe('delete', () => {
    beforeEach(() => {
      vi.spyOn(window, 'confirm')
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('asks for confirmation before deleting', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const user = userEvent.setup()
      const onDelete = vi.fn()
      renderList({ onDelete })

      await user.click(
        screen.getByRole('button', { name: 'Delete list To Do' }),
      )
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('deletes when confirmed', async () => {
      vi.mocked(window.confirm).mockReturnValue(true)
      const user = userEvent.setup()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      renderList({ onDelete })

      await user.click(
        screen.getByRole('button', { name: 'Delete list To Do' }),
      )
      expect(onDelete).toHaveBeenCalled()
    })
  })

  it('creates a card via the inline form', async () => {
    const user = userEvent.setup()
    const onCreateCard = vi.fn().mockResolvedValue(undefined)
    renderList({ onCreateCard })

    await user.click(screen.getByRole('button', { name: '+ Add a card' }))
    await user.type(screen.getByPlaceholderText('Card title'), 'Third')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(onCreateCard).toHaveBeenCalledWith('Third')
  })
})
