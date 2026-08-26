import type { ComponentType, ReactNode } from 'react'
import type * as TanstackReactRouter from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/lib/auth-context'

vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackReactRouter>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

const { Route } = await import('./forgot-password')
const ForgotPasswordPage = Route.options.component as ComponentType

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn(),
    ...overrides,
  })
}

describe('ForgotPasswordPage', () => {
  it('renders the email field and a link back to login', () => {
    mockAuth()
    render(<ForgotPasswordPage />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to log in' }),
    ).toHaveAttribute('href', '/login')
  })

  it('validates the email before calling resetPasswordForEmail', async () => {
    const resetPasswordForEmail = vi.fn()
    mockAuth({ resetPasswordForEmail })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('shows a confirmation screen after a successful request', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ resetPasswordForEmail })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(resetPasswordForEmail).toHaveBeenCalledWith('person@example.com')
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(
      screen.getByText(
        "If an account exists for person@example.com, we've sent a password reset link.",
      ),
    ).toBeInTheDocument()
  })

  it('shows an error banner when the request fails', async () => {
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: { message: 'Too many requests' } })
    mockAuth({ resetPasswordForEmail })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests',
    )
  })
})
