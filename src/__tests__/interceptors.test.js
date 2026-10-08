/**
 * The response error policy in src/api/axios.ts — exercised by importing the
 * real module's `handleApiError` with `axios` itself stubbed.
 *
 * src/__tests__/auth-routing.test.jsx replaces the API client wholesale, so
 * this file is where the two session-changing branches live: a plain 401
 * discards the session and redirects to the sign-in page, and a 403 with
 * `code: PASSWORD_CHANGE_REQUIRED` (M1's requirePasswordChange middleware)
 * holds the session and redirects to the password screen instead of losing
 * it. The interceptor itself does the navigation; jsdom cannot follow one,
 * which is exactly why the decision lives in a returned path here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: () => {} },
        response: { use: () => {} },
      },
    }),
  },
}))

import { handleApiError } from '../api/axios'

function forbidden(code, url = '/users') {
  return {
    config: { url },
    response: {
      status: 403,
      data: { code, message: 'Forbidden' },
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/dashboard')
})

describe('a 403 carrying PASSWORD_CHANGE_REQUIRED', () => {
  it('holds the session on the password screen without discarding it', () => {
    localStorage.setItem('token', 'keep-me')

    const target = handleApiError(forbidden('PASSWORD_CHANGE_REQUIRED'))

    expect(target).toBe('/set-password')
    expect(localStorage.getItem('token')).toBe('keep-me')
  })

  it('does not redirect when already on the password screen', () => {
    window.history.pushState({}, '', '/set-password')

    const target = handleApiError(forbidden('PASSWORD_CHANGE_REQUIRED'))

    expect(target).toBeNull()
  })
})

describe('other failures', () => {
  it('leaves a 403 with a different code untouched', () => {
    const target = handleApiError(forbidden('ACCESS_DENIED'))

    expect(target).toBeNull()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('discards the session on a plain 401 and heads to the sign-in page', () => {
    localStorage.setItem('token', 'gone')
    localStorage.setItem('user', '{"role":"STAFF"}')
    const err = forbidden('ACCESS_DENIED')
    err.response.status = 401

    const target = handleApiError(err)

    expect(target).toBe('/login')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('does not clear the session for a failed login attempt', () => {
    localStorage.setItem('token', 'still-here')
    const err = forbidden('ANY', '/auth/login')
    err.response.status = 401

    const target = handleApiError(err)

    expect(target).toBeNull()
    expect(localStorage.getItem('token')).toBe('still-here')
  })
})