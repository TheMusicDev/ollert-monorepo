import { defineConfig, devices } from '@playwright/test'

import { loadDotenv } from './tests/setup/load-dotenv'

loadDotenv()

import { env } from './tests/setup/env'

const reuseExistingServer = !process.env.CI

export default defineConfig({
  testDir: './tests/specs',
  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,

  use: {
    baseURL: env.webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Convenience for `bun test` on a fresh checkout: boots both dev servers
  // if nothing is already listening on their ports. During manual runs
  // where the API/web servers are already up (the normal local workflow —
  // see README), `reuseExistingServer` skips straight past this and talks
  // to what's already running.
  webServer: [
    {
      command: 'bin/cake server -p 8765',
      cwd: '../api',
      url: `${env.apiBaseUrl}/health`,
      reuseExistingServer,
      timeout: 30_000,
    },
    {
      command: 'bun run dev',
      cwd: '../web',
      url: env.webBaseUrl,
      reuseExistingServer,
      timeout: 60_000,
    },
  ],
})
