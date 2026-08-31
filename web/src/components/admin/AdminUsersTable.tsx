import type { AdminUser } from '@/lib/admin-api'

interface AdminUsersTableProps {
  users: AdminUser[]
  onEdit: (user: AdminUser) => void
}

/** Table list view for admin-visible users. See planning/api-contract.md#admin. */
export function AdminUsersTable({ users, onEdit }: AdminUsersTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-bottom dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Orgs
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Boards/org
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Lists/board
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Cards/board
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Admin
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.email}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {user.max_orgs}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {user.max_boards_per_org}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {user.max_lists_per_board}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {user.max_cards_per_board}
              </td>
              <td className="px-4 py-3 text-sm">
                {user.is_admin && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Admin
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEdit(user)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
