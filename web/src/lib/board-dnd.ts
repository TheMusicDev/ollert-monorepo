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
 * request's), not something the backend actually has yet.
 *
 * Rather than accumulate a special case per newly-discovered interleaving
 * of overlapping requests, this is built on two invariants, each enforced
 * in exactly one place:
 *
 *  1. A request's id (`issuedRequestId`) is unique and monotonically
 *     increasing for the entity's *entire lifetime* — it is never reused,
 *     even after every in-flight request for that id has settled and a
 *     later, unrelated move starts a fresh chain. This is what lets any
 *     settlement, no matter how late or out of order, always be compared
 *     against "how recent is this really" without ambiguity.
 *  2. A success only ever advances `baselines` when its requestId is
 *     strictly greater than the highest one already applied
 *     (`appliedRequestId`) — full stop. A failure only ever triggers a
 *     rollback when its requestId is the single highest one ever issued
 *     (`issuedRequestId`) — i.e. it's literally the most recent attempt, so
 *     nothing newer has since taken over the optimistic UI state.
 *
 * `start` only captures a fresh baseline (from the caller's current,
 * on-screen placement) when no request for this id is still pending —
 * otherwise it reuses whatever baseline the still-open chain already has.
 */
export class MoveRequestTracker<TPlacement> {
  private issuedRequestId = new Map<string, number>()
  private pendingCount = new Map<string, number>()
  private baselines = new Map<string, TPlacement>()
  private appliedRequestId = new Map<string, number>()

  /** Registers a new move attempt for `id`, returning its request id (pass
   * this to `settleSuccess`/`settleFailure`) and the baseline placement a
   * rollback should currently target if this request fails. */
  start(
    id: string,
    currentPlacement: TPlacement,
  ): { requestId: number; baseline: TPlacement } {
    if ((this.pendingCount.get(id) ?? 0) === 0) {
      // No chain is currently open for this id — start a fresh one from
      // whatever's actually on screen right now, discarding any leftover
      // bookkeeping from a prior, fully-settled chain.
      this.baselines.set(id, currentPlacement)
      this.appliedRequestId.delete(id)
    }
    const requestId = (this.issuedRequestId.get(id) ?? 0) + 1
    this.issuedRequestId.set(id, requestId)
    this.pendingCount.set(id, (this.pendingCount.get(id) ?? 0) + 1)
    return { requestId, baseline: this.baselines.get(id)! }
  }

  /** Call when a move PATCH for `id`/`requestId` succeeds. */
  settleSuccess(id: string, requestId: number, placement: TPlacement): void {
    this.decrementPending(id)
    if (requestId > (this.appliedRequestId.get(id) ?? 0)) {
      // Strictly newer than anything already applied for this id (whether
      // or not another request is still pending) — it becomes the new
      // rollback target.
      this.appliedRequestId.set(id, requestId)
      this.baselines.set(id, placement)
    }
    // Else: older than a success already applied — stale, must not
    // resurrect/overwrite the baseline with a superseded placement.
  }

  /** Call when a move PATCH for `id`/`requestId` fails. Returns the
   * placement to roll back to, or `undefined` if `requestId` has since been
   * superseded by a newer request for the same `id` (a stale rejection that
   * should be ignored). */
  settleFailure(id: string, requestId: number): TPlacement | undefined {
    this.decrementPending(id)
    if (requestId !== this.issuedRequestId.get(id)) return undefined
    return this.baselines.get(id)
  }

  private decrementPending(id: string): void {
    const remaining = (this.pendingCount.get(id) ?? 0) - 1
    this.pendingCount.set(id, Math.max(0, remaining))
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
