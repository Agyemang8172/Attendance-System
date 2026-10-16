import { createHmac, timingSafeEqual } from "crypto";

/**
 * Keyed hashes for the kiosk secrets (kiosk spec M1-KIOSK-SECURITY.md).
 *
 * The spec keys each kind of secret with its own server-side key, so the
 * compromise of one lane cannot be replayed against another:
 *
 * - pairing codes  → `KIOSK_PAIRING_KEY` (§2.1)
 * - device tokens  → `KIOSK_TOKEN_KEY`   (§2.3)
 *
 * `QR_SECRET_KEY` (§3.2) keys the employee badge tokens; that lane already
 * lives in `qrController.ts` and belongs to the identify flow, not here.
 *
 * Every consumer checks that its key is set before calling these helpers and
 * answers a generic 500 when it is not — failing closed (kiosk §10: an
 * unkeyed hash would be a bare digest anyone can recompute offline).
 */
export const hashPairingCode = (code: string): string =>
  createHmac("sha256", process.env.KIOSK_PAIRING_KEY as string)
    .update(code)
    .digest("hex");

export const hashDeviceToken = (token: string): string =>
  createHmac("sha256", process.env.KIOSK_TOKEN_KEY as string)
    .update(token)
    .digest("hex");

/**
 * Constant-time comparison for stored secrets. The Node primitive throws on a
 * length mismatch (unequal lengths cannot be compared in constant time); every
 * throw is reported as a plain mismatch, never leaked to the caller.
 */
export const constantTimeEqual = (a: string, b: string): boolean => {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};
