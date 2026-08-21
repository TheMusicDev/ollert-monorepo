import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { CardEntity } from '@/lib/board-types'

export interface BoardCardProps {
  card: CardEntity
  onOpen: () => void
}

/** A single draggable card tile within a `BoardList` column. */
export function BoardCard({ card, onOpen }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className="cursor-pointer touch-none rounded-md bg-white p-3 text-sm shadow-sm ring-1 ring-gray-200 hover:shadow-bottom dark:bg-gray-700 dark:ring-gray-600"
    >
      <p className="font-medium text-gray-800 dark:text-gray-100">
        {card.title}
      </p>
      {card.due_date && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Due {card.due_date}
        </p>
      )}
    </div>
  )
}
