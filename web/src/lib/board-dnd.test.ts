import { describe, expect, it } from 'vitest'

import {
  MoveRequestTracker,
  moveCard,
  moveList,
  revertCardPlacement,
  revertListPosition,
} from './board-dnd'
import type { CardEntity, ListEntity } from './board-types'

function makeCard(
  overrides: Partial<CardEntity> & { id: string; list_id: string },
): CardEntity {
  return {
    title: 'Untitled',
    description: null,
    due_date: null,
    position: 1,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeList(
  overrides: Partial<ListEntity> & { id: string; cards: CardEntity[] },
): ListEntity {
  return {
    board_id: 'board-1',
    title: 'Untitled list',
    position: 1,
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('moveCard', () => {
  it('returns null when the source list is missing', () => {
    const lists = [makeList({ id: 'list-a', cards: [] })]
    const card = makeCard({ id: 'card-1', list_id: 'missing-list' })

    expect(moveCard(lists, card, 'list-a', 0)).toBeNull()
  })

  it('returns null when the destination list is missing', () => {
    const card = makeCard({ id: 'card-1', list_id: 'list-a', position: 1 })
    const lists = [makeList({ id: 'list-a', cards: [card] })]

    expect(moveCard(lists, card, 'missing-list', 0)).toBeNull()
  })

  it('reorders a card within the same list', () => {
    const a = makeCard({ id: 'a', list_id: 'list-1', position: 1 })
    const b = makeCard({ id: 'b', list_id: 'list-1', position: 2 })
    const c = makeCard({ id: 'c', list_id: 'list-1', position: 3 })
    const lists = [makeList({ id: 'list-1', cards: [a, b, c] })]

    const result = moveCard(lists, a, 'list-1', 2)

    expect(result).not.toBeNull()
    const cardIds = result!.lists[0].cards.map((card) => card.id)
    expect(cardIds).toEqual(['b', 'c', 'a'])
    expect(result!.position).toBe(4) // after c (position 3)
    expect(
      result!.lists[0].cards.find((card) => card.id === 'a')?.list_id,
    ).toBe('list-1')
  })

  it('moves a card to a different list, updating list_id and position', () => {
    const a = makeCard({ id: 'a', list_id: 'list-1', position: 1 })
    const x = makeCard({ id: 'x', list_id: 'list-2', position: 1 })
    const y = makeCard({ id: 'y', list_id: 'list-2', position: 2 })
    const lists = [
      makeList({ id: 'list-1', cards: [a] }),
      makeList({ id: 'list-2', cards: [x, y] }),
    ]

    // Drop 'a' between x and y (index 1) in list-2.
    const result = moveCard(lists, a, 'list-2', 1)

    expect(result).not.toBeNull()
    const list1 = result!.lists.find((l) => l.id === 'list-1')!
    const list2 = result!.lists.find((l) => l.id === 'list-2')!

    expect(list1.cards).toEqual([])
    expect(list2.cards.map((card) => card.id)).toEqual(['x', 'a', 'y'])
    expect(result!.position).toBe(1.5) // midpoint of x(1) and y(2)

    const movedCard = list2.cards.find((card) => card.id === 'a')!
    expect(movedCard.list_id).toBe('list-2')
    expect(movedCard.position).toBe(1.5)
  })

  it('drops a card into an empty list, bootstrapping to position 1', () => {
    const a = makeCard({ id: 'a', list_id: 'list-1', position: 1 })
    const lists = [
      makeList({ id: 'list-1', cards: [a] }),
      makeList({ id: 'list-2', cards: [] }),
    ]

    const result = moveCard(lists, a, 'list-2', 0)

    expect(result).not.toBeNull()
    expect(result!.position).toBe(1)
    const list2 = result!.lists.find((l) => l.id === 'list-2')!
    expect(list2.cards.map((card) => card.id)).toEqual(['a'])
  })
})

describe('moveList', () => {
  it('returns null when either id is missing', () => {
    const lists = [makeList({ id: 'list-1', cards: [] })]
    expect(moveList(lists, 'missing', 'list-1')).toBeNull()
    expect(moveList(lists, 'list-1', 'missing')).toBeNull()
  })

  it('reorders lists and computes the moved position', () => {
    const lists = [
      makeList({ id: 'a', cards: [], position: 1 }),
      makeList({ id: 'b', cards: [], position: 2 }),
      makeList({ id: 'c', cards: [], position: 3 }),
    ]

    const result = moveList(lists, 'a', 'c')

    expect(result).not.toBeNull()
    expect(result!.lists.map((list) => list.id)).toEqual(['b', 'c', 'a'])
    expect(result!.position).toBe(4) // after c (position 3)
  })

  it('is a no-op shape when moving a list onto itself', () => {
    const lists = [
      makeList({ id: 'a', cards: [], position: 1 }),
      makeList({ id: 'b', cards: [], position: 2 }),
    ]

    const result = moveList(lists, 'a', 'a')

    expect(result).not.toBeNull()
    expect(result!.lists.map((list) => list.id)).toEqual(['a', 'b'])
  })
})

describe('revertListPosition', () => {
  it('resets only the target list position and re-sorts', () => {
    // 'a' optimistically moved after 'c' (position 4); its PATCH then
    // fails while 'b' is unaffected — reverting 'a' must restore sorted
    // order without touching 'b'.
    const lists = [
      makeList({ id: 'b', cards: [], position: 2 }),
      makeList({ id: 'c', cards: [], position: 3 }),
      makeList({ id: 'a', cards: [], position: 4 }),
    ]

    const result = revertListPosition(lists, 'a', 1)

    expect(result.map((list) => list.id)).toEqual(['a', 'b', 'c'])
    expect(result.find((list) => list.id === 'a')?.position).toBe(1)
    expect(result.find((list) => list.id === 'b')?.position).toBe(2)
  })

  it('leaves lists unchanged if the target id is not found', () => {
    const lists = [makeList({ id: 'a', cards: [], position: 1 })]
    const result = revertListPosition(lists, 'missing', 5)
    expect(result.map((list) => list.id)).toEqual(['a'])
  })
})

describe('revertCardPlacement', () => {
  it('resets only the target card position within its current list', () => {
    const a = makeCard({ id: 'a', list_id: 'list-1', position: 4 })
    const b = makeCard({ id: 'b', list_id: 'list-1', position: 2 })
    const c = makeCard({ id: 'c', list_id: 'list-1', position: 3 })
    const lists = [makeList({ id: 'list-1', cards: [b, c, a] })]

    const result = revertCardPlacement(lists, 'a', 'list-1', 1)

    const list1 = result.find((l) => l.id === 'list-1')!
    expect(list1.cards.map((card) => card.id)).toEqual(['a', 'b', 'c'])
    expect(list1.cards.find((card) => card.id === 'a')?.position).toBe(1)
    expect(list1.cards.find((card) => card.id === 'a')?.list_id).toBe(
      'list-1',
    )
  })

  it('moves the card back to its original list and restores position', () => {
    const a = makeCard({ id: 'a', list_id: 'list-2', position: 1.5 })
    const x = makeCard({ id: 'x', list_id: 'list-2', position: 1 })
    const y = makeCard({ id: 'y', list_id: 'list-2', position: 2 })
    const b = makeCard({ id: 'b', list_id: 'list-1', position: 2 })
    const lists = [
      makeList({ id: 'list-1', cards: [b] }),
      makeList({ id: 'list-2', cards: [x, a, y] }),
    ]

    // 'a' was optimistically moved from list-1 to list-2; its PATCH fails,
    // so it should be restored to list-1 at its original position.
    const result = revertCardPlacement(lists, 'a', 'list-1', 1)

    const list1 = result.find((l) => l.id === 'list-1')!
    const list2 = result.find((l) => l.id === 'list-2')!
    expect(list1.cards.map((card) => card.id)).toEqual(['a', 'b'])
    expect(list1.cards.find((card) => card.id === 'a')?.position).toBe(1)
    expect(list1.cards.find((card) => card.id === 'a')?.list_id).toBe(
      'list-1',
    )
    expect(list2.cards.map((card) => card.id)).toEqual(['x', 'y'])
  })

  it('leaves lists unchanged if the card is not found', () => {
    const lists = [makeList({ id: 'list-1', cards: [] })]
    const result = revertCardPlacement(lists, 'missing', 'list-1', 1)
    expect(result).toBe(lists)
  })

  it('leaves the card where it is if its original list no longer exists', () => {
    const a = makeCard({ id: 'a', list_id: 'list-2', position: 1 })
    const lists = [makeList({ id: 'list-2', cards: [a] })]

    const result = revertCardPlacement(lists, 'a', 'deleted-list', 1)

    expect(result).toBe(lists)
  })
})

describe('MoveRequestTracker', () => {
  it('reverts to the starting placement when a single request fails', () => {
    const tracker = new MoveRequestTracker<number>()
    const { requestId } = tracker.start('list-1', 10)

    expect(tracker.settleFailure('list-1', requestId)).toBe(10)
  })

  it('clears tracking once the latest request settles', () => {
    const tracker = new MoveRequestTracker<number>()
    const { requestId } = tracker.start('list-1', 10)
    tracker.settleSuccess('list-1', requestId, 20)

    // A fresh move now re-baselines from its own starting placement rather
    // than reusing anything left over from the prior, now-settled chain.
    const { baseline } = tracker.start('list-1', 20)
    expect(baseline).toBe(20)
  })

  it('ignores a stale rejection superseded by a newer in-flight request', () => {
    const tracker = new MoveRequestTracker<number>()
    const { requestId: first } = tracker.start('list-1', 10)
    tracker.start('list-1', 15) // second request starts before first settles

    expect(tracker.settleFailure('list-1', first)).toBeUndefined()
  })

  it('rolls back to the original position when both chained requests fail', () => {
    // Second request starts while the first is still pending, so it reads
    // the first's optimistic (not yet confirmed) placement as its own
    // baseline. If both then fail, the rollback must land on the original
    // pre-chain placement, not that unconfirmed intermediate one.
    const tracker = new MoveRequestTracker<number>()
    const { requestId: first } = tracker.start('list-1', 10)
    const { requestId: second, baseline: secondBaseline } = tracker.start(
      'list-1',
      15,
    )
    expect(secondBaseline).toBe(10)

    expect(tracker.settleFailure('list-1', first)).toBeUndefined() // stale
    expect(tracker.settleFailure('list-1', second)).toBe(10)
  })

  it('rolls back to the confirmed placement when an earlier request succeeded', () => {
    // First request succeeds while a second is still pending; if the
    // second then fails, rollback must land on the first's confirmed
    // result, not the pre-chain original.
    const tracker = new MoveRequestTracker<number>()
    const { requestId: first } = tracker.start('list-1', 10)
    const { requestId: second } = tracker.start('list-1', 15)

    tracker.settleSuccess('list-1', first, 15) // superseded, keeps chain open
    expect(tracker.settleFailure('list-1', second)).toBe(15)
  })

  it('tracks independent chains per id', () => {
    const tracker = new MoveRequestTracker<number>()
    const { requestId: listA } = tracker.start('list-a', 1)
    const { requestId: listB } = tracker.start('list-b', 2)

    expect(tracker.settleFailure('list-a', listA)).toBe(1)
    expect(tracker.settleFailure('list-b', listB)).toBe(2)
  })
})
