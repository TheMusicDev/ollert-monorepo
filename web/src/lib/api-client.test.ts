import { describe, expect, it } from 'vitest'

import { ApiError, isPaginatedResponse } from './api-client'

describe('isPaginatedResponse', () => {
  it('recognizes the standard { data, meta } envelope', () => {
    const envelope = {
      data: [{ id: '1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }
    expect(isPaginatedResponse(envelope)).toBe(true)
  })

  it('rejects a bare array', () => {
    expect(isPaginatedResponse([{ id: '1' }])).toBe(false)
  })

  it('rejects an object missing meta', () => {
    expect(isPaginatedResponse({ data: [] })).toBe(false)
  })

  it('rejects null', () => {
    expect(isPaginatedResponse(null)).toBe(false)
  })
})

describe('ApiError', () => {
  it('carries message, code, status, and fields', () => {
    const error = new ApiError('Title is required', 'validation_failed', 422, {
      title: ['Title is required'],
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
    expect(error.message).toBe('Title is required')
    expect(error.code).toBe('validation_failed')
    expect(error.status).toBe(422)
    expect(error.fields).toEqual({ title: ['Title is required'] })
  })
})
