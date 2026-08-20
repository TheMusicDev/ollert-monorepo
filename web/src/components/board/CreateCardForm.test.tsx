import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { render, screen } from '@/test/test-utils'

import { CreateCardForm } from './CreateCardForm'

describe('CreateCardForm', () => {
  it('opens the form, requires a title, and submits a trimmed title', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateCardForm onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ Add a card' }))

    await user.click(screen.getByRole('button', { name: 'Add card' }))
    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()

    await user.type(
      screen.getByPlaceholderText('Card title'),
      '  Write tests  ',
    )
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(onCreate).toHaveBeenCalledWith('Write tests')
  })

  it('surfaces a quota-exceeded error and keeps the form open', async () => {
    const user = userEvent.setup()
    const onCreate = vi
      .fn()
      .mockRejectedValue(new Error('Card quota exceeded for this board.'))
    render(<CreateCardForm onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ Add a card' }))
    await user.type(screen.getByPlaceholderText('Card title'), 'One more')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(
      await screen.findByText('Card quota exceeded for this board.'),
    ).toBeInTheDocument()
  })

  it('clears the input after a successful create, staying open for the next card', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<CreateCardForm onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: '+ Add a card' }))
    await user.type(screen.getByPlaceholderText('Card title'), 'First card')
    await user.click(screen.getByRole('button', { name: 'Add card' }))

    expect(screen.getByPlaceholderText('Card title')).toHaveValue('')
  })
})
