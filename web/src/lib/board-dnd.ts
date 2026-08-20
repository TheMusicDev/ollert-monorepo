import type { CardEntity, ListEntity } from './board-types'
import { insertItemAt, moveItem, removeItem } from './positioning'

export interface CardMoveResult {
  lists: ListEntity[]
  /** The moved card's freshly computed position — needed to PATCH it. */
  position: number
}

/**
 * Pure reducer for a card drag-drop move: relocates `card` to `targetIndex`
 * within the list `destListId` (same list as `card.list_id` = a reorder,
 * different list = a cross-list move), computing its new fractional
 * `position` from its new neighbors per
 * planning/data-model.md#ordering-drag-drop. Returns `null` if the source
 * or destination list can't be found in `lists`.
 */
export function moveCard(
  lists: ListEntity[],
  card: CardEntity,
  destListId: string,
  targetIndex: number,
): CardMoveResult | null {
  const sourceListIndex = lists.findIndex((list) => list.id === card.list_id)
  const destListIndex = lists.findIndex((list) => list.id === destListId)
  if (sourceListIndex === -1 || destListIndex === -1) return null

  const destCards = lists[destListIndex].cards

  if (sourceListIndex === destListIndex) {
    const reordered = moveItem(destCards, card.id, targetIndex)
    const position = reordered.find((c) => c.id === card.id)!.position
    return {
      lists: lists.map((list, i) =>
        i === destListIndex ? { ...list, cards: reordered } : list,
      ),
      position,
    }
  }

  const sourceCards = removeItem(lists[sourceListIndex].cards, card.id)
  const { items: newDestCards, position } = insertItemAt(
    destCards,
    { ...card, list_id: destListId },
    targetIndex,
  )
  return {
    lists: lists.map((list, i) => {
      if (i === sourceListIndex) return { ...list, cards: sourceCards }
      if (i === destListIndex) return { ...list, cards: newDestCards }
      return list
    }),
    position,
  }
}

export interface ListMoveResult {
  lists: ListEntity[]
  /** The moved list's freshly computed position — needed to PATCH it. */
  position: number
}

/**
 * Pure reducer for a list drag-drop reorder: moves the list `activeId` to
 * sit where `destId` currently sits. Returns `null` if either id isn't
 * found in `lists`.
 */
export function moveList(
  lists: ListEntity[],
  activeId: string,
  destId: string,
): ListMoveResult | null {
  const oldIndex = lists.findIndex((list) => list.id === activeId)
  const newIndex = lists.findIndex((list) => list.id === destId)
  if (oldIndex === -1 || newIndex === -1) return null

  const next = moveItem(lists, activeId, newIndex)
  const position = next.find((list) => list.id === activeId)!.position
  return { lists: next, position }
}
