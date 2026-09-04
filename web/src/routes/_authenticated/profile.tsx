import { createFileRoute } from '@tanstack/react-router'

import { useAuth } from '@/lib/auth-context'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Profile
      </h1>
      <dl className="max-w-md rounded-md border border-gray-200 p-4 text-sm dark:border-gray-700">
        <dt className="font-medium text-gray-500 dark:text-gray-400">
          Email
        </dt>
        <dd className="mt-1 text-gray-900 dark:text-gray-100">
          {user?.email ?? '—'}
        </dd>
      </dl>

      <section className="max-w-md space-y-3 rounded-md border border-gray-200 p-4 text-sm dark:border-gray-700">
        <h2 className="font-medium text-gray-900 dark:text-gray-100">
          Connect Ollert to Claude
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Ollert has an MCP server so Claude can manage your orgs, boards,
          lists, and cards on your behalf.
        </p>
        <dl className="space-y-1">
          <dt className="text-gray-500 dark:text-gray-400">
            Server URL
          </dt>
          <dd>
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
              https://ollert-mcp.2719.fyi/mcp
            </code>
          </dd>
        </dl>
        <div className="space-y-2 text-gray-600 dark:text-gray-400">
          <p>
            <strong className="text-gray-900 dark:text-gray-100">
              claude.ai / Claude Desktop:
            </strong>{' '}
            Settings → Connectors → Add custom connector, paste the server
            URL above.
          </p>
          <p>
            <strong className="text-gray-900 dark:text-gray-100">
              Claude Code:
            </strong>{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">
              claude mcp add --transport http ollert
              https://ollert-mcp.2719.fyi/mcp
            </code>
          </p>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          New client OAuth registration is admin-only — ask the Ollert admin
          for a <code>client_id</code> to enter under &ldquo;Advanced
          settings&rdquo; / <code>--client-id</code> before connecting.
        </p>
      </section>
    </div>
  )
}
