/**
 * D7/S7 — the password policy is one rule enforced on both sides of the wire.
 *
 * The server owns the rule (`backend/validators/index.ts`) and the client
 * mirrors it (`src/utils/passwordPolicy.ts`) so a user hears the same reason
 * before the request as after it. These tests pin the client mirror: the
 * 10-character floor, the 72-character bcrypt ceiling, and the blocklist.
 */
import { describe, it, expect } from 'vitest'
import {
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../utils/passwordPolicy'

describe('validatePassword — client policy mirror', () => {
  it('accepts a policy-compliant password', () => {
    expect(validatePassword('curious-gazelle-44')).toBe(null)
  })

  it('rejects a password shorter than the floor', () => {
    expect(validatePassword('short1')).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    )
  })

  it('rejects a password longer than the bcrypt ceiling', () => {
    // 73 characters — bcrypt would silently read only 72 bytes of it, so the
    // caller is told rather than let to believe a longer password exists.
    expect(validatePassword('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
    )
  })

  it('accepts a password exactly at the ceiling', () => {
    expect(validatePassword('x'.repeat(PASSWORD_MAX_LENGTH))).toBe(null)
  })

  it('rejects a common password case-insensitively', () => {
    expect(validatePassword('Password123')).toBe(
      'That password is on the list of most commonly used passwords'
    )
  })
})