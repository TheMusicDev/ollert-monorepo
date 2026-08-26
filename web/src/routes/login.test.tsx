import type { ComponentType, ReactNode } from 'react'
import type * as TanstackReactRouter from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/lib/auth-context'

// vi.mock calls are hoisted above these imports by Vitest, so `./login`
// (imported below) sees the mocked auth-context/router from the start.
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

const { Route } = await import('./login')
const LoginPage = Route.options.component as ComponentType

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    ...overrides,
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
  })

  it('renders email/password fields and footer links', () => {
    mockAuth()
    render(<LoginPage />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  it('shows validation errors instead of submitting an empty form', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ signIn })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('calls signIn with the entered credentials on valid submit', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ signIn })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter22')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('person@example.com', 'hunter22'),
    )
  })

  it('shows an error banner when signIn fails', async () => {
    const signIn = vi
      .fn()
      .mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    mockAuth({ signIn })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid login credentials',
    )
  })

  it('navigates to /orgs once a session appears', () => {
    mockAuth({ session: { user: { id: 'u1' } } as never })
    render(<LoginPage />)

    expect(navigateMock).toHaveBeenCalledWith({ to: '/orgs' })
  })
})
