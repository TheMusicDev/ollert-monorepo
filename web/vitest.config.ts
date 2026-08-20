import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Separate from vite.config.ts: unit/component tests don't need the
// TanStack Start / Nitro build plugins, just React + Tailwind + path aliases.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    env: {
      // Dummy values so modules that validate required env vars at import
      // time (src/lib/supabase.ts, src/lib/api-client.ts) don't throw in
      // tests. Never real credentials.
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      VITE_API_BASE_URL: 'http://localhost:8765/api',
    },
  },
})
