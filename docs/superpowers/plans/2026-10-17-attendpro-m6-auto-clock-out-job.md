# Implementation Plan: AttendPro M6 — Automatic Clock-Out Job (Shift-Aware, Idempotent)

- **Date:** 2026-10-17
- **Milestone:** M6 (automatic clock-out job, flagged closures, job service token)
- **DependsOn:** M5 (committed `63318bf`)
- **Status:** Draft — awaiting owner approval
- **Target:** AttendPro v1 backend
- **Authority:** `M1-ATTENDANCE-LIFECYCLE.md` §5.2/§7 (eligibility, writes, idempotence), `M1-API-CONTRACTS.md` §9 (job routes), decision O8 (defaults: 15-minute cadence, 120-minute buffer, 840-minute no-shift max), `M1-ARCHITECTURE.md` §4 (advisory lock, per-business tenant transaction)

---

## Overview

The job closes open attendance sessions instead of letting them hang forever. It runs every 15 minutes, is idempotent, and never overwrites a genuine clock-out. No new tables and no schema changes — everything needed exists from M2 (effective-dated policy fields, snapshot columns on `Attendances`, `ClosureReason`, the `audit_logs` table).

Two endpoints only (contracts §9):

1. `POST /api/jobs/auto-clock-out/run` — caller carries the service token (`JOB_TOKEN`). One advisory-lock-guarded sweep over all businesses: close eligible rows, flag ambiguous ones, write audit rows with `actor_type = SYSTEM`.
2. `GET /api/jobs/status` — SUPERADMIN or the job token; reads the last sweep results from `audit_logs`.

Eligibility (lifecycle §7.1), all four must hold:

1. `session_status = OPEN`
2. The row's live policy version has `autoClockOutEnabled = true`
3. `now >= shiftEndInstant + autoClockOutOffsetMinutes` — computed from the row's own snapshots (`shiftEndMinuteSnapshot`, `shiftCrossesMidnightSnapshot`, `date`, `timezoneSnapshot`), so an overnight shift ends the next morning
4. The shift window can be resolved from the row's snapshot — rows with no resolvable window move to `REQUIRES_REVIEW` instead of being closed

What the job writes for each closed row (§7.2): `clock_out = shiftEndInstant + offset`, `session_status = CLOSED`, `status = AUTO_CLOSED`, `closureReason = AUTO_CLOCK_OUT`, `hours_worked` recomputed from the stored `clock_in`. The UPDATE filters on `session_status = 'OPEN'`, so a verified clock-out is never overwritten.

---

## Phases & Tasks

### Phase 1: Job authentication + route skeleton

- [ ] **1.1** `backend/middleware/jobAuthMiddleware.ts` — reads `Authorization: Bearer <JOB_TOKEN>`; constant-time comparison; attaches `req.actorType = "job"`; fails closed (generic 401) when `JOB_TOKEN` is unset; no user or kiosk lookup.
- [ ] **1.2** `backend/routes/jobRoutes.ts` — `POST /auto-clock-out/run` (job middleware only) and `GET /status` (job middleware **or** `authMiddleware` + `authorizeRole("SUPERADMIN")` for the owner variant per the contract) mounted at `/api/jobs` in `backend/server.ts`.
- [ ] **1.3** Validators: optional `businessId` uuid body, empty otherwise. Root `.env.example` gains `JOB_TOKEN` (placeholder + fail-closed comment — env-check passes).

### Phase 2: The sweep (core)

- [ ] **2.1** `backend/utils/shiftWindow.ts` — resolve a row's shift-end instant from its snapshots: parse `date` (UTC midnight), apply `shiftStart/EndMinuteSnapshot` and `shiftCrossesMidnightSnapshot`, compute the end instant (+1 day when the row crosses midnight), honoring the mark that overnight shifts belong to the day they start. Export a pure `shiftEndInstant(attendance)` used by the sweep and unit-testable later.
- [ ] **2.2** `backend/jobs/autoClockOut.ts` — `runAutoClockOut(businessId?)`:
  - takes an advisory lock (`SELECT pg_advisory_lock(hashtext('attendpro:auto-clock-out'))`) with a `nowait`/timeout variant answering the contract's `409 CONFLICT` when another run holds it; releases in `finally`
  - resolves the business list (one, or all active businesses — one cheap `businesses` select)
  - **per business, one tenant transaction**: select open attendance rows for that business (`sessionStatus = "OPEN"`), then in-memory classify each with the resolved policy version (the row's `policyVersionId`, else the business default), the shift window from 2.1, and the policy's `autoClockOutOffsetMinutes ?? autoClockOutBufferMinutes`:
    - eligible + enabled + past end-instant + offset → set the §7.2 write set, `updateMany WHERE { id, sessionStatus: "OPEN" }` (idempotence guard; count-check)
    - automatic clock-out disabled → leave open; it already reads `CLOCK_OUT_MISSING` at evaluate time (no job write)
    - unresolvable shift window (no snapshot) → `status = "REQUIRES_REVIEW"`, leave the session open, flag for HR
  - recompute `hoursWorked` from the stored `clockIn` (same arithmetic as the punch path)
  - write one durable audit row per action (`auto_clock_out.closed`, `auto_clock_out.flagged`, `auto_clock_out.skipped_disabled` aggregates not needed) with `actorType = SYSTEM`, plus the existing pino `auditLog` lines
  - returns `{ closed, flagged, businesses }` counts exactly as the contract's response shape
- [ ] **2.3** Handler in `backend/controllers/jobController.ts`: wraps 2.2, answers `200` with the counts (the contract says the route answers `{ closed, flagged, businesses }` — no `data` wrapper beyond the standard shape; keep consistent with the codebase), `409` on the lock conflict with a plain message, 500-or-fails-closed otherwise.
- [ ] **2.4** `GET /api/jobs/status`: read the most recent `audit_logs` rows where `actorType = "SYSTEM"` and actions are the auto-clock-out family; respond `{ data: { lastRun, closed, flagged } }`. SUPERADMIN reads are their own business; job token sees all.

### Phase 3: Cadence wiring + docs

- [ ] **3.1** The 15-minute cadence is a deployment concern, not in-process code: document `POST /api/jobs/auto-clock-out/run` in root `.env.example` comments is NOT a schedule; instead the plan adds `docs/attendpro/` note + job status endpoint exposing `lastRun` so the owner's scheduler (Windows Task Scheduler / cron later) can hit the route. A default `docs/runbook-jobs.md` short note (plain English) with the cURL example lands here. No in-app timer is created.
- [ ] **3.2** Docs agent: testing-guide scenario — arrange an open session past its shift end with auto-clock-out enabled, run the route with the job token, observe `AUTO_CLOSED` + audit rows; second run closes nothing (idempotence); disabled policy leaves the row `CLOCK_OUT_MISSING`; unresolvable window → `REQUIRES_REVIEW`. Humanize-check clean.
- [ ] **3.3** State docs (`CURRENT_STATE.md`, `TASK_BOARD.md`) updated by the orchestrator at the end.

### Phase 4: Orchestrated review (same gate as M4/M5)

- [ ] **4.1** Review agent re-reads the change set against lifecycle §7 and contracts §9 (advisory-lock correctness incl. release on error, idempotence, tenant scoping, hours arithmetic, snapshot-to-instant math at day boundaries).
- [ ] **4.2** Apply blocking findings; re-run gates: `tsc` 0 errors, `prisma validate`, db-check, env parity, humanize.
- [ ] **4.3** Owner sees the review summary; commit through `.agents/scripts/commit.sh` on approval; nothing pushed.

---

## Not in M6 (explicit)

- The HR correction-decision endpoint (R7 backstop logic) — separate, owner may fold into M6 with one word.
- Any scheduler daemon in-process — the job is meant to be triggered externally every 15 minutes (O8).
- Frontend changes.

## Owner decisions surfaced (answer now or keep defaults)

| # | Item | Default if unanswered |
|---|------|----------------------|
| 1 | Fold the HR correction-decision endpoint (R7) into M6? | No — stays queued |
| 2 | In-between close rows whose policy record is missing entirely (e.g. policy versions deleted)? | Treated as unresolvable → `REQUIRES_REVIEW`. Related open conflict needing an owner ruling: O8's "closes after a maximum (default 840 minutes)" for rows with no shift contradicts lifecycle §7.1/§5.2/§9/§10, which consistently flag those rows `REQUIRES_REVIEW` instead; M6 was built flag-only per this plan, and the unused `autoClockOutMaxOpenMinutes` column (default 840) stands ready if the owner later picks closure-by-maximum (logged as R10 in the decision register). |
| 3 | `autoClockOutOffsetMinutes` unset but buffer set (legacy rows)? | Offset falls back to `autoClockOutBufferMinutes` |

## Constraints

- No schema changes, no migrations
- Advisory lock must release on every path (`finally`)
- The job never fabricates or overwrites a clock-out; every write is guarded by the open-status WHERE
- All audit rows carry `actorType = SYSTEM` and the business id
- No push; root history preserved
