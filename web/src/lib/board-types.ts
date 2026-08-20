/**
 * Entities returned by the board-detail endpoint and its nested
 * lists/cards mutation endpoints. See planning/api-contract.md and
 * planning/data-model.md.
 */

export interface CardEntity {
  id: string
  list_id: string
  title: string
  description: string | null
  due_date: string | null
  /** Float, fractional-indexing position within its list. */
  position: number
  created: string
  modified: string
}

export interface ListEntity {
  id: string
  board_id: string
  title: string
  /** Float, fractional-indexing position within its board. */
  position: number
  cards: CardEntity[]
  created: string
  modified: string
}

/**
 * `GET /api/boards/:id` — single unpaginated response with lists and cards
 * nested. See planning/api-contract.md#pagination.
 */
export interface BoardDetail {
  id: string
  org_id: string
  title: string
  lists: ListEntity[]
  created: string
  modified: string
}
