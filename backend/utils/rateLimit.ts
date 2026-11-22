import { Request, Response, NextFunction } from "express";

/**
 * Fixed-window rate limiter (kiosk spec §7 — the kiosk routes are keyed on
 * axes the IP limiter cannot see, like one device or one administrator).
 *
 * In-memory on purpose: the server is a single process and the limits are a
 * throttle, not an audit ledger. Every limiter shuts off under
 * `NODE_ENV=test`, for the same reason the server-level limiters in
 * server.ts do — a second test run inside the window would 429 before
 * reaching the code under test.
 */

type RateLimitOptions = {
  /** Window length in milliseconds; counts reset when it lapses. */
  windowMs: number;
  /** Requests allowed per key per window. */
  max: number;
  /** Where the key comes from — an IP, an administrator id, a device id. */
  keyer: (req: Request) => string;
  /** Response body when the cap trips. */
  message?: { success: boolean; message: string };
};

/** Tracking cap: a windowed Map can only be a bounded sibling of the process. */
const MAX_TRACKED_KEYS = 5000;

export const createRateLimiter = ({
  windowMs,
  max,
  keyer,
  message = { success: false, message: "Too many requests, please try again later." },
}: RateLimitOptions) => {
  const entries = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === "test") {
      next();
      return;
    }

    const now = Date.now();
    const key = keyer(req) || "unknown";

    // Opportunistic pruning on the way in: drop this window's dead entries,
    // and if the map still grows past its cap (an attacker rotating keys),
    // shed the oldest so it cannot grow unbounded.
    if (entries.size > 0) {
      for (const [tracked, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(tracked);
      }
    }
    if (entries.size >= MAX_TRACKED_KEYS) {
      const over = entries.size - MAX_TRACKED_KEYS + 1;
      const eldest = entries.keys();
      for (let i = 0; i < over; i++) {
        const nextKey = eldest.next();
        if (nextKey.done) break;
        entries.delete(nextKey.value);
      }
    }

    const existing = entries.get(key);
    if (!existing || existing.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > max) {
      res.status(429).json(message);
      return;
    }

    next();
  };
};
