import { Outlet } from '@tanstack/react-router'

import { ContentArea } from './ContentArea'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

/**
 * Global authenticated-app shell: fixed sidebar + navbar wrapping the
 * authenticated route tree. See planning/design.md#layout-pattern.
 */
export function AppShell() {
  return (
    <div className="text-gray-900 dark:text-gray-100">
      <Sidebar />
      <Navbar />
      <ContentArea>
        <Outlet />
      </ContentArea>
    </div>
  )
}
