import '@testing-library/jest-dom/vitest'

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
