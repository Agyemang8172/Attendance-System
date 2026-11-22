# AttendPro M1 — Data Retention Policy Proposal

- **Date:** 2026-10-16
- **Milestone:** M1
- **Status:** **Proposal for owner approval. M1 is not approved and M2 is not authorized.**
  Nothing in this document is an enacted policy. No deletion job exists, none is built,
  and none should run until the gates in §1 close.
- **Author:** Security Agent
- **Owner:** Product owner (AttendPro)
- **Companions:** `docs/attendpro/DECISION-REGISTER.md` (authoritative), `docs/attendpro/M1-DATA-MODEL.md`,
  `docs/attendpro/M1-SECURITY-AND-TEST-STRATEGY.md` §8, `docs/ATTENDPRO_PRD.md` §15 and §20
- **Baseline:** `f87ce1d`

---

## 1. What is proposed and what is not decided

This document proposes how AttendPro could structure data retention once the owner
approves it: which categories of data exist, how long each could be kept, how deletion
would work mechanically, and what restrains it. Every period below is a starting point
invented for discussion. The schema already anticipates retention — `Business` carries
`retentionEnabled` (default off), `attendanceRetentionDays`, `auditRetentionDays` and the
legacy `retentionYears` — but retention is off by default and no automatic deletion runs.
Leave is deferred to v2 by O16, so no leave-record category appears here; if leave models
return in v2, this proposal needs a matching revision.

Three gates stand between this proposal and any deletion: **O10** (retention is
configurable per business, and automatic deletion stays off until legal and business
requirements are confirmed), **R8** (still open: whether attendance and audit/security
logs may keep different periods), and **Ghana-specific legal advice** under the Data
Protection Act, 2012 (Act 843), which is required before deletion is enabled.

---

## 2. Retention categories

Every default period in this table is **provisional and awaiting legal confirmation**.
None of these numbers is legally required; they are conservative conversation starters the
owner can strike (§6). The "auto-delete in v1" column answers what the design would allow
if retention were switched on today, not what runs today — today, nothing runs.

| Category | Example data | Proposed default period (provisional) | Auto-delete in v1? | Notes |
|----------|-------------|----------------------------------------|--------------------|-------|
| Attendance records | `Attendance` rows: clock-in/out, status, hours, evaluation snapshots, location fields | 7 years after the record date | No — gated by `retentionEnabled` and legal advice | 7 years mirrors the legacy `retentionYears` default and nothing more. Attendance is payroll-adjacent evidence (PRD §15), so it gets the longest of the ordinary categories, but the number itself is unconfirmed |
| Correction records and correction revisions | `AttendanceCorrection` (originals, proposed and approved values, reasons), `AttendanceCorrectionRevision` | 7 years after the correction is decided, matching the parent attendance row | Revisions: no — the table is append-only by design (§4). Corrections: no until legal advice | A correction shorter than its attendance record would orphan history; a longer one would outlive what it corrects. Tie them together unless counsel says otherwise |
| Append-only audit logs | `AuditLog` rows: who changed what, before/after values, reasons, correlation ids | 10 years | No — the table cannot be updated or deleted by design (§4). Retention here means archive, not deletion | Audit outlives attendance so accountability survives the record it describes. Archive means an export to immutable cold storage, then removal from the primary table only through an explicit owner-approved break-glass migration |
| Security events and failed-attempt records | `AttendanceAttempt` (rejected scans, PIN failures, location assessments), PIN lockout fields on `User`, `EmailRecoveryCode` attempt counts | 2 years for the attempt log; failed-code rows purged with their codes | Attempt log: no — append-only (§4). Expired codes: yes, short window, once enabled | O7 requires failure evidence to be preserved, not fabricated successes. Two years of attempt history is the proposal's compromise between evidence and minimisation |
| Verification sessions | `VerificationSession` rows: QR accepted, PIN pending, verified, locked, consumed | 180 days after the session closes | Yes, once enabled — this table is not append-only | Sessions are short-lived operational state. Their durable evidence belongs in `AttendanceAttempt`, which keeps it |
| Account and profile data | `User`: name, email, employee code, department, PIN hash, `tokenVersion` | Employment period plus 7 years after deactivation | No — and PRD §15 forbids hard deletion from erasing attendance history | Deactivation, not deletion, is the normal end state (PRD §15, O12). History must stay readable to authorized users inside the retention window |
| Kiosk device records | `KioskTerminal`: pairing and token hashes, state, who revoked it, `lastSeenAt` | 2 years after revocation or decommissioning | Yes, once enabled | Keeping a revoked device row briefly preserves who registered and revoked it; the audit log already carries the durable account of that |
| QR credentials (revoked) | `QrCredential` rows with `revokedAt` set | 90 days after revocation | Yes, once enabled | Active credentials are never retention candidates. A revoked row is a hash of a dead token; it is kept only to answer "when was this badge revoked?" |
| Expired email recovery codes | `EmailRecoveryCode` rows past `expiresAt` or `usedAt` | 30 days after expiry or use | Yes, once enabled | Shortest category in the design. The code is single-use and ten minutes long (O6); a month of dead hashed rows is diagnostic headroom and no more |
| System and config history | `PolicyVersion`, `WorkplacePolicy`, `WorkCalendar`, `CalendarException`, `Site` | No auto-deletion proposed | No | Attendance rows snapshot the policy evaluated at punch time (PRD §12). Deleting policy versions would break that reconstruction, so this category is exempt by default |
| Test-database data | Everything in the `*_test` database | No retention period — wiped between runs | Not applicable | O14: fake data only, never real employee data, separate connection, destructive resets verified against database name and host. Test data is not a retention category so much as a hygiene rule |

---

## 3. Deletion mechanics as designed today

**The gate.** `Business.retentionEnabled` defaults to `false`. With the gate closed, no
job deletes anything, whatever the day fields say. Per-category periods live on the
business row: `attendanceRetentionDays` and `auditRetentionDays` exist in the schema
today; the categories in §2 that have no field yet (sessions, credentials, recovery
codes, device records) would each need one before their category could be enabled. The
legacy `retentionYears` stays as a read-only fallback for any business that never sets
per-category values.

**Soft delete versus hard delete.** Ordinary tables (attendance, sessions, corrections,
devices, credentials) soft-delete first: a row is marked deleted and hidden from normal
queries, and only a later, separate hard-delete pass removes it after the export window
in §5 has run. Soft delete lets a mistaken purge be reversed; the schema already refuses
cascade paths to `Attendance`, so nothing accidental erases history (PRD §15, §17).

**Append-only tables.** `AuditLog`, `AttendanceAttempt` and `AttendanceCorrectionRevision`
cannot be updated or deleted — grants, RLS policies and a `BEFORE UPDATE OR DELETE`
trigger enforce that (M1 data model §10, O21). Retention on these tables therefore means
**archive**, not row deletion: export the aged slice to immutable cold storage, record
the archive in the audit log, and only then consider removal from the primary table. The
recommendation for v1 is archive-and-keep; any removal path is a break-glass migration
requiring explicit owner approval, never a scheduled job.

**Legal hold.** A hold suspends all deletion for a business, a category, or a named set
of records (for example, one employee under dispute). While a hold is active, the job
skips the held scope entirely. Holds are set and lifted by the owner, and both actions
are themselves audited.

**Deletion is audited even though the row is gone.** Before any hard-delete pass, the job
writes an `AuditLog` entry recording the category, the business, the criteria, the count,
and the id list or an id-range reference, plus the actor (the scheduled job, as
`SYSTEM`). The row being removed never takes the account of its removal with it.

---

## 4. Restraints

- **No cross-business bleed.** Deletion is scoped per business, enforced by the same RLS
  policies that govern every other query. A retention run for one business cannot see or
  touch another tenant's rows.
- **Deletion runs as the owner role.** The job executes under the restricted service path
  — scoped like an owner/`SECURITY DEFINER` function with a pinned `search_path`, the
  pattern migration 9 already establishes — not as an application user and never as a
  superuser over RLS.
- **RLS stays on.** Every one of the nineteen tables keeps row-level security; retention
  does not get an exemption from it.
- **Backup retention window.** Backups keep deleted rows until the backup window expires.
  A purge is therefore not final for as long as a backup lives, and that delay must be
  stated honestly to anyone exercising an erasure right.
- **The test database never contains real data.** O14 stands: separate database, name
  suffix `_test`, host verified before any destructive reset, fake data only, wiped
  between runs. Retention jobs are tested there and nowhere else.

---

## 5. Export before deletion

Nobody loses data to a retention job without a way to keep it. Before any hard-delete
pass runs, the affected scope must be exportable:

- **The employee** can export their own attendance and correction history in the CSV
  shapes O9 already defines — the daily attendance report and the period summary — so a
  departing employee leaves with a record of their own working time.
- **The business** can export everything in the affected category for every employee,
  including the flags-and-corrections report, as evidence alongside the archive copy in
  §3.
- The export runs on the same criteria as the deletion pass, so what is exported and what
  is removed match exactly. A category that cannot be exported cannot be deleted.

This reuses the O9 report machinery rather than inventing a second export path; the
formula-injection escaping and business time-zone rules apply unchanged.

---

## 6. Open decisions for the owner

**R8 (register, open).** Can attendance records and audit/security logs keep different
retention periods?

- **Option (a): yes, separate policies per category.** The categories hold different
  kinds of data for different reasons, and O10 already names them separately.
- **Option (b): one period for all categories.** Simpler to configure and to explain, at
  the cost of either over-keeping short-lived credentials or under-keeping audit evidence.

**Recommendation: (a), separate policies** — but this is not settled, and §2's table
assumes (a) only as a drafting convenience.

**Ghana legal advice (blocking).** Commission Ghana-specific advice under the Data
Protection Act, 2012 (Act 843) before enabling any deletion. This is an explicit blocking
action under O10. It should also reconcile the erasure right with the attendance-privacy
point raised in `M1-SECURITY-AND-TEST-STRATEGY.md` §8.3.

**Invented provisional numbers.** Every number below was invented for this proposal. The
owner may strike or replace any of them:

| # | Provisional number | Where it appears | Basis |
|---|--------------------|------------------|-------|
| 1 | 7 years | Attendance records | Mirrors the legacy `retentionYears` default; no legal source |
| 2 | 7 years | Correction records and revisions | Chosen to match the parent attendance rows |
| 3 | 10 years | Append-only audit logs | Chosen so accountability outlives the record; no legal source |
| 4 | 2 years | Security events and attempt log | Chosen as an evidence-versus-minimisation compromise |
| 5 | 180 days | Closed verification sessions | Chosen as operational-state headroom |
| 6 | 2 years | Kiosk device records after revocation | Chosen; no legal source |
| 7 | 90 days | Revoked QR credentials | Chosen; the token is already dead |
| 8 | 30 days | Expired or used email recovery codes | Chosen; the code itself lives ten minutes (O6) |
| 9 | Employment plus 7 years | Account and profile data after deactivation | Chosen to match attendance; no legal source |
| 10 | Backup window (deployment-defined, not fixed here) | Backups after a hard delete | Left deliberately undefined pending the hosting decision in §8.3 of the security strategy |

---

## 7. Requirement-to-mechanism map

| Source requirement | Where this document answers it |
|--------------------|--------------------------------|
| PRD §20 — "a defined data-retention policy" | This proposal; §2 defines the categories, §3 the mechanics |
| PRD §20 — Ghanaian review before production | §1 gate, §6 blocking action |
| PRD §15 — deactivation preserves history; hard deletion must not erase attendance | §2 account category, §3 soft delete and the no-cascade rule |
| O10 — configurable per business, off by default, categories may differ, legal advice first | §1 gate, §2 table, §3 `retentionEnabled` gate |
| R8 — separate periods for attendance versus audit/security (open) | §6, both options with recommendation |
| O16 — leave deferred to v2 | §1 (no leave category in v1) |
| O17 / O21 — correction history and append-only audit log | §2 rows for corrections and audit; §3 append-only handling |
| O9 — CSV reports | §5 export before deletion |
| O14 — isolated test database, fake data only | §2 test row, §4 restraints |
| O7 — failure evidence preserved | §2 security-events row, §3 append-only archive |
