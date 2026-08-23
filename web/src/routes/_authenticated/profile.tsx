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
    </div>
  )
}
