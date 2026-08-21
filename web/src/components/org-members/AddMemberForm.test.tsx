import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { render, screen } from '@/test/test-utils'
import { ApiError } from '@/lib/api-client'

import { AddMemberForm } from './AddMemberForm'

describe('AddMemberForm', () => {
  it('rejects an empty submission without calling onAdd', async () => {
    const onAdd = vi.fn()
    render(<AddMemberForm onAdd={onAdd} />)

    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      /enter an email address/i,
    )
  })

  it('rejects a malformed email without calling onAdd', async () => {
    const onAdd = vi.fn()
    render(<AddMemberForm onAdd={onAdd} />)

    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'not-an-email',
    )
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a valid email/i)
  })

  it('submits a valid email and clears the field on success', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<AddMemberForm onAdd={onAdd} />)

    const input = screen.getByLabelText(/email address/i)
    await userEvent.type(input, 'teammate@example.com')
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(onAdd).toHaveBeenCalledWith('teammate@example.com')
    expect(input).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('surfaces a 404 as "no account" inline', async () => {
    const onAdd = vi
      .fn()
      .mockRejectedValue(new ApiError('Not found', 'not_found', 404))
    render(<AddMemberForm onAdd={onAdd} />)

    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'nobody@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no ollert account found/i,
    )
  })

  it('surfaces a 422 field error inline', async () => {
    const onAdd = vi.fn().mockRejectedValue(
      new ApiError('Validation failed', 'validation_failed', 422, {
        email: ['Email is already a member'],
      }),
    )
    render(<AddMemberForm onAdd={onAdd} />)

    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'existing@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /already a member/i,
    )
  })

  it('falls back to a generic message for a non-API error', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('network down'))
    render(<AddMemberForm onAdd={onAdd} />)

    await userEvent.type(
      screen.getByLabelText(/email address/i),
      'teammate@example.com',
    )
    await userEvent.click(screen.getByRole('button', { name: /add member/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /something went wrong/i,
    )
  })
})
