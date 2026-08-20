import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Testing Library auto-registers its afterEach cleanup only when it finds a
// global `afterEach` (e.g. `test.globals: true`). This project's vitest
// config uses `globals: false`, so without this, DOM from one test's
// render() leaks into the next test in the same file. Register it
// explicitly instead.
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
