import type { PaginationMeta } from '@/lib/api-client'

interface PaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
}

/** Prev/next pager for a paginated collection. Renders nothing for a single page. */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm dark:border-gray-700"
    >
      <button
        type="button"
        onClick={() => onPageChange(meta.page - 1)}
        disabled={meta.page <= 1}
        className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Previous
      </button>
      <span className="text-gray-500 dark:text-gray-400">
        Page {meta.page} of {meta.totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(meta.page + 1)}
        disabled={meta.page >= meta.totalPages}
        className="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Next
      </button>
    </nav>
  )
}
