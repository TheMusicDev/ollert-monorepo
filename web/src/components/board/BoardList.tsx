import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { CardEntity, ListEntity } from '@/lib/board-types'
import { sortByPosition } from '@/lib/positioning'

import { BoardCard } from './BoardCard'
import { CreateCardForm } from './CreateCardForm'

export interface BoardListProps {
  list: ListEntity
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onCreateCard: (title: string) => Promise<void>
  onOpenCard: (card: CardEntity) => void
}

/** A single kanban column: title (rename/delete), its cards (sortable +
 * droppable for cross-list moves), and the add-card affordance. */
export function BoardList({
  list,
  onRename,
  onDelete,
  onCreateCard,
  onOpenCard,
}: BoardListProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(list.title)
  const [renameError, setRenameError] = useState<string | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id, data: { type: 'list', listId: list.id } })

  // Separate droppable over the cards area (not the whole column) so a card
  // can be dropped into an empty list, or past the last card of a
  // non-empty one, without competing with the list's own drag handle.
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `list-drop:${list.id}`,
    data: { type: 'list', listId: list.id },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const cards = sortByPosition(list.cards)

  async function handleRenameSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isEditingTitle) return
    if (!titleDraft.trim()) {
      setRenameError('Title is required.')
      return
    }
    if (titleDraft.trim() === list.title) {
      setIsEditingTitle(false)
      setRenameError(null)
      return
    }
    try {
      await onRename(titleDraft.trim())
      setIsEditingTitle(false)
      setRenameError(null)
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : 'Could not rename list.',
      )
    }
  }

  async function handleDeleteClick() {
    if (!window.confirm(`Delete list "${list.title}" and all its cards?`)) {
      return
    }
    await onDelete()
  }

  return (
    <div
      ref={setSortableRef}
      style={style}
      className="flex w-72 shrink-0 flex-col rounded-lg bg-gray-100 p-3 dark:bg-gray-800"
    >
      <div className="mb-2 flex items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder list ${list.title}`}
          className="cursor-grab touch-none px-0.5 text-gray-400 select-none active:cursor-grabbing dark:text-gray-500"
        >
          ⠿
        </span>

        {isEditingTitle ? (
          <form onSubmit={handleRenameSubmit} className="flex-1">
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={handleRenameSubmit}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleDraft(list.title)
              setIsEditingTitle(true)
            }}
            className="flex-1 truncate rounded-md px-1 py-0.5 text-left text-sm font-semibold text-gray-800 hover:bg-gray-200 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {list.title}
          </button>
        )}

        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={`Delete list ${list.title}`}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          ✕
        </button>
      </div>

      {renameError && (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">
          {renameError}
        </p>
      )}

      <div ref={setDroppableRef} className="min-h-[1px] flex-1 space-y-2">
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              onOpen={() => onOpenCard(card)}
            />
          ))}
        </SortableContext>
      </div>

      <CreateCardForm onCreate={onCreateCard} />
    </div>
  )
}
