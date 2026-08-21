import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'

import { EmptyOrgsState } from './EmptyOrgsState'

describe('EmptyOrgsState', () => {
  it('renders the first-org call to action', () => {
    render(<EmptyOrgsState onCreate={() => {}} />)

    expect(
      screen.getByText('Create your first organization'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'New organization' }),
    ).toBeInTheDocument()
  })

  it('calls onCreate when the button is clicked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    render(<EmptyOrgsState onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: 'New organization' }))

    expect(onCreate).toHaveBeenCalledOnce()
  })
})
