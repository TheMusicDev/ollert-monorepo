import type { CardEntity, ListEntity } from './board-types'
import { insertItemAt, moveItem, removeItem, sortByPosition } from './positioning'

/**
 * Tracks in-flight drag-move PATCH requests keyed by the id of the entity
 * being moved (a list id or a card id), so overlapping moves of the *same*
 * entity can tell whether a rejection is stale — an older request already
 * superseded by a newer one still in flight — and, when it isn't stale,
 * which placement a rollback should land on.
 *
 * That placement is deliberately *not* just "whatever this request read as
 * the starting point": if a second move for the same entity starts before
 * the first one's PATCH has settled, the second request's starting
 * placement is itself only an unconfirmed optimistic guess (the first
 * request's), not something the backend actually has yet. `start` only
 * captures a fresh baseline when no request for this entity is already
 * pending, so the whole chain shares one baseline; `settleSuccess` advances
 * that baseline to a request's result once it's confirmed (but only clears
 * tracking once nothing newer is still pending); `settleFailure` returns
 * the right rollback target — the most recent *confirmed* placement, never
 * an intermediate optimistic one — or `undefined` for a stale rejection
 * that should be ignored entirely.
 */
export class MoveRequestTracker<TPlacement> {
  private requestIds = new Map<string, number>()
  private baselines = new Map<string, TPlacement>()

  /** Registers a new move attempt for `id`, returning its request id (pass
   * this to `settleSuccess`/`settleFailure`) and the baseline placement a
   * rollback should currently target if this request fails. */
  start(
    id: string,
    currentPlacement: TPlacement,
  ): { requestId: number; baseline: TPlacement } {
    if (!this.baselines.has(id)) {
      this.baselines.set(id, currentPlacement)
    }
    const requestId = (this.requestIds.get(id) ?? 0) + 1
    this.requestIds.set(id, requestId)
    return { requestId, baseline: this.baselines.get(id)! }
  }

  /** Call when a move PATCH for `id`/`requestId` succeeds. */
  settleSuccess(id: string, requestId: number, placement: TPlacement): void {
    if (this.requestIds.get(id) === requestId) {
      // Nothing newer is pending for this entity — the chain is done.
      this.requestIds.delete(id)
      this.baselines.delete(id)
    } else if (this.requestIds.has(id)) {
      // A newer request is still in flight; this confirmed placement
      // becomes the new rollback target if that request later fails.
      this.baselines.set(id, placement)
    }
    // Else: this request isn't the latest AND the chain has already closed
    // (e.g. a newer request for this id settled first and cleared
    // tracking). This success arrived late and out of order — it's stale,
    // so it must not resurrect a baseline; doing so would leave a rollback
    // target behind that a later, unrelated move could pick up instead of
    // re-baselining from its own current placement.
  }

  /** Call when a move PATCH for `id`/`requestId` fails. Returns the
   * placement to roll back to, or `undefined` if `requestId` has since been
   * superseded by a newer request for the same `id` (a stale rejection that
   * should be ignored). */
  settleFailure(id: string, requestId: number): TPlacement | undefined {
    if (this.requestIds.get(id) !== requestId) return undefined
    const fallback = this.baselines.get(id)
    this.requestIds.delete(id)
    this.baselines.delete(id)
    return fallback
  }
}

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

/**
 * Reverts a failed list-reorder PATCH: resets `listId`'s `position` back to
 * `originalPosition` and re-sorts `lists` accordingly. Used instead of
 * restoring a pre-move snapshot of the whole `lists` array, which would
 * discard any other reorder that has committed in the meantime (e.g. a
 * second drag that started while this PATCH was still pending) — this only
 * touches the one list whose request actually failed.
 */
export function revertListPosition(
  lists: ListEntity[],
  listId: string,
  originalPosition: number,
): ListEntity[] {
  return sortByPosition(
    lists.map((list) =>
      list.id === listId ? { ...list, position: originalPosition } : list,
    ),
  )
}

/**
 * Reverts a failed card-move PATCH: puts `cardId` back in `originalListId`
 * at `originalPosition`, re-sorting both the list the card is currently in
 * and (if different) the list it's being restored to. Mirrors
 * `revertListPosition`'s "touch only what actually failed, not a whole
 * snapshot" approach, but a card move can also change which list the card
 * belongs to (not just its position within one), so this restores
 * membership as well as position — leaving any other card's own
 * since-committed move untouched.
 */
export function revertCardPlacement(
  lists: ListEntity[],
  cardId: string,
  originalListId: string,
  originalPosition: number,
): ListEntity[] {
  const currentListIndex = lists.findIndex((list) =>
    list.cards.some((card) => card.id === cardId),
  )
  if (currentListIndex === -1) return lists

  const card = lists[currentListIndex].cards.find((c) => c.id === cardId)!
  const restoredCard = {
    ...card,
    list_id: originalListId,
    position: originalPosition,
  }

  if (lists[currentListIndex].id === originalListId) {
    const cards = sortByPosition(
      lists[currentListIndex].cards.map((c) =>
        c.id === cardId ? restoredCard : c,
      ),
    )
    return lists.map((list, i) =>
      i === currentListIndex ? { ...list, cards } : list,
    )
  }

  const originalListIndex = lists.findIndex(
    (list) => list.id === originalListId,
  )
  if (originalListIndex === -1) {
    // The list the card originally belonged to no longer exists (e.g. it
    // was deleted while the move was in flight) — leave the card where it
    // currently is rather than dropping it into nothing.
    return lists
  }

  const withoutCard = removeItem(lists[currentListIndex].cards, cardId)
  const restoredOriginCards = sortByPosition([
    ...lists[originalListIndex].cards,
    restoredCard,
  ])

  return lists.map((list, i) => {
    if (i === currentListIndex) return { ...list, cards: withoutCard }
    if (i === originalListIndex) return { ...list, cards: restoredOriginCards }
    return list
  })
}
