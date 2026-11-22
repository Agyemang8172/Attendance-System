/**
 * Owner ruling R5 (2026-10-17): ten wrong PINs, then a five-minute lock.
 *
 * The kiosk verification lane and the self-service PIN change both verify the
 * same four-digit credential, so they must share one guessing budget. Keeping
 * the numbers here means a future change cannot leave one lane weaker than the
 * other.
 */
export const PIN_MAX_ATTEMPTS = 10;
export const PIN_LOCK_MINUTES = 5;

/** The instant a lock that starts at `now` stops refusing attempts. */
export const pinLockUntil = (now: Date): Date =>
  new Date(now.getTime() + PIN_LOCK_MINUTES * 60 * 1000);
