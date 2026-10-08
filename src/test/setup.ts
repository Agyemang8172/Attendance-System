/**
 * Runs before each test file. Registered as an afterEach by testing-library, so
 * `cleanup()` and `localStorage.clear()` below execute once per test: route
 * guards read the session from localStorage, so a session left behind by one
 * test would silently authorise the next one.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement matchMedia, but react-hot-toast consults it for
// the "prefers-reduced-motion" flag the moment a toast renders. Without a
// stub, the first toast in any test file throws.
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})
