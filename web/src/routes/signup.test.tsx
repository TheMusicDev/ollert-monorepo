import type { ComponentType, ReactNode } from 'react'
import type * as TanstackReactRouter from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/lib/auth-context'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanstackReactRouter>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
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

const { Route } = await import('./signup')
const SignupPage = Route.options.component as ComponentType

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    }),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    ...overrides,
  })
}

describe('SignupPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('renders email/password/confirm fields and a link back to login', () => {
    mockAuth()
    render(<SignupPage />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('validates email format, password length, and matching confirmation', async () => {
    const signUp = vi.fn()
    mockAuth({ signUp })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Password must be at least 6 characters.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('calls signUp with the entered credentials on valid submit', async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { user: null, session: null }, error: null })
    mockAuth({ signUp })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('person@example.com', 'password1'),
    )
  })

  it('shows a "check your email" screen when the project requires confirmation', async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ data: { user: null, session: null }, error: null })
    mockAuth({ signUp })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(
      screen.getByText('We sent a confirmation link to person@example.com.'),
    ).toBeInTheDocument()
  })

  it('shows an error banner when signUp fails', async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })
    mockAuth({ signUp })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1')
    await user.type(screen.getByLabelText('Confirm password'), 'password1')
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User already registered',
    )
  })

  it('navigates to /orgs once a session appears (auto-confirmed project)', () => {
    mockAuth({ session: { user: { id: 'u1' } } as never })
    render(<SignupPage />)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/orgs' })
  })
})
