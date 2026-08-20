import { Link } from '@tanstack/react-router'

/**
 * Fixed left sidebar: org switcher at top, nav links below.
 * See planning/design.md#layout-pattern.
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-gray-800 text-gray-100">
      <div className="flex h-16 items-center border-b border-gray-700 px-4">
        {/* Org switcher placeholder — wired up in feat/web-orgs. */}
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-700"
        >
          <span>Select organization</span>
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4 text-sm">
        <Link
          to="/orgs"
          className="block rounded-md px-3 py-2 text-gray-300 hover:bg-gray-700 hover:text-white [&.active]:bg-gray-900 [&.active]:text-white"
        >
          Boards
        </Link>
      </nav>
    </aside>
  )
}
