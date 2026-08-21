import { describe, expect, it } from 'vitest'

import {
  insertItemAt,
  moveItem,
  positionBetween,
  positionForIndex,
  removeItem,
  sortByPosition,
} from './positioning'

describe('positionBetween', () => {
  it('bootstraps to 1 when the collection is empty', () => {
    expect(positionBetween(undefined, undefined)).toBe(1)
  })

  it('halves the single neighbor when inserting before everything', () => {
    expect(positionBetween(undefined, 4)).toBe(2)
  })

  it('adds 1 to the single neighbor when inserting after everything', () => {
    expect(positionBetween(6, undefined)).toBe(7)
  })

  it('midpoints two neighbors', () => {
    expect(positionBetween(2, 4)).toBe(3)
  })

  it('midpoints fractional neighbors without collapsing to an existing value', () => {
    const a = positionBetween(1, 2)
    expect(a).toBe(1.5)
    const b = positionBetween(1, a)
    expect(b).toBe(1.25)
    expect(b).not.toBe(a)
  })
})

describe('positionForIndex', () => {
  const siblings = [1, 2, 3]

  it('returns a position before all siblings at index 0', () => {
    expect(positionForIndex(siblings, 0)).toBe(0.5)
  })

  it('returns a midpoint position between two siblings', () => {
    expect(positionForIndex(siblings, 1)).toBe(1.5)
    expect(positionForIndex(siblings, 2)).toBe(2.5)
  })

  it('returns a position after all siblings at the end index', () => {
    expect(positionForIndex(siblings, 3)).toBe(4)
  })

  it('bootstraps to 1 for an empty sibling list', () => {
    expect(positionForIndex([], 0)).toBe(1)
  })

  it('clamps an out-of-range index to the nearest end', () => {
    expect(positionForIndex(siblings, 99)).toBe(4)
    expect(positionForIndex(siblings, -5)).toBe(0.5)
  })
})

describe('sortByPosition', () => {
  it('returns an ascending-position copy without mutating the input', () => {
    const items = [{ position: 3 }, { position: 1 }, { position: 2 }]
    const sorted = sortByPosition(items)

    expect(sorted.map((i) => i.position)).toEqual([1, 2, 3])
    expect(items.map((i) => i.position)).toEqual([3, 1, 2])
  })
})

describe('removeItem', () => {
  it('drops the matching id and leaves the rest untouched', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(removeItem(items, 'b')).toEqual([{ id: 'a' }, { id: 'c' }])
  })
})

describe('insertItemAt', () => {
  it('inserts at the start with a position before the first sibling', () => {
    const items = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]
    const { items: result, position } = insertItemAt(
      items,
      { id: 'new', position: 999 },
      0,
    )

    expect(position).toBe(0.5)
    expect(result.map((i) => i.id)).toEqual(['new', 'a', 'b'])
    expect(result[0].position).toBe(0.5)
  })

  it('inserts at the end with a position after the last sibling', () => {
    const items = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]
    const { items: result, position } = insertItemAt(
      items,
      { id: 'new', position: 999 },
      2,
    )

    expect(position).toBe(3)
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'new'])
  })

  it('inserts into an empty collection bootstrapping to 1', () => {
    const { items: result, position } = insertItemAt(
      [],
      { id: 'new', position: 999 },
      0,
    )

    expect(position).toBe(1)
    expect(result).toEqual([{ id: 'new', position: 1 }])
  })

  it('does not mutate the input array', () => {
    const items = [{ id: 'a', position: 1 }]
    insertItemAt(items, { id: 'new', position: 999 }, 0)
    expect(items).toEqual([{ id: 'a', position: 1 }])
  })
})

describe('moveItem', () => {
  it('reorders a same-list item to a later index', () => {
    const items = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ]

    const result = moveItem(items, 'a', 2)

    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    // moved to the end, so its new position is after 'c' (3 -> 4)
    expect(result.find((i) => i.id === 'a')?.position).toBe(4)
  })

  it('reorders a same-list item to an earlier index', () => {
    const items = [
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ]

    const result = moveItem(items, 'c', 0)

    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(result.find((i) => i.id === 'c')?.position).toBe(0.5)
  })

  it('is a no-op when the id is not found', () => {
    const items = [{ id: 'a', position: 1 }]
    expect(moveItem(items, 'missing', 0)).toBe(items)
  })
})
