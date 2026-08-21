import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from './api-client'
import type * as ApiClientModule from './api-client'
import {
  createBoard,
  deleteBoard,
  getOrg,
  listBoards,
  renameBoard,
} from './boards-api'

vi.mock('./api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('./api-client')
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

describe('boards-api', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset()
    vi.mocked(apiClient.post).mockReset()
    vi.mocked(apiClient.patch).mockReset()
    vi.mocked(apiClient.delete).mockReset()
  })

  it('getOrg fetches the org detail endpoint', () => {
    void getOrg('org-1')
    expect(apiClient.get).toHaveBeenCalledWith('/orgs/org-1')
  })

  it('listBoards fetches the paginated boards endpoint with page/limit', () => {
    void listBoards('org-1', 2, 12)
    expect(apiClient.get).toHaveBeenCalledWith(
      '/orgs/org-1/boards?page=2&limit=12',
    )
  })

  it('createBoard posts a title to the org boards endpoint', () => {
    void createBoard('org-1', 'Sprint board')
    expect(apiClient.post).toHaveBeenCalledWith('/orgs/org-1/boards', {
      title: 'Sprint board',
    })
  })

  it('renameBoard patches the board title', () => {
    void renameBoard('board-1', 'New title')
    expect(apiClient.patch).toHaveBeenCalledWith('/boards/board-1', {
      title: 'New title',
    })
  })

  it('deleteBoard deletes the board endpoint', () => {
    void deleteBoard('board-1')
    expect(apiClient.delete).toHaveBeenCalledWith('/boards/board-1')
  })
})
