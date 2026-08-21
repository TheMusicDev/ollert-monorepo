import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `test.globals` is off (see vitest.config.ts), so Testing Library's
// auto-cleanup — which relies on detecting a global `afterEach` — never
// registers itself. Without this, DOM from one test in a multi-test file
// leaks into the next, breaking any query that expects a single match.
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
