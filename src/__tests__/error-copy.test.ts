/**
 * The plain-language error map in src/api/axios.ts (`describeApiError`).
 *
 * M7 finding: screens rendered `response.data.message` raw. The map owns the
 * wording instead — typed code first, then status, then a fallback. The raw
 * body never reaches the UI except through the two fixed contract constants
 * the backend always sends the same way ("Invalid email or password",
 * "Account deactivated").
 */
import { describe, it, expect } from 'vitest'
import { describeApiError } from '../api/axios'

const err = (
  status?: number,
  data?: Record<string, unknown>
): {
  response?: { status?: number; data?: Record<string, unknown> }
} => (status === undefined && data === undefined ? {} : { response: { status, data } })

describe('typed codes map to plain language', () => {
  it('explains the password-change 403', () => {
    expect(
      describeApiError(err(403, { code: 'PASSWORD_CHANGE_REQUIRED' }))
    ).toMatch(/password change/i)
  })

  it('explains an account deactivated', () => {
    expect(describeApiError(err(401, { code: 'ACCOUNT_DEACTIVATED' }))).toMatch(
      /deactivated/i
    )
  })
})

describe('status fallbacks cover the M7-era classes', () => {
  it('covers the 409 decided / record-changed family', () => {
    expect(describeApiError(err(409, { message: 'Correction already decided' }))).toMatch(
      /conflicts|earlier decision|newer record/i
    )
  })

  it('covers the throttled 429 family', () => {
    expect(describeApiError(err(429, { message: 'Too many requests' }))).toMatch(
      /too many attempts/i
    )
  })
})

describe('the backend contract constants render their rows', () => {
  it('reads the fixed credential-check string', () => {
    expect(
      describeApiError(err(undefined, { message: 'Invalid email or password' }))
    ).toBe('Invalid email or password.')
  })

  it('reads the fixed login deactivation string', () => {
    expect(
      describeApiError(err(403, { message: 'Account deactivated' }))
    ).toMatch(/deactivated/i)
  })
})

describe('everything else is the safe fallback', () => {
  it('never passes an unknown body message through', () => {
    expect(
      describeApiError(
        err(500, { message: 'E121_C_Nocturne: server cache hiccup' })
      )
    ).toMatch(/something went wrong/i)
  })

  it('answers a network failure with the fallback too', () => {
    expect(describeApiError({})).toMatch(/something went wrong/i)
  })
})
