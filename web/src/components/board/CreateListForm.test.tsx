import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { render, screen } from '@/test/test-utils'

import { CreateListForm } from './CreateListForm'

describe('CreateListForm', () => {
  it('opens the form, requires a title, and submits a trimmed title', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateListForm onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ Add another list' }))

    await user.click(screen.getByRole('button', { name: 'Add list' }))
    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()

    await user.type(screen.getByPlaceholderText('List title'), '  Backlog  ')
    await user.click(screen.getByRole('button', { name: 'Add list' }))

    expect(onCreate).toHaveBeenCalledWith('Backlog')
  })

  it('surfaces a quota-exceeded error and keeps the form open', async () => {
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error('List quota exceeded for this board.'))
    render(<CreateListForm onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ Add another list' }))
    await user.type(screen.getByPlaceholderText('List title'), 'Done')
    await user.click(screen.getByRole('button', { name: 'Add list' }))

    expect(
      await screen.findByText('List quota exceeded for this board.'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('List title')).toBeInTheDocument()
  })

  it('cancel closes the form and clears the draft', async () => {
    const user = userEvent.setup()
    render(<CreateListForm onCreate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '+ Add another list' }))
    await user.type(screen.getByPlaceholderText('List title'), 'Draft')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.getByRole('button', { name: '+ Add another list' }),
    ).toBeInTheDocument()
  })
})
