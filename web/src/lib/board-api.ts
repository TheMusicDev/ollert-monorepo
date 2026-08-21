import { apiClient } from '@/lib/api-client'

import type { BoardDetail, CardEntity, ListEntity } from './board-types'

/** Thin wrappers around the board/list/card endpoints. See
 * planning/api-contract.md — every mutating endpoint returns the
 * updated/created resource as JSON. */

export function fetchBoardDetail(boardId: string): Promise<BoardDetail> {
  return apiClient.get<BoardDetail>(`/boards/${boardId}`)
}

export function createList(
  boardId: string,
  input: { title: string; position: number },
): Promise<ListEntity> {
  return apiClient.post<ListEntity>(`/boards/${boardId}/lists`, input)
}

export function updateList(
  listId: string,
  input: Partial<{ title: string; position: number }>,
): Promise<ListEntity> {
  return apiClient.patch<ListEntity>(`/lists/${listId}`, input)
}

export function deleteList(listId: string): Promise<void> {
  return apiClient.delete<void>(`/lists/${listId}`)
}

export function createCard(
  listId: string,
  input: { title: string; position: number },
): Promise<CardEntity> {
  return apiClient.post<CardEntity>(`/lists/${listId}/cards`, input)
}

export function updateCard(
  cardId: string,
  input: Partial<{
    title: string
    description: string | null
    due_date: string | null
    position: number
    list_id: string
  }>,
): Promise<CardEntity> {
  return apiClient.patch<CardEntity>(`/cards/${cardId}`, input)
}

export function deleteCard(cardId: string): Promise<void> {
  return apiClient.delete<void>(`/cards/${cardId}`)
}
