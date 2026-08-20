import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

import {
  createCard,
  createList,
  deleteCard,
  deleteList,
  fetchBoardDetail,
  updateCard,
  updateList,
} from '@/lib/board-api'
import { moveCard, moveList, revertListPosition } from '@/lib/board-dnd'
import type { BoardDetail, CardEntity, ListEntity } from '@/lib/board-types'
import { positionForIndex, sortByPosition } from '@/lib/positioning'

import { BoardList } from '@/components/board/BoardList'
import { CardDetailModal } from '@/components/board/CardDetailModal'
import { CreateListForm } from '@/components/board/CreateListForm'

export const Route = createFileRoute('/_authenticated/boards/$boardId')({
  component: BoardDetailPage,
})

/** The `data` payload attached to every draggable/droppable node in the
 * board's `DndContext`, used to resolve drag-end moves without parsing
 * dnd-kit's raw string ids. */
type DndData =
  { type: 'list'; listId: string } | { type: 'card'; card: CardEntity }

function BoardDetailPage() {
  const { boardId } = Route.useParams()

  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [lists, setLists] = useState<ListEntity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CardEntity | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    fetchBoardDetail(boardId)
      .then((detail) => {
        if (cancelled) return
        setBoard(detail)
        // The API doesn't guarantee nested-array order for either lists or
        // their cards (see lib/positioning.ts) — sort both up front so the
        // `lists` state respects position order. moveCard/moveList (and the
        // position math they build on) assume that invariant already holds
        // going in.
        setLists(
          sortByPosition(detail.lists).map((list) => ({
            ...list,
            cards: sortByPosition(list.cards),
          })),
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error ? err.message : 'Could not load this board.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [boardId])

  async function handleCreateList(title: string) {
    const position = positionForIndex(
      lists.map((list) => list.position),
      lists.length,
    )
    const created = await createList(boardId, { title, position })
    setLists((current) => [...current, { ...created, cards: [] }])
  }

  async function handleRenameList(listId: string, title: string) {
    const updated = await updateList(listId, { title })
    setLists((current) =>
      current.map((list) =>
        list.id === listId ? { ...list, title: updated.title } : list,
      ),
    )
  }

  async function handleDeleteList(listId: string) {
    try {
      await deleteList(listId)
      setLists((current) => current.filter((list) => list.id !== listId))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete list.',
      )
    }
  }

  async function handleCreateCard(listId: string, title: string) {
    const list = lists.find((l) => l.id === listId)
    const position = positionForIndex(
      (list?.cards ?? []).map((card) => card.position),
      list?.cards.length ?? 0,
    )
    const created = await createCard(listId, { title, position })
    setLists((current) =>
      current.map((l) =>
        l.id === listId ? { ...l, cards: [...l.cards, created] } : l,
      ),
    )
  }

  async function handleDeleteCard(cardId: string) {
    await deleteCard(cardId)
    setLists((current) =>
      current.map((list) => ({
        ...list,
        cards: list.cards.filter((card) => card.id !== cardId),
      })),
    )
  }

  async function handleSaveCard(
    cardId: string,
    updates: {
      title: string
      description: string | null
      due_date: string | null
    },
  ) {
    const updated = await updateCard(cardId, updates)
    setLists((current) =>
      current.map((list) => ({
        ...list,
        cards: list.cards.map((card) => (card.id === cardId ? updated : card)),
      })),
    )
  }

  function handleListReorder(activeListId: string, destListId: string) {
    if (activeListId === destListId) return
    const activeList = lists.find((list) => list.id === activeListId)
    if (!activeList) return
    const originalPosition = activeList.position

    setLists((current) => {
      const result = moveList(current, activeListId, destListId)
      if (!result) return current

      updateList(activeListId, { position: result.position }).catch(() => {
        // Revert just this list's position rather than restoring a
        // pre-move snapshot, so a second reorder that committed while this
        // request was pending isn't discarded.
        setLists((latest) =>
          revertListPosition(latest, activeListId, originalPosition),
        )
        setActionError('Could not reorder list. Please try again.')
      })

      return result.lists
    })
  }

  function handleCardMove(card: CardEntity, overData: DndData | undefined) {
    if (!overData) return
    if (overData.type === 'card' && overData.card.id === card.id) return

    const destListId =
      overData.type === 'list' ? overData.listId : overData.card.list_id

    let previous: ListEntity[] = []
    setLists((current) => {
      previous = current
      const destList = current.find((list) => list.id === destListId)
      if (!destList) return current

      const foundIndex =
        overData.type === 'card'
          ? destList.cards.findIndex((c) => c.id === overData.card.id)
          : destList.cards.length
      const targetIndex = foundIndex === -1 ? destList.cards.length : foundIndex

      const result = moveCard(current, card, destListId, targetIndex)
      if (!result) return current

      const patch: { position: number; list_id?: string } = {
        position: result.position,
      }
      if (destListId !== card.list_id) patch.list_id = destListId

      updateCard(card.id, patch).catch(() => {
        setLists(previous)
        setActionError('Could not move card. Please try again.')
      })

      return result.lists
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current as DndData | undefined
    const overData = over.data.current as DndData | undefined
    if (!activeData) return

    if (activeData.type === 'list') {
      const destListId =
        overData?.type === 'list'
          ? overData.listId
          : overData?.type === 'card'
            ? overData.card.list_id
            : undefined
      if (destListId) handleListReorder(activeData.listId, destListId)
    } else {
      handleCardMove(activeData.card, overData)
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading board…</p>
    )
  }

  if (loadError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
  }

  if (!board) return null

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {board.title}
      </h1>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {lists.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This board has no lists yet — add one to get started.
            </p>
          ) : (
            <SortableContext
              items={lists.map((list) => list.id)}
              strategy={horizontalListSortingStrategy}
            >
              {lists.map((list) => (
                <BoardList
                  key={list.id}
                  list={list}
                  onRename={(title) => handleRenameList(list.id, title)}
                  onDelete={() => handleDeleteList(list.id)}
                  onCreateCard={(title) => handleCreateCard(list.id, title)}
                  onOpenCard={setSelectedCard}
                />
              ))}
            </SortableContext>
          )}

          <CreateListForm onCreate={handleCreateList} />
        </div>
      </DndContext>

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onSave={(updates) => {
          if (!selectedCard) return Promise.resolve()
          return handleSaveCard(selectedCard.id, updates)
        }}
        onDelete={() => {
          if (!selectedCard) return Promise.resolve()
          return handleDeleteCard(selectedCard.id)
        }}
      />
    </div>
  )
}
