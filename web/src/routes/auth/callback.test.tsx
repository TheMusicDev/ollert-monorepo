import type { ComponentType, ReactNode } from 'react'
import type * as TanstackReactRouter from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from '@/lib/auth-context'

const navigateMock = vi.hoisted(() => vi.fn())
// Captures the callback passed to `supabase.auth.onAuthStateChange` so tests
// can simulate PASSWORD_RECOVERY/SIGNED_IN events directly.
const onAuthStateChangeMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: onAuthStateChangeMock } },
}))

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

const { Route } = await import('./callback')
const AuthCallbackPage = Route.options.component as ComponentType

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: null,
    user: null,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  })
}

const unsubscribeMock = vi.fn()

describe('AuthCallbackPage', () => {
  let authEventCallback: ((event: string) => void) | undefined

  beforeEach(() => {
    navigateMock.mockClear()
    unsubscribeMock.mockClear()
    authEventCallback = undefined
    onAuthStateChangeMock.mockReset()
    onAuthStateChangeMock.mockImplementation(
      (callback: (event: string) => void) => {
        authEventCallback = callback
        return { data: { subscription: { unsubscribe: unsubscribeMock } } }
      },
    )
    window.history.pushState({}, '', '/auth/callback')
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a verifying state before any event or error arrives', () => {
    mockAuth()
    render(<AuthCallbackPage />)

    expect(screen.getByText('Verifying…')).toBeInTheDocument()
  })

  it('shows an error state when the redirect carries error_description', () => {
    window.history.pushState(
      {},
      '',
      '/auth/callback?error_description=Link+has+expired',
    )
    mockAuth()
    render(<AuthCallbackPage />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Link has expired')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Request a new reset link' }),
    ).toHaveAttribute('href', '/forgot-password')
  })

  it('shows the "email confirmed" state and redirects on SIGNED_IN', () => {
    vi.useFakeTimers()
    mockAuth()
    render(<AuthCallbackPage />)

    act(() => {
      authEventCallback?.('SIGNED_IN')
    })

    expect(screen.getByText('Email confirmed')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/orgs' })
    vi.useRealTimers()
  })

  it('shows the set-new-password form on PASSWORD_RECOVERY and submits it', async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null })
    mockAuth({ updatePassword })
    render(<AuthCallbackPage />)

    act(() => {
      authEventCallback?.('PASSWORD_RECOVERY')
    })

    expect(screen.getByText('Set a new password')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'newpassword1',
    )
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith('newpassword1'),
    )
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
  })

  it('validates mismatched passwords in the recovery form', async () => {
    const updatePassword = vi.fn()
    mockAuth({ updatePassword })
    render(<AuthCallbackPage />)

    act(() => {
      authEventCallback?.('PASSWORD_RECOVERY')
    })

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('New password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(
      await screen.findByText('Passwords do not match.'),
    ).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })
})
