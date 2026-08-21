import type { ReactNode } from 'react'

interface AuthCardProps {
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}

/**
 * Centered card shell for unauthenticated pages (login/signup/password
 * reset/auth callback) — these render outside `AppShell`, so they get their
 * own minimal layout rather than the sidebar/navbar dashboard shell.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-8 shadow-bottom dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
        {footer && (
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
