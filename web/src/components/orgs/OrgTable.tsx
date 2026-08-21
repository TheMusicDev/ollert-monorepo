import type { Organization } from '@/lib/orgs-api'

interface OrgTableProps {
  orgs: Organization[]
  onRename: (org: Organization) => void
  onDelete: (org: Organization) => void
}

/** Table list view for orgs, per planning/design.md#layout-pattern. */
export function OrgTable({ orgs, onRename, onDelete }: OrgTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-bottom dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Name
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {orgs.map((org) => (
            <tr key={org.id}>
              <td className="px-4 py-3 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {org.name}
                </span>
                {org.is_owner && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Owner
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onRename(org)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Rename
                </button>
                {org.is_owner !== false && (
                  <button
                    type="button"
                    onClick={() => onDelete(org)}
                    className="ml-3 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
