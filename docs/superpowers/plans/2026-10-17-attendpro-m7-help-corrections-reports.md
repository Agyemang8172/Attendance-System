# Implementation Plan: AttendPro M7 — Help Requests, Correction Decisions, Reports, Audit Trail, Retention Settings

- **Date:** 2026-10-17
- **Milestone:** M7 (backend milestone before the portals)
- **DependsOn:** M6 (committed `6002e1c`) and the ruling work (`8526a98`: R1/R5/R6/R10 final, O14 rehearsal done)
- **Status:** Draft — awaiting owner approval
- **Target:** AttendPro v1 backend
- **Authority:** `M1-API-CONTRACTS.md` §4 staff + HR lanes, §9 reports, §10 audit; decisions O9 (CSV reports), O10 (retention, no automatic deletion), O17 (correction behavior), O21 (backstop); ruling R6 (text-only corrections, no attempt attachments — final), R7 (independent approver).

---

## Overview

M7 completes the backend's human oversight loop: employees ask for help and correct their own records, HR and a SUPERADMIN backstop decide with a full append-only audit trail, HR sees registers and summaries as JSON and CSV, and retention stays configurable-but-off until legal advice. No frontend work.

Everything needed in the database already exists — `attendance_help_requests`, `attendance_corrections`, `attendance_correction_revisions`, the append-only triggers on history tables, and the RLS policies. The rehearsal proved the migration chain applies cleanly. **No new migrations are expected in M7**; if a phase agent discovers a real gap, it stops and reports before touching schema.

## Phases (each phase = one agent, sequential)

### Phase 0 — Help requests (staff lane + HR lane)
- Staff: `POST /api/staff/help-requests` (category allowlist pin/kiosk/profile/access/other), self-scoped `GET /list` + `GET /:id`.
- HR/SUPERADMIN: business-wide list, `PATCH /:id` to set status with an optional resolution note, audited.
- Validators, catch hardening to the established standard, audit events through `writeAudit` (table) + pino.

### Phase 1 — Correction decisions with the no-self-approval backstop (the heart of M7)
- HR: `GET /api/hr/corrections` (status + reviewTier filters) and `GET /api/staff/corrections` self views already exist; this phase adds reads + the decision endpoint.
- `PATCH /api/hr/corrections/:id/decision`: APPROVED/REJECTED, one transaction, `attendance_correction_revisions` insert on approval.
- **No self-approval, enforced in the handler:** a requester never decides their own correction.
- **Backstop (O21 + O17):** ESCALATED-tier corrections need a second HR user or a SUPERADMIN acting as the documented backstop; backstop requires `backstopCondition` (UNCLAIMED_24H / CONFLICT_OF_INTEREST / EXPLICIT_HANDOFF) + a non-empty reason ≤500, checked server-side. Explicit handoff writes `correction.escalated`.
- Approval recomputes the attendance row (status + proposed values) exactly the way the lifecycle/§8 prose defines it; every decision writes `correction.decided` (or `correction.decided.backstop`) with original/proposed/approved values, actor, attendanceId, correctionId, condition, reason.

### Phase 2 — Reports (JSON + the O9 CSV set)
- `GET /api/reports/attendance-register` (date-bounded, employee/shift filters, paginated).
- `GET /api/reports/punctuality-summary` (groupBy employee/shift/day using the final status taxonomy incl. AUTO_CLOSED).
- `GET /api/reports/exceptions` (review-flagged rows + OUTSIDE/UNKNOWN location attempts).
- `GET /api/reports/attendance-register/export?format=csv` per O9: streamed CSV, times in the business timezone, CSV-injection guard (cells starting `=`, `+`, `-`, `@` get the apostrophe prefix).

### Phase 3 — Audit trail endpoint + retention settings
- `GET /api/audit/corrections/:attendanceId` (SUPERADMIN + HR): the correction, its revisions, and the related audits in one view.
- Business settings surface for retention (per O10): read/update `retentionYears`, `retentionEnabled`, `attendanceRetentionDays`, `auditRetentionDays`; defaults keep deletion OFF. **No automatic deletion job in M7** — enabling deletion stays blocked until Ghana-specific legal advice lands (O10); the settings are stored and audited for the future job.

### Phase 4 — Orchestrated verification (same gate loop as M5/M6)
- Independent review agent over the whole change set (self-approval + backstop matrix gets special focus — it is the correctness core).
- Docs agent: testing-guide scenarios for help requests, help handling, the decision/backstop matrix, reports/CSV, and the audit trail; runbook/humanize gates.
- Fixes applied by a fix agent; gates re-run (`tsc`, `prisma validate`, `db-check`, env parity, humanize per file).
- Owner sees the review summary, then the commit goes through `.agents/scripts/commit.sh`. Nothing pushed, ever, without the owner's word.

---

## Owner decisions surfaced (answer now or keep the defaults)

| # | Item | Default if unanswered |
|---|------|-----------------------|
| 1 | R7 approver for HR's own corrections | (b) SUPERADMIN as backstop everywhere in v1 (the one-HR case is the norm at launch; (a) second-HR stays in the design) |
| 2 | Backstop conditions UNCLAIMED_24H / CONFLICT_OF_INTEREST / EXPLICIT_HANDOFF | Adopt exactly as the contract row spells them (they came from M1-VISUAL-DESIGN §7) |
| 3 | Migration safety | Zero new migrations expected; a discovered gap stops the agent and comes back to the owner, never an ad-hoc schema edit |

## Constraints
- No schema changes unless a phase agent finds a genuine gap — and then only with the owner's word.
- No attachments from R6 — the decision endpoint reads reason/proposed values only.
- The pin rules changed mid-programme (4 digits, 10/5) — testing-guide steps and docs already reflect this; M7 docs inherit.
- History preservation holds: commit via the script, no push.
