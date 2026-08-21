import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// @testing-library/react auto-registers its own `afterEach(cleanup)` only
// when `afterEach` is a *global* — this project runs Vitest with
// `globals: false` (see vitest.config.ts), so that auto-registration never
// fires and unmounted trees from a previous test leak into the next one
// within the same file. Register it explicitly instead.
afterEach(cleanup)

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
