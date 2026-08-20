import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'

import { PaginationControls } from './PaginationControls'

describe('PaginationControls', () => {
  it('renders the current page and total', () => {
    render(<PaginationControls page={2} totalPages={5} onChange={() => {}} />)

    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('disables Previous on the first page and Next on the last page', () => {
    const { rerender } = render(
      <PaginationControls page={1} totalPages={3} onChange={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    rerender(<PaginationControls page={3} totalPages={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('calls onChange with the next/previous page', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PaginationControls page={2} totalPages={3} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Previous' }))

    expect(onChange).toHaveBeenCalledWith(3)
    expect(onChange).toHaveBeenCalledWith(1)
  })
})
