interface PaginationControlsProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

/** Prev/next pager for a paginated collection. See planning/api-contract.md#pagination. */
export function PaginationControls({
  page,
  totalPages,
  onChange,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md px-3 py-1.5 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-gray-800"
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md px-3 py-1.5 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-gray-800"
      >
        Next
      </button>
    </div>
  )
}
