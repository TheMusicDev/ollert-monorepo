import { Link } from '@tanstack/react-router'

import type { Board } from '@/lib/boards-api'

interface BoardCardProps {
  board: Board
  onRename: (board: Board) => void
  onDelete: (board: Board) => void
}

export function BoardCard({ board, onRename, onDelete }: BoardCardProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-bottom dark:border-gray-700 dark:bg-gray-800">
      <Link
        to="/boards/$boardId"
        params={{ boardId: board.id }}
        className="truncate font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
      >
        {board.title}
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onRename(board)}
          className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => onDelete(board)}
          className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
