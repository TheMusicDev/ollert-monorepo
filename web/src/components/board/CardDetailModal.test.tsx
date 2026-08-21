import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { render, screen } from '@/test/test-utils'

import { CardDetailModal } from './CardDetailModal'
import type { CardEntity } from '@/lib/board-types'

const card: CardEntity = {
  id: 'card-1',
  list_id: 'list-1',
  title: 'Fix the bug',
  description: 'It is broken',
  due_date: '2026-09-01',
  position: 1,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-01T00:00:00.000Z',
}

describe('CardDetailModal', () => {
  it('renders nothing when there is no selected card', () => {
    const { container } = render(
      <CardDetailModal
        card={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('pre-fills the form from the card and saves trimmed/nulled updates', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <CardDetailModal
        card={card}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('Fix the bug')).toBeInTheDocument()
    expect(screen.getByDisplayValue('It is broken')).toBeInTheDocument()

    const descriptionField = screen.getByLabelText('Description')
    await user.clear(descriptionField)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({
      title: 'Fix the bug',
      description: null,
      due_date: '2026-09-01',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('blocks save with an empty title', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CardDetailModal
        card={card}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    )

    const titleField = screen.getByLabelText('Title')
    await user.clear(titleField)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  describe('delete', () => {
    beforeEach(() => {
      vi.spyOn(window, 'confirm')
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('does nothing when the confirm dialog is dismissed', async () => {
      vi.mocked(window.confirm).mockReturnValue(false)
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(
        <CardDetailModal
          card={card}
          onClose={vi.fn()}
          onSave={vi.fn()}
          onDelete={onDelete}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('deletes and closes when confirmed', async () => {
      vi.mocked(window.confirm).mockReturnValue(true)
      const user = userEvent.setup()
      const onDelete = vi.fn().mockResolvedValue(undefined)
      const onClose = vi.fn()
      render(
        <CardDetailModal
          card={card}
          onClose={onClose}
          onSave={vi.fn()}
          onDelete={onDelete}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Delete' }))
      expect(onDelete).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
