/**
 * Central env-var loading for the e2e suite. Mirrors the values `/web` and
 * `/api` already read from their own `.env` files (see planning/architecture.md)
 * rather than duplicating them — this suite drives a real browser against
 * real running servers, so it needs the same Supabase project + API base URL
 * they're configured with.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy e2e/.env.example to e2e/.env and fill it in — see e2e/README.md.`,
    )
  }
  return value
}

export const env = {
  // Getters, not plain properties: this module is imported (and, per ES
  // module semantics, evaluated) before `loadDotenv()` runs in
  // playwright.config.ts, since import declarations are hoisted above
  // other top-level statements regardless of source order. Reading
  // `process.env` lazily, on access, means these still see whatever
  // `loadDotenv()` populated by the time anything actually calls them.
  get webBaseUrl(): string {
    return process.env.WEB_BASE_URL ?? 'http://localhost:3000'
  },
  get apiBaseUrl(): string {
    return process.env.API_BASE_URL ?? 'http://localhost:8765/api'
  },

  get supabaseUrl(): string {
    return required('SUPABASE_URL')
  },
  get supabasePublishableKey(): string {
    return required('SUPABASE_PUBLISHABLE_KEY')
  },
  /**
   * Service-role (secret) key for the Supabase project's Admin API. When
   * present, global-setup creates brand-new, pre-confirmed throwaway test
   * users on every run (see tests/setup/supabase-admin.ts) — the preferred
   * path, since it needs no human-in-the-loop email confirmation step and
   * isn't subject to the project's outbound-email rate limit. NEVER expose
   * this key to the browser/frontend — it's used only from Node, in
   * global-setup, to call Supabase's server-side Admin API.
   */
  get supabaseServiceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY
  },

  /**
   * Fallback path when no service-role key is available: pre-existing,
   * already-confirmed Supabase accounts. Required together (owner + a
   * second member account for the org-member scenarios) if
   * SUPABASE_SERVICE_ROLE_KEY isn't set.
   */
  get ownerEmail(): string | undefined {
    return process.env.E2E_OWNER_EMAIL
  },
  get ownerPassword(): string | undefined {
    return process.env.E2E_OWNER_PASSWORD
  },
  get memberEmail(): string | undefined {
    return process.env.E2E_MEMBER_EMAIL
  },
  get memberPassword(): string | undefined {
    return process.env.E2E_MEMBER_PASSWORD
  },
}
