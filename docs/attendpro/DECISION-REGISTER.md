# AttendPro — Open Decision Register

Every row needs an owner decision before the milestone in the last column can be built.
Recommendations are drawn from the PRD and the M0 evidence. A recommended answer is a
proposal, not a decision.

| ID | Decision | Options | Recommendation | Blocks | State |
|----|----------|---------|----------------|--------|-------|
| O1 | Business onboarding | (a) self-serve registration from the public site, (b) SUPERADMIN created by an operator, (c) invite-only | (b) for the first release: a known operator creates each business and its first SUPERADMIN, so no public sign-up surface ships | M1 design, M4 | Open |
| O2 | SMS provider (Ghana) | Any Ghana-capable gateway with a sandbox | Choose one with a sandbox and delivery receipts; wrap it behind a provider interface so it can be swapped | M3, M5 | Open |
| O3 | Kiosk device authentication | (a) per-device API key, (b) signed device token issued at registration, (c) mutual TLS | (b): a long-lived device secret issued at registration, stored hashed, revocable | M3, M5 | Open |
| O4 | QR format | (a) random opaque token per employee, (b) signed payload with employee id, (c) rotating token | (a): a random opaque token, stored and revocable, with no embedded employee id | M3, M5 | Open |
| O5 | QR issuance | (a) SUPERADMIN generates and prints, (b) HR generates, (c) system emails | (a) initially; printing stays a business action | M4, M5 | Open |
| O6 | OTP policy | Length, expiry, max attempts, resend cap, lockout | 6 digits, 5-minute expiry, 5 attempts, 3 resends per window, then lockout to HR-assisted recovery | M5 | Open |
| O7 | SMS recovery | (a) HR-assisted override, (b) backup code, (c) QR-only fallback | (a): an HR-assisted, audited override where an HR user enters the punch on the employee's behalf. QR alone must never authorize a punch (§10.3) | M5 | Open |
| O8 | Auto clock-out trigger | (a) shift end + fixed offset, (b) shift end, (c) HR manual close | (a): a per-business offset from shift end, in the business timezone, flagged automatic | M4, M6 | Open |
| O9 | Reports and exports | Set of reports, formats, scheduling | Attendance register, punctuality summary, exception list; CSV export first | M7 | Open |
| O10 | Data retention | Retention window, deletion on request | Define a window (for example 7 years) with soft delete; align to the Ghanaian review (§20) | M2, M7 | Open |
| O11 | Platform-operations role | (a) none, (b) a separate platform admin outside the three business roles | (a) for the initial release: keep the three-role model; add a platform role only if operations demand it (§4.3) | M1 | Open |
| O12 | Session revocation | (a) token expiry only, (b) server-side revocation list, (c) short-lived access plus refresh | (c): short-lived access tokens with a refresh flow that can be revoked on deactivation (§15, §20) | M5 | Open |
| O13 | Nested `backend/.git` | (a) keep and leave untouched, (b) archive to a bundle then remove, (c) fold its history into the root repo | (b): export a bundle to a safe location, keep it referenced in the register, then remove the nested repo once the owner approves. Do not touch it before that | M2 | Open |
| O14 | Test database | (a) local Postgres container, (b) a separate schema on the dev database | (a): an isolated database so the suite can no longer write to development data (F7) | M2 | Open |

## Meta-decisions already settled

- Execution stays interactive; the Orchestrator lock remains on.
- Do not push to `origin` until the owner approves.
- Biometrics stay out of scope.
- No universal grace period and no universal 23:59 auto-clock-out rule.
- Gate scripts stay on the maintained Windows-safe versions.
