import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest.config.ts runs with `globals: false`, so Testing Library's
// auto-cleanup (which detects a global `afterEach`) never registers itself —
// without this, DOM from one test's render() leaks into the next test in the
// same file. Wire it up explicitly instead.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement matchMedia — polyfill it for code that reads
// prefers-color-scheme (src/lib/theme.ts).
window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})
