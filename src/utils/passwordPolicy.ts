// ── D7 / S7 — one password policy, mirrored on the client ────────────────────
//
// The server owns the rule (backend/validators/index.ts) and these values are
// kept identical to it by hand. The client mirrors the rule so a user hears
// the same error before the request as after it — the old app had six, eight
// and zero-character rules in different places, which is exactly D7 is
// designed to end. When the backend rule changes, change this file in the
// same commit.

/** Length floor. Ten characters is where a short wordlist stops being enough. */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Length ceiling. bcrypt reads at most 72 bytes, so anything longer is silently
 * truncated — a caller believes they set a 100-character password while the
 * hash covers 72. Rejecting rather than truncating removes the mismatch.
 */
export const PASSWORD_MAX_LENGTH = 72;

/** Identical to the server PASSWORD_BLOCKLIST, compared case-insensitively. */
const PASSWORD_BLOCKLIST = new Set(
  [
    'password',
    'password1',
    'password123',
    'passw0rd',
    '123456',
    '123456789',
    '1234567890',
    'qwerty',
    'qwertyuiop',
    'letmein',
    'welcome',
    'welcome1',
    'admin',
    'administrator',
    'iloveyou',
    'monkey',
    'dragon',
    'sunshine',
    'princess',
    'football',
    'baseball',
    'abc123',
    'abcd1234',
    'changeme',
    'summer2024',
    'winter2024',
    'attendance',
    'attendpro',
  ].map((entry) => entry.toLowerCase())
);

/**
 * Returns the first policy violation as a human message, or null when the
 * password is acceptable. The server answers with the first zod rule that
 * fires, and zod runs length checks before the blocklist refinement, so a
 * short blocklisted word comes back as a length error from the API. This
 * mirrors that order so the client and server are loud about the same thing.
 */
export const validatePassword = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (PASSWORD_BLOCKLIST.has(password.toLowerCase())) {
    return 'That password is on the list of most commonly used passwords';
  }
  return null;
};