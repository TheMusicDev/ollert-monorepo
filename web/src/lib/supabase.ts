import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env in /web and fill in your Supabase project values.',
  )
}

// Auth only — no Supabase DB/Realtime calls, app data lives in CakePHP's
// MySQL. The client persists the session and auto-refreshes the access
// token ahead of expiry by default; we never call refreshSession manually.
// See planning/architecture.md#auth-flow.
export const supabase = createClient(supabaseUrl, supabasePublishableKey)
