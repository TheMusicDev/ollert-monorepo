import { describe, expect, it, vi } from 'vitest'

import { apiClient } from './api-client'
import { createOrg, deleteOrg, listOrgs, renameOrg } from './orgs-api'

vi.mock('./api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('orgs-api', () => {
  it('listOrgs requests the paginated collection with page/limit query params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
    })

    await listOrgs(2, 10)

    expect(apiClient.get).toHaveBeenCalledWith('/orgs?page=2&limit=10')
  })

  it('createOrg posts the name', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: '1', name: 'Acme' })

    await createOrg('Acme')

    expect(apiClient.post).toHaveBeenCalledWith('/orgs', { name: 'Acme' })
  })

  it('renameOrg patches the given org id with the new name', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ id: '1', name: 'New' })

    await renameOrg('1', 'New')

    expect(apiClient.patch).toHaveBeenCalledWith('/orgs/1', { name: 'New' })
  })

  it('deleteOrg deletes the given org id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)

    await deleteOrg('1')

    expect(apiClient.delete).toHaveBeenCalledWith('/orgs/1')
  })
})
