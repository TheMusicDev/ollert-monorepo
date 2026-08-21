import { supabase } from './supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

if (!API_BASE_URL) {
  throw new Error(
    'Missing VITE_API_BASE_URL. Copy .env.example to .env in /web and fill in the API base URL.',
  )
}

/**
 * Shape of `error.fields` on a 422 validation error — field name -> messages.
 * Partial because a given error only ever populates the field(s) that
 * actually failed validation, not every possible field name.
 */
export type ApiErrorFields = Partial<Record<string, string[]>>

/**
 * Typed error thrown for any non-2xx API response. Parsed from the standard
 * error envelope: `{ error: { message, code, fields? } }`.
 * See planning/api-contract.md#error-response-shape.
 */
export class ApiError extends Error {
  /** Machine-readable slug (e.g. `quota_exceeded`, `not_org_member`) to branch on. */
  readonly code: string
  /** HTTP status code. */
  readonly status: number
  /** Present only for 422s from form validation. */
  readonly fields?: ApiErrorFields

  constructor(
    message: string,
    code: string,
    status: number,
    fields?: ApiErrorFields,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
  }
}

/** The `{ page, limit, total, totalPages }` half of the pagination envelope. */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Standard paginated collection envelope: `{ data, meta }`. See
 * planning/api-contract.md#pagination. */
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

/** Narrows an arbitrary parsed JSON body to a `PaginatedResponse<T>`. */
export function isPaginatedResponse<T>(
  value: unknown,
): value is PaginatedResponse<T> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.data) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  )
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

interface ErrorEnvelope {
  error?: {
    message?: string
    code?: string
    fields?: ApiErrorFields
  }
}

/**
 * A 401 means the refresh token itself is dead (revoked/expired) — Supabase's
 * client already auto-refreshes ahead of expiry, so this isn't a transient
 * blip. Treated as unrecoverable: clear the session and hard-redirect to
 * login, no retry-after-refresh. See planning/architecture.md#auth-flow.
 */
async function handleUnauthorized(): Promise<never> {
  await supabase.auth.signOut()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
  throw new ApiError(
    'Session expired. Please log in again.',
    'unauthorized',
    401,
  )
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401) {
    return handleUnauthorized()
  }

  if (!response.ok) {
    const envelope = (await response
      .json()
      .catch(() => null)) as ErrorEnvelope | null
    throw new ApiError(
      envelope?.error?.message ??
        `Request failed with status ${response.status}`,
      envelope?.error?.code ?? 'unknown_error',
      response.status,
      envelope?.error?.fields,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
