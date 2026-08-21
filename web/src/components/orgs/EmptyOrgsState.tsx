interface EmptyOrgsStateProps {
  onCreate: () => void
}

/**
 * Zero-orgs state — the expected default for a new user (`max_orgs` is 1),
 * not an edge case. See planning/data-model.md#quotas.
 */
export function EmptyOrgsState({ onCreate }: EmptyOrgsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
      <p className="text-4xl" aria-hidden="true">
        🏢
      </p>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Create your first organization
      </h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Organizations hold your boards and members. Create one to get started.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        New organization
      </button>
    </div>
  )
}
