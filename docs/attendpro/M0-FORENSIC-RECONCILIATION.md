# AttendPro M0 — Forensic Reconciliation

- **Date:** 2026-10-14
- **Baseline commit:** `f87ce1d` on `main`
- **PRD baseline:** v1.0 (`docs/ATTENDPRO_PRD.md`)

## Purpose and method

The PRD §22 lists findings from two forensic reports and asks that none be trusted as
current. The full prose of `Pasted text(7).txt` and `Pasted text(10).txt` did not reach
this session; only the §22 summary of each was supplied. This document therefore treats
the §22 summary as the source and re-checks every listed item against the working tree.

Each item is marked:

- **CONFIRMED** — reproduced in the current tree.
- **PARTLY CONFIRMED** — reproduced in part; the rest no longer holds.
- **NOT REPRODUCED** — did not reproduce.

Every verdict carries the command or file that produced it.

---

## 1. Phase 1 findings (repository, stack, attendance, tests, TS, Git)

### F1 — Frontend TypeScript errors despite passing tests and lint

**CONFIRMED, and it is a frontend-only problem.**

`npx tsc --noEmit` at the repository root reports 43 errors across seven files:

| File | Errors |
|------|--------|
| `src/pages/Profile.tsx` | 18 |
| `src/pages/Dashboard.tsx` | 17 |
| `src/pages/HrDashboard.tsx` | 4 |
| `src/api/axios.ts` | 1 |
| `src/components/Layout.tsx` | 1 |
| `src/components/Sidebar.tsx` | 1 |
| `src/pages/Login.tsx` | 1 |

The backend is clean: `backend` `npx tsc --noEmit` exits 0. Neither package defines a
`typecheck` script, so no automated stage runs the frontend type check. The early
observation that tests and lint pass while `tsc` fails holds, because nothing runs `tsc`.

### F2 — Attendance status previously hardcoded as PRESENT

**CONFIRMED.**

`backend/controllers/attendanceController.ts` writes `status: "PRESENT"` as a literal in
`clockIn`. No branch reads a shift, a grace period, or the clock time. The
`AttendanceStatus` enum offers `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `ON_LEAVE`, none of
which map to the PRD §12 vocabulary of early, on time, late, open session, clock-out
missing, automatically closed, absent, and requires review.

### F3 — Concurrency around multiple open attendance sessions

**CONFIRMED.**

`clockIn` calls `prisma.attendance.findFirst({ where: { userId, sessionStatus: "OPEN" } })`
and then `prisma.attendance.create(...)` in a separate statement. There is no unique
constraint on an open session per user, and no transaction wrapping the read and write.
Two concurrent requests can both observe no open session and both insert one. The PRD §17
requires a constraint or transaction that prevents this.

### F4 — Kiosk, QR, SMS, and automatic closure absent

**CONFIRMED.**

A content search across the backend for `kiosk`, `otp`, `qrcode`, and related terms
returns nothing. There is no kiosk model, no verification session, no OTP storage, and no
scheduled job. The frontend has no kiosk screen. All four subsystems named in the finding
are absent.

### F5 — Nested `backend/.git` with potentially valuable local changes

**CONFIRMED, preservation still open.**

- `backend/.git` exists as a second repository.
- Branch `design/linear-migration`, HEAD `7ab73eb` ("feat: migrate backend files to
  TypeScript").
- No remote configured.
- 17 files tracked, 40 paths dirty in the working tree.

The nested repository is inspected but not touched. PRD §22 item 6 and item 8 both
require this. A preservation decision is recorded in the decision register.

### F6 — Historical root Git state and unpushed commits

**CONFIRMED.**

Root repository is on `main`, working tree clean, 6 commits ahead of `origin/main`. None
are pushed. The push is held by owner instruction.

### F7 — Potentially unsafe backend test database configuration

**CONFIRMED.**

- `backend/tests/setup.ts` sets `NODE_ENV=test` and `PORT=0` only. It never assigns
  `DATABASE_URL`.
- `backend/vitest.config.ts` describes the suite as integration tests against one local
  database.
- `backend/tests/fixtures.ts` upserts three real user accounts into that database.

A search for `TEST_DATABASE`, `testdb`, or a test-DB guard returns nothing. The backend
suite therefore runs against the development database and can create and remove records
there. PRD §22 item 4 asks whether tests can modify or delete records; they can. Item 5
requires an isolated test database before any destructive integration test runs.

---

## 2. Findings the earlier pass added (not in §22)

These emerged from the same read and belong in the register.

| ID | Finding | Verdict | Evidence |
|----|---------|---------|----------|
| N1 | No business or tenant entity in the schema | CONFIRMED | `backend/prisma/schema.prisma` holds only `User`, `Shift`, `Attendance` |
| N2 | Attendance deleted when a user is deleted | CONFIRMED | `attendances_user_id_fkey ... ON DELETE CASCADE` in `20261005000000_init` |
| N3 | Migration contains no row-level security | CONFIRMED | Search for `ROW LEVEL SECURITY` in `backend/prisma/migrations` returns nothing; `db-check.sh` flags `users`, `shifts`, `attendances` |
| N4 | Backend error responses leak `error.message` | CONFIRMED | `attendanceController.ts` 500 handlers |
| N5 | Clock-in and clock-out are open to any authenticated role, with no kiosk binding | CONFIRMED | `attendanceRoutes.ts` guards are auth plus password-change only |

N1 and N2 carry direct PRD obligations: §5 for tenant ownership, §17 for the cascade
rule.

---

## 3. Phase 2 proposals reconciled against the PRD

The second report proposed an attendance architecture. The PRD constrains where those
proposals may go. This section records each constraint and its alignment.

| Phase 2 proposal | PRD decision | Alignment | Action |
|------------------|--------------|-----------|--------|
| Biometric verification | Excluded from the initial release | Repo has no biometric code, so nothing to remove | Keep excluded; do not design it |
| Kiosk verification flow | QR plus SMS OTP is the chosen flow | No kiosk or OTP code exists | Design QR + OTP as specified in §10 |
| Universal 15-minute grace period | Not approved | Repo hardcodes no grace value | Design configurable grace per business and shift (§12) |
| Universal 23:59 / 11:59 auto clock-out | Not approved | Repo has no auto-clock-out job | Design a shift-aware, timezone-aware job gated by a business setting (§13) |
| Kiosk authentication | Still open | Nothing in repo | Raise as a decision (O3) |
| QR format | Still open | Nothing in repo | Raise as a decision (O4) |
| OTP expiry and retry limits | Still open | Nothing in repo | Raise as decisions (O6) |
| SMS provider | Still open | Nothing in repo | Raise as a decision (O2) |

The PRD also imposes requirements the Phase 2 report did not settle. §20 says a six-digit
OTP has low entropy and that plain SHA-256 over the code should not be assumed sufficient,
so the OTP storage design needs a keyed or salted approach with attempt limits and
single-use enforcement. §20 also places a Ghanaian data-protection review before
production. §4.3 rules out a platform-wide administrator unless one is proposed for
approval, which is decision O11.

---

## 4. Divergence log (PRD vocabulary vs current code)

| Concept | PRD requirement | Current code | Divergence |
|---------|-----------------|--------------|------------|
| Tenancy | Business owns every record (§5) | No business entity | Schema and queries must both gain a business scope |
| Status vocabulary | Early, on time, late, open session, clock-out missing, auto-closed, absent, requires review (§12) | `PRESENT`, `ABSENT`, `LATE`, `HALF_DAY`, `ON_LEAVE` | Enum must be replaced or mapped with a policy snapshot |
| Grace period | Configurable per business and shift (§12) | none | Rule engine and policy model required |
| Historical consistency | Preserve shift and policy used at evaluation (§12) | Attendance stores no shift or policy snapshot | Snapshot columns required |
| Auto clock-out | Business setting, shift-aware, no fixed 23:59 (§13) | none | Settings and scheduled job required |
| Deletion | Must not erase attendance history (§15, §17) | `ON DELETE CASCADE` on `attendances.userId` | FK behaviour must change |
| Corrections | Separate, auditable, no self-approval (§14) | none | Two workflows required |
| Kiosk | Its own device authentication (§10.3) | none | Subsystem required |
| Public site | Login-free preview (§6) | `/` redirects to login | Landing screen required |

---

## 5. Repository safety checklist (PRD §22)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Inspect Git status, branches, working tree | Done — record in §1 F5, F6 |
| 2 | Inspect repository instructions, agents, skills, hooks | Done — `.agents/` reviewed this session |
| 3 | Recheck Prisma schema and migration history | Done — one migration, no RLS |
| 4 | Determine whether tests can modify or delete records | Done — they can (F7) |
| 5 | Establish an isolated test database before destructive tests | **Open** — none exists; required before integration tests |
| 6 | Inspect the nested Git anomaly before cleanup | Done — inspected; no cleanup performed |
| 7 | Check secret-leak risk without printing secrets | Done — no secret printed; `backend/.env` stays ignored |
| 8 | Preserve valuable work unless removal is approved | Held — nested repo untouched |

Item 5 remains open and gates any milestone that runs backend integration tests.

---

## 6. Verdict

Of the seven Phase 1 findings, all seven reproduce against `f87ce1d`. Five further
findings (N1–N5) came out of the same read. The Phase 2 constraints are compatible with
the repository, except that the current schema contradicts three of them directly:
tenancy (§5), the status vocabulary with policy snapshots (§12), and the cascade rule
(§17). The decision register carries the choices that must be settled before design
freezes.
