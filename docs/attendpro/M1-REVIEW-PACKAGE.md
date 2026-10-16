# AttendPro M1 — Review Package

- **Date:** 2026-10-16
- **Milestone:** M1
- **Status:** pending owner review. M1 is not approved, and M2 is not authorized.
- **Baseline commit:** `f87ce1d`
- **Repository state:** M0 is committed as `c4ee602`. The M1 documents are written but uncommitted, `main` is seven commits ahead of `origin/main`, and nothing has been pushed or merged.
- **Owner:** this package is assembled for you. Every open decision below awaits your answer.

This file is the index for the review. It maps the seventeen deliverables you asked for to
the documents that carry them, records what changed since the 2026-10-15 draft, and lists
what is still open. It decides nothing.

---

## 1. What changed since the 2026-10-15 draft

The 2026-10-16 review replaced several provisional choices. The documents were reconciled
to match.

| Area | Before (2026-10-15) | Now (2026-10-16) | Ref |
|------|---------------------|------------------|-----|
| Attendance verification | SMS one-time code plus QR | QR badge plus a PIN, verified on the kiosk | O2 |
| SMS | One provider behind an adapter | No SMS provider in version one; email codes for account recovery only | O2, O6 |
| Kiosk credentials | A per-device secret exchanged for a token | A one-time pairing code (10 minutes) issuing a 30-day kiosk token, renewed on use, 90-day maximum | O3 |
| Location | Not recorded | Every attempt records a location assessment against a per-site geo-fence; outside is flagged, not blocked; poor accuracy is unknown | O4 |
| Leave | Leave types and requests in version one | Deferred to version two. Calendars, working days, off-days and absence stay | O16 |
| Platform role | A possible operator login | No platform-wide operator in version one | O11 |
| Business signup | Considered | No public self-registration; the owner creates business accounts | O1 |
| Corrections | A single review step | Seven-day window, same-day versus escalated review, no self-approval | O17 |
| Timing policy | Per-shift offsets | One business-wide late grace, effective-dated from the next midnight, never recalculated | O15 |
| Test database | "An isolated database" | Tests refuse to run unless the database name ends in `_test`, and the host is verified before a reset | O14 |
| Data model | 20 models, 8 migrations | 19 models, 9 migrations (leave out; `Site` and `EmailRecoveryCode` in) | O16, O4 |

---

## 2. The seventeen deliverables and where they live

| # | Deliverable | Document | Section |
|---|-------------|----------|---------|
| 1 | Product requirements and decision log | `DECISION-REGISTER.md` | A (O1–O18), B, C (R1–R9), D |
| 2 | System architecture | `M1-ARCHITECTURE.md` | whole |
| 3 | Database model and ERD | `M1-DATA-MODEL.md` | §1 entity map, §2 schema |
| 4 | Role and permission matrix | `M1-ROLE-PERMISSION-MATRIX.md` | §3 matrix, §4 routes, §5 screens |
| 5 | Screen inventory and UI designs | `M1-NAVIGATION-AND-SCREENS.md` | whole |
| 6 | Attendance state machine | `M1-ATTENDANCE-LIFECYCLE.md` | §10 |
| 7 | QR, PIN, kiosk and location verification | `M1-KIOSK-SECURITY.md` | whole |
| 8 | API contracts and validation rules | `M1-API-CONTRACTS.md` | §0–§14 |
| 9 | Automatic clock-out design | `M1-ATTENDANCE-LIFECYCLE.md` | §7; `M1-ARCHITECTURE.md` §4 |
| 10 | Shift, working-day, off-day and absence rules | `M1-ATTENDANCE-LIFECYCLE.md` | §5.3, §6; `M1-DATA-MODEL.md` §8 |
| 11 | Correction and audit design | `M1-ATTENDANCE-LIFECYCLE.md` §8 | `M1-DATA-MODEL.md` §9, §10 |
| 12 | Retention policy proposal | `M1-RETENTION-POLICY.md` | whole |
| 13 | Historical data migration plan | `M1-DATA-MODEL.md` | §3 status mapping, §4 migrations |
| 14 | Test strategy and acceptance criteria | `M1-SECURITY-AND-TEST-STRATEGY.md` | whole |
| 15 | Repository reconciliation plan | `M1-REPOSITORY-RECONCILIATION.md` | whole |
| 16 | Updated milestones and dependencies | `M1-MILESTONES-AND-DEPENDENCIES.md` | whole |
| 17 | Unresolved decisions with options and a recommendation | `DECISION-REGISTER.md` | C (R1–R9) |

The M0 evidence sits in `M0-REALITY-CHECK.md` and `M0-FORENSIC-RECONCILIATION.md`, and the
original PRD is `docs/ATTENDPRO_PRD.md`.

### 2.1 Addendum: the UI/UX workflow of 2026-10-16

Two further documents came out of the six-stage product-owner UI workflow, which runs
after the seventeen deliverables above. They audit the existing frontend and derive the
role experiences from it.

| Stage | Document | What it settles |
|---|---|---|
| 1 | `M1-UI-AUDIT.md` | What the current frontend does, screen by screen, with a file and line behind every claim |
| 2 | `M1-ROLE-EXPERIENCES.md` | What each role is trying to accomplish, the navigation that follows, and which screens are shared |
| 3 | `M1-VISUAL-DESIGN-SYSTEM.md` | The two design systems compared with measured contrast, industry suitability, and recommended direction; mockups in `previews/design-comparison.html` |
| 4 | `M1-SCREEN-DESIGNS.md` | Screen designs, dispositions, navigation flows, states, and responsive behaviour |
| 5 | `M1-UI-ARCHITECTURE-MAPPING.md` | UI → API → DB mapping, gaps, and state-error mapping |
| 6 | this package (final) | Consolidated approval package |

The second owner review (2026-10-16) recorded `O19` to `O24` in `DECISION-REGISTER.md`. Stage 5 surfaces four API gaps (G1–G4) and two defects (F8 status badge contrast on dark surfaces; F9 three competing status-palette specifications). Stage 4 is blocked on the owner's decision on final colour values. Stage 5 is blocked only if the escalation rules for `O21` are amended.

---

## 3. Verified facts kept apart from proposed design

The M0 documents separate what the repository actually contains from what the design
proposes. That separation is kept in every document: a confirmed decision carries its
register ref, a proposal is labelled as one, and a number that was chosen for the draft is
marked provisional.

Repository facts verified in M0: three models, one migration, no row level security,
`attendances.user_id` cascading on delete, a clean backend type check, forty-three frontend
type errors, no `typecheck` script, and a hardcoded `PRESENT` status in the existing
attendance controller.

Two things were not verified. The full forensic reports were summarised rather than
supplied, so their claims were re-checked against the repository where possible and are
otherwise marked as reconstructed. The `git log --oneline -20` output from each repository
is still owed by you, and the reconciliation plan stops without it (O13).

---

## 4. Conflicts found while reconciling

Reconciling the documents surfaced places where they disagreed. Most were fixed in place;
the ones that need you are listed here so nothing is settled silently.

Fixed during this pass:

- The data model, architecture, contracts, lifecycle, security strategy and screens still described SMS codes and leave. All six were rewritten to the register.
- Three contract gaps found by the permission-matrix pass: five legacy `/api/users` routes had no role, HR could not raise a correction on its own record, and the staff change-PIN screen had no route. All three were closed in `M1-API-CONTRACTS.md`.
- The lifecycle had no statement of where the location assessment is captured. §2.1 now covers it.
- The screens document still called off-days "out of scope", which contradicted O16. Corrected.
- A security test cited a correction-revision route that does not exist. Pointed at `GET /api/audit/corrections/:attendanceId`.

Left for you, not fixed:

- `PATCH /api/attendance/:id/dismiss-alert` allows STAFF and HR but not SUPERADMIN, while the business attendance screen shows alerts. Whether the owner account should dismiss them is your call.
- R7: nobody approves their own correction, so an HR officer's own correction needs a named approver. The options are a second HR user, SUPERADMIN, or a designated list.

---

## 5. Open decisions for you

Section C of the register holds these with options and a recommendation. The short form:

| Ref | Open detail |
|-----|-------------|
| R1 | The GPS accuracy threshold and what counts as a stale location |
| R2 | What an employee does when the location is unknown |
| R3 | The scan surface: kiosk phone, personal phone, or both |
| R4 | How a timing-policy change behaves for a shift that crosses midnight |
| R5 | PIN length, attempt limit, lockout duration and reset evidence |
| R6 | How a failed clock-in becomes a correction without looking like a success |
| R7 | Who approves an HR officer's own correction |
| R8 | Whether attendance records and audit logs keep different retention periods |
| R9 | Whether the current database can carry the tenant and audit design, or a fresh one is safer |
| O13 | The repository source of truth, which waits on your `git log --oneline -20` from each repository |
| O14 | The test database and connection string, which must be provided before any database-backed test runs |

Retention also waits on Ghana-specific legal advice before any deletion is enabled (O10).

---

## 6. What M1 approval requires

Approval is a separate act from the documents being complete. For M1 to close, the owner must confirm the deliverables, answer the open decisions in section 5, confirm the colour direction and escalation rules, and explicitly state that M2 may begin.

As of the owner's decisions on 2026-10-16:
- Colour direction: approved System B (Paper & Brass), with F8 (status badge contrast on dark surfaces) and F9 (three competing status specifications) to be repaired before finalising the design. The main interface is light paper with dark chrome for sidebar/navigation, and a dark, high-visibility kiosk.
- Correction escalation rules: approved G3/G4. Rules enforced server-side in a single transaction, no self-approval (including SUPERADMIN), valid backstop condition and reason required, explicit handoff auditable, distinct audit actions (`correction.decided`, `correction.decided.backstop`, `correction.escalated`), and the API is the source of truth.

M1 remains unapproved and M2 remains unauthorized until the explicit approval is given. The design stays frozen; no implementation has started.

---

## 7. What was deliberately not done

- No production code was written, and `src/`, `backend/` and the migration files were not touched.
- No database or dependency was changed.
- No commit, merge, push, reset or branch move was made. The nested `backend/.git` repository and the unpushed root commits are preserved as they were.
- M1 was not marked approved, and M2 was not started.
