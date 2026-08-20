import type { ReactNode } from 'react'

/** Content area wrapper, offset for the fixed sidebar + navbar. */
export function ContentArea({ children }: { children: ReactNode }) {
  return (
    <main className="ml-64 min-h-screen bg-gray-50 pt-16 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </main>
  )
}
