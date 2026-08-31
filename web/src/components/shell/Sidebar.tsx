import { useEffect, useState } from 'react'

import { Menu } from '@base-ui-components/react/menu'
import { Link, useNavigate, useParams } from '@tanstack/react-router'

import type { Organization } from '@/lib/orgs-api'
import { listOrgs } from '@/lib/orgs-api'
import { useOrgsInvalidation } from '@/lib/orgs-context'

const menuPopupClassName =
  'min-w-56 rounded-md border border-gray-200 bg-white p-1 text-sm shadow-bottom outline-none dark:border-gray-700 dark:bg-gray-800'
const menuItemClassName =
  'cursor-pointer truncate rounded px-2 py-1.5 text-gray-700 outline-none data-[highlighted]:bg-gray-100 dark:text-gray-200 dark:data-[highlighted]:bg-gray-700'

/**
 * Fixed left sidebar: org switcher at top, nav links below.
 * See planning/design.md#layout-pattern.
 */
export function Sidebar() {
  const { orgId } = useParams({ strict: false })
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const { orgsVersion } = useOrgsInvalidation()

  useEffect(() => {
    // Sidebar switcher just needs "the orgs a user is likely to jump
    // between" — full pagination lives on /orgs, linked below for anything
    // beyond this first page. Re-fetches whenever orgsVersion is bumped
    // (create/rename/delete elsewhere) so this doesn't go stale.
    listOrgs(1, 50)
      .then((response) => setOrgs(response.data))
      .catch(() => setOrgs([]))
  }, [orgsVersion])

  const currentOrg = orgs.find((org) => org.id === orgId)

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <div className="flex h-16 items-center border-b border-gray-200 px-4 dark:border-gray-700">
        <Menu.Root>
          <Menu.Trigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="truncate">
              {currentOrg?.name ?? 'Select organization'}
            </span>
            <span aria-hidden="true">⌄</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="start" className="z-50">
              <Menu.Popup className={menuPopupClassName}>
                {orgs.length === 0 && (
                  <div className="px-2 py-1.5 text-gray-500 dark:text-gray-400">
                    No organizations yet
                  </div>
                )}
                {orgs.map((org) => (
                  <Menu.Item
                    key={org.id}
                    className={menuItemClassName}
                    onClick={() =>
                      void navigate({
                        to: '/orgs/$orgId',
                        params: { orgId: org.id },
                      })
                    }
                  >
                    {org.name}
                  </Menu.Item>
                ))}
                <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                <Menu.Item
                  className={menuItemClassName}
                  onClick={() => void navigate({ to: '/orgs' })}
                >
                  All organizations
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4 text-sm">
        <Link
          to="/orgs"
          className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 [&.active]:bg-gray-100 [&.active]:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:[&.active]:bg-gray-800 dark:[&.active]:text-white"
        >
          Boards
        </Link>
        {/* Shown unconditionally — no "am I admin" endpoint exists, so a
            non-admin who clicks through just sees the 403 state on the page
            itself rather than the nav deciding visibility up front. */}
        <Link
          to="/admin"
          className="block rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 [&.active]:bg-gray-100 [&.active]:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white dark:[&.active]:bg-gray-800 dark:[&.active]:text-white"
        >
          Admin
        </Link>
      </nav>
    </aside>
  )
}
