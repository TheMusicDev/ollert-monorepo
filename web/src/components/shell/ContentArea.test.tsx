import { describe, expect, it } from 'vitest'

import { render, screen } from '@/test/test-utils'

import { ContentArea } from './ContentArea'

describe('ContentArea', () => {
  it('renders its children', () => {
    render(
      <ContentArea>
        <p>page content</p>
      </ContentArea>,
    )

    expect(screen.getByText('page content')).toBeInTheDocument()
  })
})
