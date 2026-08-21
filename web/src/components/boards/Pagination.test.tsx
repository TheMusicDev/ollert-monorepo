import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { render, screen } from '@/test/test-utils'

import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination
        meta={{ page: 1, limit: 12, total: 3, totalPages: 1 }}
        onPageChange={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the current page and disables edges', () => {
    render(
      <Pagination
        meta={{ page: 1, limit: 12, total: 30, totalPages: 3 }}
        onPageChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('calls onPageChange with the next/previous page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination
        meta={{ page: 2, limit: 12, total: 30, totalPages: 3 }}
        onPageChange={onPageChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })
})
