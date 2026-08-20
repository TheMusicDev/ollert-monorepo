import { Menu } from '@base-ui-components/react/menu'
import { useNavigate } from '@tanstack/react-router'

import { useAuth } from '@/lib/auth-context'

import { DarkModeToggle } from './DarkModeToggle'

const menuPopupClassName =
  'min-w-40 rounded-md border border-gray-200 bg-white p-1 text-sm shadow-bottom outline-none dark:border-gray-700 dark:bg-gray-800'
const menuItemClassName =
  'cursor-pointer rounded px-2 py-1.5 outline-none data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700'

/**
 * Top navbar: search, notifications, user menu.
 * See planning/design.md#layout-pattern.
 */
export function Navbar() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    void navigate({ to: '/login' })
  }

  return (
    <header className="fixed inset-x-0 top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white pl-72 pr-6 shadow-bottom dark:border-gray-700 dark:bg-gray-900">
      <input
        type="search"
        placeholder="Search…"
        className="w-64 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
      />
      <div className="flex items-center gap-4">
        <DarkModeToggle />
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          🔔
        </button>
        <Menu.Root>
          <Menu.Trigger className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            U
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="end">
              <Menu.Popup className={menuPopupClassName}>
                <Menu.Item className={menuItemClassName}>Profile</Menu.Item>
                <Menu.Item
                  className={menuItemClassName}
                  onClick={handleSignOut}
                >
                  Log out
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  )
}
