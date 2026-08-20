/**
 * Fractional-indexing helpers for drag-drop reorder of lists/cards.
 * See planning/data-model.md#ordering-drag-drop: `position` is a float,
 * a moved row's new position is the midpoint of its new neighbors, and
 * the first item in an otherwise-empty list/board bootstraps to `1.0`.
 *
 * The doc only specifies the empty-collection bootstrap case; the
 * single-neighbor cases (insert at the very start, or the very end) are
 * left to the implementation. This uses the conventional fractional-
 * indexing choice: half the one neighbor's position when inserting
 * before everything, and neighbor + 1 when inserting after everything.
 */

/** Position for a row being placed between `prev` and `next` (either may
 * be absent at either end of the collection). */
export function positionBetween(
  prev: number | undefined,
  next: number | undefined,
): number {
  if (prev === undefined && next === undefined) return 1
  if (prev === undefined) return next! / 2
  if (next === undefined) return prev + 1
  return (prev + next) / 2
}

/**
 * Position for inserting a row at `index` among `siblingPositions` — the
 * positions of the *other* rows, in their current display order, not
 * including the row being placed.
 */
export function positionForIndex(
  siblingPositions: number[],
  index: number,
): number {
  const clamped = Math.max(0, Math.min(index, siblingPositions.length))
  const prev = clamped > 0 ? siblingPositions[clamped - 1] : undefined
  const next =
    clamped < siblingPositions.length ? siblingPositions[clamped] : undefined
  return positionBetween(prev, next)
}

/** Ascending-position copy of a list/card array — the API doesn't
 * guarantee nested-array order, so every render sorts by `position`. */
export function sortByPosition<T extends { position: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => a.position - b.position)
}

/**
 * Removes `itemId` from `items` and re-inserts it (with a freshly
 * computed `position`) at `toIndex` among the remaining items. Used for
 * same-list reorders (list-within-board, card-within-list) and, combined
 * with `removeItem`/`insertItemAt`, cross-list card moves.
 */
export function moveItem<T extends { id: string; position: number }>(
  items: T[],
  itemId: string,
  toIndex: number,
): T[] {
  const moved = items.find((item) => item.id === itemId)
  if (!moved) return items
  const { items: result } = insertItemAt(
    removeItem(items, itemId),
    moved,
    toIndex,
  )
  return result
}

/** Returns `items` with `itemId` removed. */
export function removeItem<T extends { id: string }>(
  items: T[],
  itemId: string,
): T[] {
  return items.filter((item) => item.id !== itemId)
}

/**
 * Inserts `item` into `items` (which must NOT already contain it) at
 * `toIndex`, computing a fresh `position` from its new neighbors. Returns
 * both the new array and the computed position (the caller needs the
 * position on its own to PATCH the moved row).
 */
export function insertItemAt<T extends { id: string; position: number }>(
  items: T[],
  item: T,
  toIndex: number,
): { items: T[]; position: number } {
  const clampedIndex = Math.max(0, Math.min(toIndex, items.length))
  const siblingPositions = items.map((i) => i.position)
  const position = positionForIndex(siblingPositions, clampedIndex)
  const movedItem = { ...item, position }
  const result = [...items]
  result.splice(clampedIndex, 0, movedItem)
  return { items: result, position }
}
