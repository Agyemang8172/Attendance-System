/**
 * Runs before each test file. Registered as an afterEach by testing-library, so
 * `cleanup()` and `localStorage.clear()` below execute once per test: route
 * guards read the session from localStorage, so a session left behind by one
 * test would silently authorise the next one.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
})
