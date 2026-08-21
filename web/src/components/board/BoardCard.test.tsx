import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'

import { fireEvent, render, screen } from '@/test/test-utils'

import { BoardCard } from './BoardCard'
import type { CardEntity } from '@/lib/board-types'

const card: CardEntity = {
  id: 'card-1',
  list_id: 'list-1',
  title: 'Write the changelog',
  description: null,
  due_date: null,
  position: 1,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-01T00:00:00.000Z',
}

describe('BoardCard', () => {
  it('renders the card title and calls onOpen on click', () => {
    // fireEvent, not userEvent: dnd-kit's sortable listeners intercept the
    // full pointerdown/pointerup sequence userEvent simulates (jsdom lacks
    // real Pointer Events support), so a plain synthetic click is used to
    // exercise the onClick handler in isolation from drag activation.
    const onOpen = vi.fn()
    render(
      <DndContext>
        <BoardCard card={card} onOpen={onOpen} />
      </DndContext>,
    )

    fireEvent.click(screen.getByText('Write the changelog'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('shows a due-date badge only when the card has one', () => {
    const { rerender } = render(
      <DndContext>
        <BoardCard card={card} onOpen={vi.fn()} />
      </DndContext>,
    )
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument()

    rerender(
      <DndContext>
        <BoardCard
          card={{ ...card, due_date: '2026-09-01' }}
          onOpen={vi.fn()}
        />
      </DndContext>,
    )
    expect(screen.getByText('Due 2026-09-01')).toBeInTheDocument()
  })

  it('opens via the keyboard (Enter)', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(
      <DndContext>
        <BoardCard card={card} onOpen={onOpen} />
      </DndContext>,
    )

    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
