# AttendPro M1 — Kiosk Security Design

- **Date:** 2026-10-16
- **Baseline commit:** `f87ce1d`
- **Milestone:** M1
- **Owner:** Security Agent
- **Scope:** the QR badge plus PIN kiosk described in PRD §10, with §16 for recovery and §20 for privacy.
- **Status:** design only. No production code, no schema, no migration.

**Revision 2026-10-16.** The owner's M1 design review on this date replaced SMS one-time
codes with a QR badge plus a PIN. The earlier draft of this document was OTP-based and is
superseded. Every control below is written to the confirmed decisions O2 to O8 in
`docs/attendpro/DECISION-REGISTER.md`. Nothing here is provisional. Email codes still exist
for account recovery (O6), and they are not part of kiosk clock-in.

---

## 0. Confirmed decisions carried in

These rows are owner-confirmed on 2026-10-16. This document designs to them as settled, not as
defaults.

| Ref | Confirmed decision |
|-----|--------------------|
| O2 | Attendance verification is the employee QR badge plus a PIN. SMS one-time codes are not used for kiosk clock-in. Email codes are for account recovery only. The PIN is stored as a secure hash, with attempt limits, rate limits, temporary lockouts, and an audited HR reset. |
| O3 | An administrator generates a one-time pairing code in the dashboard; it expires after 10 minutes; entering it on the shop phone pairs the device and issues a kiosk token. Token lifetime 30 days, renewed on use, maximum age 90 days then re-pair. An administrator can revoke a device from the devices page. The server checks device and token status on every request. |
| O4 | QR identifies the badge; the attempt records a timestamp and a location assessment. Each site has a geo-fence (centre plus radius; 150 m is an example, not mandatory). Every attempt records its location assessment. Outside the fence is flagged for review, not blocked. Poor accuracy gives "location unknown", never "outside". Location is one control among several and is not proof of identity. |
| O5 | The server generates a long random QR credential and stores only a hash, shown once for printing. The original is not recoverable. Reissue revokes the previous credential. Deactivated employees hold no usable credential. A QR alone never authorizes a punch. |
| O6 | Email recovery code: six digits, ten-minute expiry, single use, lock after five incorrect attempts, resends no more often than once every 60 seconds, stored hashed, rate limited, no account enumeration. Account recovery only. |
| O7 | Failed verification and recovery, in order: HR resets a forgotten PIN through an audited process; a lost or broken badge is reissued and the old credential revoked; other failures go to a correction request. A failed attempt is never a successful punch, and evidence of the failure is preserved without fabricating a record. |
| O8 | An automatic clock-out job runs every 15 minutes. An open session past scheduled shift end plus a buffer (default two hours) is closed at the scheduled shift end and flagged. With no shift assigned it closes after a maximum duration (default 14 hours). Overnight shifts belong to the day they start and are evaluated on the actual shift interval. The job is idempotent, never overwrites a genuine clock-out, and leaves an audit trail and review flag. |

---

## 1. Threat summary

The kiosk sits in a shared workplace, on a phone the business controls but does not physically
guard at all times. The design answers six threats.

1. **Copied or photographed QR badge.** A QR alone must not authorize a punch. A photograph of a
   badge is a copy of an identifier, and it is cheap to take. The PIN is the control that stops a
   copied badge from producing a punch.
2. **Rogue device.** A page or phone that is not a paired kiosk must not create attendance. A
   pairing code plus a device token is the control that bounds this.
3. **PIN guessing.** A short numeric PIN has low entropy. Unlimited attempts defeat it. Attempt
   limits, rate limits, and temporary lockouts are the controls.
4. **Duplicate or replay submission.** A double tap, a retry, or a resend of the same request must
   not create two punches. A single-use verification session is the control.
5. **Session inheritance between employees.** The next person at the kiosk must not inherit the
   previous employee's half-finished session. Short expiry, single use, and a client clear are the
   controls.
6. **Location spoofing or inaccuracy.** A reported position can be wrong, stale, coarse, or
   deliberately faked. The location assessment is a risk signal that is recorded and flagged, not a
   gate that claims to prove presence (O4).

---

## 2. Kiosk pairing and token lifecycle (O3)

A kiosk is a `KioskTerminal` row owned by one business. It authenticates as a device, separately
from the employees who use it. The pairing flow replaces the earlier registration-plus-secret flow.

### 2.1 Pairing-code generation

An administrator opens the devices page and starts a pairing. The backend:

1. Creates or reuses the `KioskTerminal` row with `businessId`, a human label, and
   `state = PENDING_PAIRING`.
2. Generates a one-time pairing code with a CSPRNG and stores only `pairingCodeHash`, keyed with a
   server-side pairing key (`KIOSK_PAIRING_KEY`). The plaintext code is shown once in the dashboard.
3. Sets `pairingCodeExpiresAt = now + 10 minutes`.
4. Records the issuing administrator and the timestamp.

A pairing code that is not used inside its 10 minutes expires. Generating a new code for the same
row replaces the previous `pairingCodeHash` and expiry, so at most one code is live per terminal.

### 2.2 Redemption

On the shop phone, the operator enters the pairing code. The backend:

1. Looks up the pending terminal and checks `pairingCodeExpiresAt` has not passed and
   `state = PENDING_PAIRING`.
2. Recomputes the keyed hash over the submitted code and compares with `pairingCodeHash` in
   constant time.
3. On a match, clears `pairingCodeHash` and `pairingCodeExpiresAt` so the code cannot be reused,
   sets `state = ACTIVE` and `pairedAt = now`, and issues a kiosk token.
4. On a mismatch or expiry, refuses with a safe error (§10) and leaves the terminal pending.

### 2.3 Token issue and fields

The token is a random opaque credential. The backend stores only `tokenHash` (keyed with
`KIOSK_TOKEN_KEY`) and tracks:

| Field | Meaning |
|-------|---------|
| `tokenHash` | Keyed hash of the current token; the plaintext is never stored or logged. |
| `tokenVersion` | Incremented on every reissue or revocation so stale tokens fail at once. |
| `tokenIssuedAt` | When the current token was issued. |
| `tokenExpiresAt` | `tokenIssuedAt + 30 days`, moved forward on use. |
| `lastSeenAt` | Last authenticated request from this device. |

### 2.4 Renewal and maximum age

- Lifetime is 30 days.
- Each authenticated request renews the window: `tokenExpiresAt = now + 30 days`.
- Renewal does not extend a token past 90 days from `tokenIssuedAt`. The maximum age is 90 days.
- At or past 90 days, the device must re-pair through a fresh pairing code. The token is refused and
  the terminal returns to `PENDING_PAIRING`.

### 2.5 Server recheck on every request

A kiosk middleware runs before any attendance logic:

1. Verifies the token is present and matches a `tokenHash`.
2. Loads the `KioskTerminal` row and confirms `state = ACTIVE`, `tokenVersion` is current, and
   `tokenExpiresAt` has not passed.
3. Confirms the device belongs to the business named on the request and that the employee being
   identified is in the same business.
4. Updates `lastSeenAt` and the renewal window.
5. Refuses with a safe error if any check fails.

A signed or stored token proves who was authorized when it was issued, not that they still are.
The server therefore rechecks the row on every request, the same way the account is reloaded today
so a deactivation ends a session at once.

### 2.6 Tenant binding

A kiosk of business A must never create attendance for an employee of business B. The check in
§2.5 step 3 enforces this server-side. It does not depend on the device choosing the right request,
and it does not depend on any hidden field. The backend decides.

### 2.7 Revocation

See §9. Revocation increments `tokenVersion`, so the device fails on its next request.

---

## 3. QR credential design (O5)

Each employee holds one active QR credential at a time, stored as a `QrCredential` row.

### 3.1 Format

The server generates a long random credential from a CSPRNG and encodes it for printing. The QR
payload carries a schema version byte and the random token. It carries no employee id, no business
id, no name, and no expiry in the clear. Anyone who photographs the QR learns a random string and
nothing else.

### 3.2 Storage and lookup

The backend stores only a hash of the token, keyed with a server-side QR key (`QR_SECRET_KEY`).
Lookup hashes the presented token and matches the stored hash in constant time. Because the token is
random and hashed, a stolen copy of the database does not yield usable QR codes, and the employee id
is recovered by the row lookup, not from the payload.

### 3.3 Lifecycle

| Event | Effect |
|-------|--------|
| Issued | A new active `QrCredential` row for the employee. The plaintext is shown once for printing and is not recoverable. |
| Reissued | The previous credential is revoked in the same transaction. One active credential per employee. |
| Revoked | Lookup fails from that moment. |
| Employee deactivated | All of that employee's credentials are revoked, so a deactivated employee holds no usable credential. |

A lost or broken badge is handled by reissue, which revokes the old credential (O7). Reissue is an
audited action.

### 3.4 What the QR does not do

The QR identifies a candidate employee. It does not authenticate them and does not authorize a
punch. A QR alone never authorizes a punch (O5). Section 5 supplies the second factor.

---

## 4. Verification session model

A `VerificationSession` is short-lived and stateful. It ties one QR presentation to one PIN entry to
at most one punch.

### 4.1 Creation

On QR submission with a valid kiosk token, the backend:

1. Verifies the kiosk (§2.5).
2. Resolves the QR token to an employee (§3.2) and confirms the employee is active and in the
   kiosk's business.
3. Computes the permitted action for display.
4. Creates a `VerificationSession` row with a hashed random session id, `businessId`, `employeeId`,
   `kioskId`, `state = QR_ACCEPTED`, and an expiry.

### 4.2 State machine

```
QR_ACCEPTED --(PIN entry begins)--> PIN_PENDING --(PIN matches)--> VERIFIED
     |                                   |                            |
     |                                   |--(attempts exhausted)--> LOCKED
     |                                   |--(expiry)-------------> EXPIRED
     |--(expiry)-------------------------------------> EXPIRED
VERIFIED --(punch persisted, or a second call) --> CONSUMED
```

Only `VERIFIED` may transition to a persisted punch, and that transition is single-use: it moves the
session to `CONSUMED` in the same transaction. A second attempt to use `VERIFIED` finds `CONSUMED`
and is refused. `LOCKED` and `EXPIRED` are terminal and can never reach a punch.

### 4.3 Lifetime and storage

The session has a short lifetime measured in minutes. The session id returned to the kiosk is hashed
at rest, so a leaked database does not yield a usable session handle. The session is bound to the
`kioskId` and `employeeId` that created it; presenting the session id from a different kiosk, or
against a different employee, fails.

### 4.4 Single use and clearing between employees

Two mechanisms keep a finished session from being reused:

- **Server side:** a session is single-use and expires in minutes. It cannot be reused by the next
  person even if the browser keeps it.
- **Kiosk side:** after a result is displayed, on cancel, or after a short idle period, the kiosk
  drops all local state (session id, PIN buffer, employee display) and returns to the ready screen.

The server does not trust the client to clear. A stale session id is refused because the session is
`CONSUMED` or expired, which is the control that matters.

---

## 5. PIN verification (O2)

The PIN is the second factor that turns a candidate employee into a verified one. A PIN entry is
bound to the session created by a QR scan.

### 5.1 Storage

A PIN is a short numeric secret, so it has low entropy. A bare hash is not acceptable: a hash of a
few thousand possible PINs is a table anyone can precompute, and an unsalted hash leaks the PIN to
anyone who reads the column. The design therefore stores a keyed hash with a per-record salt and
never a bare hash.

Each PIN record stores:

- the PIN as `HMAC-SHA-256(key = PIN_HMAC_KEY, message = employeeId || pin || randomSalt)`;
- a random per-record salt;
- `failedAttempts`, `lockedUntil`;
- `updatedAt` and the actor for the last reset.

`PIN_HMAC_KEY` is a server secret held in the environment (`process.env.*`), never in code and never
logged. The keyed hash makes a precomputed table useless without the key, and the salt means two
employees with the same PIN do not share a stored value.

### 5.2 Verification

On PIN submission, the backend:

1. Loads the session by its hashed id and confirms it is unexpired and not `LOCKED` or `CONSUMED`.
2. Recomputes the keyed hash of the submitted PIN and compares with the stored value in constant
   time, so the time to reject a wrong PIN does not reveal how many digits were right.
3. On a match: marks the session `VERIFIED`, clears the failure counter, and proceeds to the punch.
4. On a mismatch: increments `failedAttempts` and the session attempt counter. At the limit, moves
   the session to `LOCKED`, sets a temporary lockout on the employee PIN, writes an audit event, and
   refuses further attempts until the lockout passes.
5. On an expired session: refuses and requires a fresh QR scan.

### 5.3 Attempt limits, lockout, and rate limits

The attempt limit bounds guessing within one session. The temporary lockout and the employee-keyed
rate limits (§7) bound guessing across sessions. Locks are temporary and lift on their own; they do
not require HR. The exact length, the attempt count before lockout, and the lock duration are open
items for the owner (R5).

### 5.4 Audited HR reset (O7)

A forgotten PIN is reset by HR through an audited process, in this order:

1. HR resets the forgotten PIN. The reset is audited with the actor, the target employee, the time,
   and the reason.
2. A lost or broken badge is reissued and the old `QrCredential` is revoked (§3.3).
3. Any other failure goes to a correction request.

HR never sees the old PIN and never re-enters it. A failed attempt is never a successful punch, and
the failure evidence is preserved without fabricating an attendance record (O7).

---

## 6. Location assessment and geo-fencing (O4)

A punch records a location assessment, not a proof of presence. Location is one control among
several, and it is not used to claim identity.

### 6.1 Required fields per attempt

Every `AttendanceAttempt` records:

| Field | Meaning |
|-------|---------|
| `latitude`, `longitude` | Coordinates reported by the device, when available. |
| `accuracyMeters` | Reported accuracy radius, when available. |
| `capturedAt` | Timestamp the position was captured on the device. |
| `receivedAt` | Server receipt timestamp. |
| `siteId` | The site whose geo-fence was evaluated against, when a site applies. |
| `distanceMeters` | Distance from the site centre. |
| `locationResult` | `INSIDE`, `OUTSIDE`, or `UNKNOWN`. |
| flags | Any review flags raised for this attempt. |

### 6.2 Inside, outside, and unknown rules

Each `Site` holds `latitude`, `longitude`, and `radiusMeters`. A radius of 150 m is an example, not
mandatory (O4). The evaluation is:

- **`INSIDE`** when a position is present, fresh enough, accurate enough, and within the radius.
- **`OUTSIDE`** when a position is present, fresh enough, accurate enough, and beyond the radius.
- **`UNKNOWN`** when no position is available, the accuracy is poor, or the capture is too stale to
  trust.

Poor accuracy gives `UNKNOWN`. It never gives `OUTSIDE`. A coarse fix is not evidence that the
employee is away from the site, and the design must not report it as if it were.

### 6.3 Flag, do not block

`OUTSIDE` is flagged for review, not blocked (O4). A genuine worker is never stopped from clocking
in by a location mismatch; the attempt is recorded with its `locationResult` and raised as a review
flag. `UNKNOWN` is recorded as well and handled the same way.

### 6.4 Anti-spoofing signals

Signals such as an implausible speed between attempts, a position that repeats exactly, or an
accuracy value that does not move are treated as risk indicators. They raise a flag and add detail to
the audit record. They are not proof. The design does not claim that a reported position is
impossible to fake; it claims that the position is recorded, assessed, and reviewable. Flagged
attempts are reviewed by HR like any other exception.

---

## 7. Rate limits per kiosk and per employee

The current server rate-limits by IP. IP alone is a poor fit for a kiosk: one kiosk is one IP and
serves everyone, so an IP cap either blocks legitimate use or fails to bound per-employee abuse. The
design adds two keyed limiters alongside the IP limiter, both disabled under `NODE_ENV=test` for the
same reason the existing limiters are.

| Limiter | Key | Purpose |
|---------|-----|---------|
| Kiosk identify | `kioskId` | Stops one device spraying QR lookups. |
| Pin verify | `employeeId` | Bounds PIN guessing across sessions; complements the per-session attempt limit. |
| Pairing redeem | `kioskId` and IP | Bounds pairing-code brute force over the 10-minute window. |
| Token auth | `kioskId` | Bounds token brute force. |

The employee-keyed limit is the important one. A kiosk-keyed limit does not stop one employee
grinding attempts, and an IP limit does not stop an attacker moving between kiosks. Keying on the
employee closes the guessing lane; keying on the kiosk closes the mass-trigger lane. Exact numbers
are set with the PIN policy (R5) and reviewed before release.

---

## 8. Session expiry and clearing between employees

- Verification sessions expire in minutes and are single-use.
- The kiosk clears its screen and local state after every result, on cancel, and after a short idle
  period.
- The ready screen shows only generic instructions. It never shows the previous employee's name,
  shift, or status.
- Error screens show a short, non-identifying message (§10).
- The kiosk token persists on the device, as it must, but it carries no employee identity, so a
  lingering token is not a lingering employee session.

The idle reset is a client behaviour and is therefore a usability guard, not a security boundary. The
security boundary is the server-side single-use and expiry.

---

## 9. Device revocation

An administrator can revoke a device from the devices page (O3). Revocation:

1. Sets `state = REVOKED` on the `KioskTerminal` row and increments `tokenVersion`, so the current
   `tokenHash` no longer matches.
2. Takes effect on the device's next request, because the row is rechecked on every call (§2.5). The
   device fails before the 30-day token would have expired.
3. Does not delete any attendance record the device created. History is preserved.
4. Is an audited action, recording who revoked and when.
5. Requires a fresh pairing to bring the device back. Re-pairing issues a new token; the old token
   stays dead because `tokenVersion` moved.

A terminal that passes its 90-day maximum age moves to `EXPIRED` and is treated the same way as a
revoked device until it re-pairs.

---

## 10. Safe error messages

A failure tells the employee what to do next and tells an attacker nothing.

| Condition | Kiosk shows | Server returns |
|-----------|-------------|----------------|
| Unknown QR token | "Badge not recognised. See HR." | 404, no employee detail |
| Revoked QR token | "This badge is no longer valid. See HR." | 403 |
| QR of another business | "Badge not recognised." (same as unknown) | 404 |
| Inactive employee | "This account is not active. See HR." | 403 |
| Revoked or unknown kiosk | Kiosk cannot proceed; contact administrator | 401 |
| PIN wrong | "That PIN is not correct. Try again." | 400, attempts left not disclosed |
| Session expired | "Start again. Scan your badge." | 400 |
| Attempts exhausted | "Too many tries. Try again later or see HR." | 429 |
| PIN temporarily locked | "Try again later or see HR." | 429 |
| Pairing code expired | "That code expired. Ask an administrator for a new one." | 400 |
| Pairing code wrong | "That code is not correct." | 400 |
| Internal fault | "Something went wrong. Try again." | 500 |

Deliberate choices:

- An unknown QR and a cross-business QR return the same message, so the kiosk does not confirm
  whether a token exists elsewhere.
- The response never includes the employee id, badge value, phone number, or attendance state.
- Internal faults return a generic message. The kiosk routes must not return `error.message` in 500
  bodies, which PRD §20 rules out.
- The number of attempts remaining is not returned, so an attacker cannot use the countdown as a
  signal.

---

## 11. Audit events

The kiosk writes these events. None of them contains a PIN, a pairing code, a token, or a badge
value.

| Event | Recorded fields | Notes |
|-------|-----------------|-------|
| `kiosk.pairing_code_issued` | actorUserId, kioskId, expiresAt | No code value |
| `kiosk.paired` | kioskId, businessId, ip | Pairing code redeemed |
| `kiosk.token_renewed` | kioskId, tokenIssuedAt, tokenExpiresAt | Max age not exceeded |
| `kiosk.token_rejected` | kioskId, reason, ip | Expired, revoked, or wrong version |
| `kiosk.expired` | kioskId, tokenIssuedAt | Past 90-day maximum age |
| `kiosk.revoked` | actorUserId, kioskId, reason | Device revoked |
| `qr.identify_failed` | kioskId, reason, ip | No badge value |
| `qr.reissued` | actorUserId, employeeId | Old credential revoked |
| `verify.session_started` | sessionId (opaque), kioskId, employeeId | |
| `pin.verify_failed` | sessionId, employeeId, attemptCount | No PIN value |
| `pin.locked` | sessionId, employeeId, lockedUntil | Attempts exhausted |
| `pin.hr_reset` | actorUserId, employeeId, reason | O7 audited reset |
| `verify.succeeded` | sessionId, employeeId, kioskId | |
| `verify.expired` | sessionId, employeeId | |
| `attendance.recorded` | attendanceId, employeeId, kioskId, action, locationResult | Action and result |
| `attendance.location_flagged` | attemptId, employeeId, siteId, distanceMeters, locationResult | Outside or unknown |
| `attendance.auto_closed` | attendanceId, employeeId, closedAt, reason | O8 auto clock-out |
| `email.recovery_issued` | employeeId, ip | Account recovery only, no code |

Every row carries a correlation id, a timestamp, and the business id. Events are written for both
success and failure, because a failure must be recorded without the secret on it (O7).

---

## 12. Control-to-PRD map

Each control below names the clause it satisfies.

| Control (this doc) | PRD clause | How it satisfies the clause |
|--------------------|------------|-----------------------------|
| QR identifies, PIN authorizes | §10.3 bullet 1 | A punch needs a matching PIN on a live session; a QR alone is a candidate, not an authorization |
| Pairing code and device token | §10.3 bullet 2 | Only a paired kiosk with a valid token reaches attendance logic |
| Random hashed, revocable QR | §10.3 bullet 3 | Random tokens defeat guessing; hashing limits database leaks; revocation defeats reuse |
| PIN attempts, lockout, limits | §10.3 bullet 4 | Per-session attempt limit plus a temporary lockout and employee-keyed limits |
| Failure creates nothing | §10.3 bullet 5 | Only a `VERIFIED` session can persist a punch; failures are audited, not turned into records |
| Idempotent punch | §10.3 bullet 6 | Single-use verification plus the attendance unique constraint |
| Session expiry and clear | §10.3 bullet 7 | Short server expiry, single use, client clear |
| Device revocation | §10.3 bullet 8 | Row rechecked every call; revoked device refused at once |
| Location assessment | O4, §20 | Every attempt records its assessment; outside is flagged, not blocked; poor accuracy is `UNKNOWN` |
| Safe error messages | §16 item 1, §20 | See §10 table |
| Bounded attempts and resends | §16 item 2 | PIN attempt limit, lockout, employee-keyed limits |
| Record failure without secrets | §16 item 3 | Audit table in §11 stores no PIN or code |
| HR-assisted recovery | §16 items 4-6, O7 | Audited HR PIN reset records actor and reason |
| QR not a fallback | §16 closing line | Recovery is an HR action, not a QR-only path |
| Tenant binding | §5 rules 6-8 | Kiosk, employee, and session must share a business id, checked server-side |

---

## 13. Open items for the owner

Only the reference items from the decision register remain open. They do not block the security
model; they set values inside it.

1. **R1 — GPS accuracy and stale location.** The acceptable accuracy threshold (for example ≤ 50 m)
   and the definition of a stale capture (for example older than 60 s). The recommendation is a safe
   default with a per-business override.
2. **R3 — Scan surface.** Whether the QR is scanned on the kiosk phone only, the employee personal
   phone only, or both. This changes the security model and cannot be assumed.
3. **R5 — PIN policy specifics.** Length, the attempt count before lockout, the lockout duration, and
   the evidence kept for an HR reset. The recommendation is six digits, five attempts, a 15-minute
   lockout, and an audited HR reset.
