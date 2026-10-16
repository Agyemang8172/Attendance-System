# Implementation Plan: AttendPro M5 — Kiosk Pairing, QR+PIN, Location Assessment, Atomic Punch

- **Date:** 2026-10-16
- **Milestone:** M5 (kiosk: pairing, QR+PIN verification, location assessment, atomic punch, tenant isolation)
- **DependsOn:** M4 (committed `f2db8e4`) + post-M4 audit findings absorbed in Phase 0
- **Status:** Draft — awaiting owner approval
- **Target:** AttendPro v1 backend
- **Authority:** `docs/attendpro/M1-KIOSK-SECURITY.md`, `M1-API-CONTRACTS.md` §7–§8, schema models `KioskTerminal`, `VerificationSession`, `AttendanceAttempt`

---

## Overview

M5 turns the QR+PIN kiosk design into working endpoints. No new tables — every kiosk model already exists from M2. Three new capabilities:

1. **Device lifecycle** — a SUPERADMIN generates a one-time pairing code; the shop phone pairs itself and receives a 30-day kiosk token; tokens renew on use (90-day hard age), devices can be revoked.
2. **Employee identification** — a paired kiosk reads a QR badge, evaluates the badge against `qr_credentials`, evaluates the punch location against the site fence, and opens a short-lived verification session. A PIN then turns the session into a verified one.
3. **Atomic punch** — the verified session is consumed by exactly one clock-in or clock-out, inside one transaction with the attempt row and the audit row.

Phase 0 first cleans up the defects the post-M4 audit found, so the kiosk flows sit on the status engine rather than next to its holes.

---

## Phases & Tasks

### Phase 0: M3/M4 hardening (audit findings) — all backend, no schema changes

- [ ] **0.1 Status engine correctness** (`backend/utils/statusEngine.ts`, `backend/validators/index.ts`)
  - Early-grace wrap-around: compare against `(startMinute - grace + 1440) % 1440` so a 00:05 shift start classifies a 23:50 clock-in as EARLY, not LATE.
  - Same-evening guard in `evaluateClockOutStatus` for cross-midnight shifts: a clock-out still after `startMinute` is a normal early departure, not `CLOCK_OUT_MISSING`.
  - Validators: `crossesMidnight` must be true exactly when `endMinute < startMinute` (`createShiftSchema` refine); PATCH `updateShiftSchema` re-validates the merged stored+incoming geometry in `updateShift`.
- [ ] **0.2 Wire the engine into clockOut** (`backend/controllers/attendanceController.ts`)
  - `clockOut` loads the shift the same way `clockIn` does and applies `evaluateClockOutStatus`, so `CLOCK_OUT_MISSING` becomes reachable.
  - Unify the date basis: the `date` slot and the engine both read from UTC now (business timezone comes in the follow-up already flagged as O15).
- [ ] **0.3 Shift-scoped policies in clockIn** — look up a policy bound to the caller's `shiftId` first, then fall back to the business default (`WorkplacePolicy.shiftId` already exists).
- [ ] **0.4 Error-response hardening** — every M3/M4 catch block ends `if (error instanceof Error) {...} else { res.status(500)... }` so a non-Error throw cannot hang a request; drop `error`/`error.message` from 500 response bodies (keep the detail in `logError`), matching `server.ts`'s own practice.
- [ ] **0.5 Deduplicate `callerBusinessId`** (6 copies) — move one copy to `backend/utils/tenant.ts` and import it everywhere; Phase 1 also puts it to work in the kiosk controllers.
- [ ] **0.6 Policy default race** — compute `isDefault` inside the `createPolicy` transaction and map its P2002 to a distinct "another calendar/policy is already default" 409 via `err.meta.target`.
- [ ] **0.7 Kiosk session invalidation on PIN reset** (M4 reviewer MINOR-6) — the audited reset also expires open `VerificationSession` rows for the employee.
- [ ] **0.8 Cosmetic** — replace the `✓` glyphs in `docs/attendpro/previews/design-comparison.html` with an inline SVG so ui-taste passes clean.

Owner decisions folded here (from the record audit — answered before Phase 1, or deferred explicitly):
- **RLS wrapper:** the migrations are fail-closed on `app.business_id`, but no application code sets it. Phase 4P (optional, after a DB exists) adds `withTenant()`; until O14 supplies a test database the wrapper is written but flagged unverified.
- **`authenticate_lookup`:** either wire login to the SQL function now or record the deferral. Default in this plan: deferral note on the board (function stays proper SQL; login flow already works), revisit at the O14 rehearsal.

### Phase 1: Device lifecycle (`/api/kiosk/pairing-codes`, `/pair`, `/token/renew`, `/devices`, `/devices/:id/revoke`)

- [ ] **1.1** `backend/middleware/kioskAuthMiddleware.ts` — device-token middleware: bearer token, key on `tokenHash`, terminal `state = ACTIVE`, `tokenVersion` current, business active; updates `lastSeenAt`. Attaches `req.kiosk = { kioskId, businessId }`. Fails closed without a key.
- [ ] **1.2** `backend/controllers/kioskDeviceController.ts`
  - `createPairingCode` (SUPERADMIN): label ≤80, optional siteId in tenant; transaction creates or reuses the terminal row `PENDING_PAIRING`, stores only `HMAC-SHA-256(KIOSK_PAIRING_KEY, code)`; code visible once; 10-minute expiry; audit.
  - `pair` (public, rate-limited): constant-time compare of the re-computed hash; on match clear code+expiry, `state = ACTIVE`, `pairedAt`, store `tokenHash` + `tokenIssuedAt/tokenExpiresAt` (now+30d), issue kiosk token JWT carrying `{ kind: "kiosk", kioskId, businessId, tokenVersion }`; audit `kiosk.paired`. Same generic 400 for wrong and expired.
  - `renewToken` (kiosk): recheck terminal every call; `tokenExpiresAt = now+30d`, rotate `tokenHash`, bump token counters, audit `kiosk.token_renewed`; `tokenIssuedAt > 90 days` → back to `PENDING_PAIRING` and 401.
  - `listDevices` / `revokeDevice` (SUPERADMIN): revoke flips state, bumps `tokenVersion`, sets `revoked_at/by`, reason; audit `kiosk.revoked`.
- [ ] **1.3** `backend/routes/kioskDeviceRoutes.ts`, validators (pairing body, site/uuid params), rate limits per `M1-KIOSK-SECURITY.md` §8 alongside the existing limiters.

### Phase 2: Identify + location assessment (`/api/kiosk/identify`)

- [ ] **2.1** `backend/utils/location.ts` — pure distance (haversine) + assessment vs the kiosk's site: `INSIDE` inside `radiusMeters` (+ `geofenceRadiusSpan`); `OUTSIDE` beyond with a `nearMiss` flag inside a small margin; `UNKNOWN` when fields absent/implausible (accuracy 0–500m, capturedAt not in the future, staleness threshold per R1's defaults). Flag, never block (`AttendanceAttempt.locationResult`).
- [ ] **2.2** `backend/controllers/kioskVerifyController.ts` `identify`:
  - kiosk middleware verified → hash `qrToken` → match `qr_credentials` where `revoked_at IS NULL`
  - employee active and in the kiosk's business, else the same 404 for unknown and cross-business
  - derive the permitted action from current state (no open session ⇒ CLOCK_IN; open session ⇒ CLOCK_OUT)
  - one transaction: `INSERT verification_sessions` (hashed session handle, `QR_ACCEPTED`, 2-minute expiry) + `INSERT attendance_attempts` (step IDENTIFY, location fields, `locationResult`)
  - response: `{ sessionId, employeeDisplayName, permittedAction, locationResult }` — no employee id, no PIN material; audit `verify.session_started`
- [ ] **2.3** Rate limits: per kiosk on identify, per employee on PIN (kiosk §7–§8).

### Phase 3: PIN verification (`/api/kiosk/verify-pin`, `/api/kiosk/cancel`)

- [ ] **3.1** `verifyPin`: session must belong to this kiosk, state `QR_ACCEPTED`/`PIN_PENDING`, unexpired; constant-time compare of `HMAC-SHA-256(PIN_HMAC_KEY, employeeId||pin||pinSalt)` against `User.pinHash`; match moves the session to `VERIFIED` and clears `pinFailedCount`; mismatch increments session + user counters and audits `pin.verify_failed`, and at the attempt limit sets `LOCKED` + `pinLockedUntil` and audits `pin.locked`. Response reveals only `result/action/status` — never attempts-left.
- [ ] **3.2** `cancel`: flips the bound session to `EXPIRED`; audit.
- [ ] **3.3** The old-credential audit rule stays: a bad PIN attempt never fabricates a punch.

### Phase 4: Atomic punch (`/api/attendance/clock-in`, `/api/attendance/clock-out` rework)

- [ ] **4.1** Rework both routes to kiosk-token scope (contract §8, §12 transfer):
  - body `{ verificationSessionId, latitude, longitude, accuracyMeters, capturedAt }`
  - session must be `VERIFIED`, unexpired, unconsumed, bound to this kiosk; lock the session row and set `CONSUMED`
  - resolve shift (dated `ShiftAssignment`) and policy (shift-scoped, then default) at punch time
  - one transaction: `INSERT attendances` (with shift/policy snapshots + `timezoneSnapshot`) + `INSERT attendance_attempts` (location fields, `locationResult`, step) + audit
  - `OUTSIDE`/`UNKNOWN` still record the punch and flag it (`attendance.location_flagged`), per kiosk §6.1 "flag not block"
  - clock-out computes `hoursWorked`, applies `evaluateClockOutStatus`, closes the session
  - 409 when an open session already exists on clock-in
- [ ] **4.2** Legal-alias answer (contract §14 open item): the legacy session- or user-token-punched `clock-in/clock-out` shapes become kiosk-only; `my-attendance`/`all-attendance` reads stay as read-only aliases — removed only if the owner says so.
- [ ] **4.3** Correction submission `POST /api/attendance/corrections` (self, window from the active policy, `reviewTier` computed, `originalValues` snapshot); the decision endpoint (`PATCH /api/hr/corrections/:id/decision` with backstop rules, R7-provisional) is NOT in M5 — it lands with the M6/HR area rather than half-building the backstop logic.

### Phase 5: Configuration & env

- [ ] **5.1** `.env.example` (root): `KIOSK_PAIRING_KEY` (fail-closed like the other two keys). Rate-limit module knobs if the kiosk limits need one (kiosk §8).

### Phase 6: Verification (the same gate run as M4, through the orchestrator)

- [ ] **6.1** Implementation review agent re-reviews the M5 change set against the kiosk spec (read-only) before any commit; its findings are applied first.
- [ ] **6.2** Docs agent extends `docs/TESTING_GUIDE.md` (pairing walkthrough, identify→verify-pin→punch happy path, lockout, revoke, cross-tenant quarantine) and the docs pass `humanize-check.sh`.
- [ ] **6.3** `npx tsc --noEmit` = 0 errors, `npx prisma validate` valid, `db-check.sh` pass, env parity pass with the new key documented.
- [ ] **6.4** Commit through `.agents/scripts/commit.sh` only after the owner has seen the review summary. Nothing pushed. No database run (O14 remains blocked).

---

## Blocked / owner decisions surfaced by the audits

| # | Item | Owner needed |
|---|------|--------------|
| 1 | R5 PIN length/lockout/reset-evidence details (code currently uses 6 digits, 5 attempts idea unconfirmed) | Yes — Phase 3 constants |
| 2 | R1 GPS stale/accuracy thresholds (plan uses doc defaults until then) | Yes — Phase 2 values |
| 3 | RLS wrapper in app code: build now unverified, or wait for O14's test DB | Yes — Phase 4P placement |
| 4 | `authenticate_lookup` rewire or defer | Yes — Phase 0 deferral note (default: defer) |
| 5 | Legacy `my-attendance`/`all-attendance` aliases keep or remove | Yes — Phase 4.2 |

## Constraints

- No new migrations or schema changes (M2 tables already exist)
- All writes tenant-scoped by `business_id`; cross-tenant answers are 404, never existence-confirming
- No destructive git or DB operations; no push; root history preserved
- Rate limiting per kiosk §8, disabled under `NODE_ENV=test`
- Every endpoint that touches a secret key fails closed
