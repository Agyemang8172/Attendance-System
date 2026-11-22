# AttendPro M1 — Milestones and Dependencies

- **Date:** 2026-10-16
- **Milestone:** M1 (architecture and design set)
- **Status:** pending owner review; M2 not authorized
- **Owner:** the AttendPro owner, Olives Technologies
- **Companions:** `docs/attendpro/DECISION-REGISTER.md`, `docs/attendpro/M0-REALITY-CHECK.md`,
  `docs/attendpro/M0-FORENSIC-RECONCILIATION.md`, `docs/attendpro/M1-ARCHITECTURE.md`,
  `docs/attendpro/M1-DATA-MODEL.md`, `docs/attendpro/M1-API-CONTRACTS.md`,
  `docs/attendpro/M1-KIOSK-SECURITY.md`, `docs/attendpro/M1-ATTENDANCE-LIFECYCLE.md`,
  `docs/attendpro/M1-NAVIGATION-AND-SCREENS.md`, `docs/attendpro/M1-ROLE-PERMISSION-MATRIX.md`,
  `docs/attendpro/M1-RETENTION-POLICY.md`, `docs/attendpro/M1-SECURITY-AND-TEST-STRATEGY.md`
- **Baseline:** `f87ce1d`

## Status facts, stated plainly

| Fact | State on 2026-10-16 |
|------|----------------------|
| M1 | **Not approved.** The design documents are written and under review. |
| M2 | **Not authorized and must not begin.** No implementation work starts before the owner approves M1. |
| `origin` | **Nothing may be pushed.** The push hold from the decision register stands. |
| M1 documents | **Written but uncommitted.** |
| M0 documents | **Committed** at baseline `f87ce1d`. |

M1 documents the design. M2 begins implementation only on explicit owner approval.

---

## 1. What changed in this revision

The baseline plan is the milestone table in `docs/TASK_BOARD.md` (M0 to M9, opened
2026-10-14), read against the PRD's release scope in `docs/ATTENDPRO_PRD.md` §20 to §22.
The owner's design review of 2026-10-16 changed the plan in the following places. Each row
carries its register reference.

| # | What changed | Effect on the plan | Register ref |
|---|--------------|--------------------|--------------|
| 1 | Kiosk verification is QR badge plus PIN; SMS one-time codes are not used for routine clock-in | The SMS provider question leaves the critical path; no provider is procured or integrated in v1 | O2 |
| 2 | No SMS provider in version one; email codes are for account recovery only | Baseline M5's "OTP issue/verify" work shrinks to PIN verification and an email recovery flow | O2, O6 |
| 3 | Kiosk pairing: an admin-generated one-time code pairs the device, which then holds a revocable 30-day token | Device lifecycle, token renewal and revocation become part of the identity milestone | O3 |
| 4 | QR identifies the badge and every attempt records a location assessment; each site carries a geo-fence | A `Site` entity with centre and radius joins the data model; outside-fence is flagged, not blocked | O4, O22 |
| 5 | Leave requests, leave allocation and timetable upload are deferred to v2 | `LeaveType` and `LeaveRequest` come out of the schema; calendars, working days, off days and absence stay in v1 | O16 |
| 6 | No platform-operator role in v1 | The platform-wide operator login and its permissions leave the design | O11 |
| 7 | No public self-registration; the owner or operator creates business accounts | The public site keeps a preview only; account creation stays inside the business | O1 |
| 8 | A separate test database is a hard requirement, with a `_test` suffix check and a verified connection | Every milestone that runs integration tests or migrations now depends on that database existing first | O14 |
| 9 | Attendance corrections are requested within seven days, with a same-day tier and a stricter review beyond it | The correction workflow gets a window rule and two review tiers instead of one undifferentiated queue | O17 |
| 10 | The schema holds nineteen models and the migration plan adds nine forward migrations | M2's "one migration with RLS" becomes a nine-migration sequence with backup, rehearsal and dry run | O14, O18 |

Rows 1 to 9 replace the PRD §22 statement that "QR plus SMS OTP is the chosen kiosk
verification flow". Row 10 replaces the single-migration assumption in the baseline M2 row.

---

## 2. Milestone table

M0 and M1 are actual. M1-A is the verification step that closes M1. M2 onward are
**PROPOSED** and every one of them awaits owner approval; none is scheduled, assigned or
started.

| ID | Name | Purpose | Entry gate | Exit gate | Deliverables | Status |
|----|------|---------|------------|-----------|--------------|--------|
| M0 | Repository reality check and forensic reconciliation | Establish what the repository actually contains and re-verify every PRD §22 finding against it | PRD v1.0 persisted | Owner reviewed the M0 artefacts; decision register opened | `M0-REALITY-CHECK.md`, `M0-FORENSIC-RECONCILIATION.md`, `DECISION-REGISTER.md` (O1–O14 at the time) | **DONE** — committed at `f87ce1d` |
| M1 | Architecture and design set | Design the whole product on paper: tenancy, schema, contracts, kiosk, lifecycle, screens, roles, retention, tests | M0 closed; owner decisions O1–O18 confirmed | All 17 review deliverables complete, conflicts resolved, owner answers recorded | The nine M1 documents plus the updated register | **IN REVIEW — not approved**; documents written, uncommitted |
| M1-A | Verification and acceptance of M1 | Check the design set against the PRD, the register and itself, then put the approval question to the owner | M1 deliverables complete and the conflict list in `M1-ROLE-PERMISSION-MATRIX.md` §7 closed | The owner gives an explicit approval; the register records it; the design set is committed | Acceptance record, conflict-resolution record, updated register, committed M1 set | **PROPOSED — awaiting owner approval** |
| M2 | Tenancy and schema foundation | Implement the nineteen models, nine forward migrations with RLS and safe FK behaviour, the bootstrap business row, and the isolated test database | M1 approved; R9 answered; test database provisioned; nested-repository decision executed | Migrations run clean against the test database; `db-check.sh` passes; tenant isolation tests green | Schema, migrations 1–9, RLS policies, `_test` guard, preservation decision executed | **PROPOSED — awaiting owner approval** |
| M3 | Identity and kiosk | Business accounts and roles, session revocation, employee QR issuance and hashing, kiosk pairing and tokens, PIN verification with limits, email recovery codes | M2 exit passed; R3 and R5 answered | Kiosk punch path works end to end with tenant scoping; failed verification never produces a punch | Auth and role code, kiosk subsystem, QR issuance, recovery flow, their tests | **PROPOSED — awaiting owner approval** |
| M4 | Attendance lifecycle | Shift assignment, calendars and off days, the status rule engine with policy snapshots, geo-fence assessment, automatic clock-out, corrections with append-only history | M3 exit passed; R1, R2, R4, R6 and R7 answered | Status is computed from configured rules; the 15-minute job is idempotent; corrections enforce the seven-day window and no self-approval | Rule engine, auto clock-out job, correction workflow, absence calculation | **PROPOSED — awaiting owner approval** |
| M5 | Reporting and dashboards | The three CSV reports, the staff and HR screens still missing today, exceptions and audit views | M4 exit passed | The three reports export per O9 with CSV injection defence; each role sees only its scope | Report endpoints, CSV writer, remaining screens | **PROPOSED — awaiting owner approval** |
| M6 | Hardening and close-out | Full test suite on the isolated database, security review, migration rehearsal evidence, retention controls, type check clean, testing guide | M5 exit passed; R8 answered; Ghana legal advice received before any deletion is enabled | Release review passes; no open P0 or P1; the frontend passes `tsc --noEmit` | Test suite, security report, rehearsal evidence, testing guide | **PROPOSED — awaiting owner approval** |

The baseline M0–M9 table is not discarded. Its M3 to M9 rows are folded into M3 to M6
here, because the 2026-10-16 decisions removed work (SMS, leave, platform operator) and
added work (geo-fencing, nine migrations, seven-day corrections) that the old row
boundaries no longer describe. `docs/TASK_BOARD.md` still shows the old table; this
document supersedes it for planning, and the board is updated only after the owner
approves this set.

---

## 3. Dependencies

### 3.1 Cross-document dependencies

| This | Depends on | Why |
|------|-----------|-----|
| `M1-DATA-MODEL.md` | `DECISION-REGISTER.md` | The schema implements O4 (site and geo-fence), O14, O16 (leave removed), O17, O18 |
| `M1-API-CONTRACTS.md` | `M1-DATA-MODEL.md` | Route payloads, filters and error cases reference model and column names |
| `M1-ROLE-PERMISSION-MATRIX.md` | `M1-API-CONTRACTS.md` | Every matrix row cites a route; the six conflicts in its §7 are contracts-versus-screens disagreements |
| `M1-NAVIGATION-AND-SCREENS.md` | `M1-API-CONTRACTS.md` | Each screen maps to an API area by name; endpoints live in the contracts |
| `M1-ATTENDANCE-LIFECYCLE.md` | `M1-ARCHITECTURE.md` and `M1-DATA-MODEL.md` | Status transitions, the auto clock-out job and the advisory lock are specified there |
| `M1-SECURITY-AND-TEST-STRATEGY.md` | O14 (test database) | The isolation tests T18–T21 cannot run until the `_test` database exists |
| `M1-RETENTION-POLICY.md` | O10 and R8 | Retention categories and periods are the owner's call; deletion stays off by default |

### 3.2 External dependencies

| Dependency | Needed by | Blocks M2? |
|------------|-----------|------------|
| Owner answers to R1–R7 | M1-A acceptance; R3 and R5 for M3, R1, R2, R4, R6, R7 for M4 | **No** — they block later milestones. R3 and R5 must be answered before M3 starts |
| Owner answer to **R9** (forward-only migrations on the existing database, or rebuild on a fresh one) | M2 migration plan | **YES — BLOCKS M2** |
| Owner answer to **R8** (separate retention periods per record category) | M6 retention controls | No |
| **Ghana legal advice** required before enabling deletion (O10, PRD §20) | M6; deletion stays disabled until it arrives | No — blocks the deletion switch only |
| Owner supplies `git log --oneline -20` from both repositories (O13), plus the backup and source-of-truth decision | The nested-repository preservation step carried inside M2 | **YES — BLOCKS M2** |
| Isolated test database created and its connection verified (O14) | Any integration test or migration run | **YES — BLOCKS M2** |
| Resolution of the seven conflicts in `M1-ROLE-PERMISSION-MATRIX.md` §7 | M1-A acceptance; conflict 4 states the roles column must be written before M2 | **YES — BLOCKS M2** |
| Owner approval of the M1 set (the literal act in §5 below) | Everything from M2 onward | **YES — BLOCKS M2** |
| The two full forensic reports behind PRD §22 (`Pasted text(7).txt`, `Pasted text(10).txt`) | M1-A completeness; M0 summarised them instead of reading them | No — see §6, risk 3 |

---

## 4. Critical path and the shortest route to an approvable M1

Approval is gated by three things, in this order:

1. **Completeness of the 17 deliverables.** The owner's 2026-10-16 review lists 17
   items; this document is item 16. Any item still missing keeps M1 in review whatever
   else is true.
2. **Resolution of the conflicts found.** The seven items in
   `M1-ROLE-PERMISSION-MATRIX.md` §7 are places where the PRD, the contracts and the
   navigation doc disagree. Each needs an owner choice recorded in the register, and the
   losing document amended to match. Conflict 4 also has a hard deadline: the roles
   column on the legacy `/api/users` routes must exist before M2.
3. **Owner answers to the open register rows.** R1 to R9 each carry a recommendation and
   are waiting on the owner. The rows that touch the design itself (R3 scan surface, R5
   PIN policy, R9 database path) should be answered first, because they can force a
   rewrite of parts of the design set. The rest can be answered in parallel with M1-A.

After those three: a consistency pass across the nine M1 documents and the register, so
no document still quotes a superseded decision (the off-days note in the navigation doc,
item 7 in the conflict list, is one known example), then the M1-A acceptance review, then
the approval question in §5.

Nothing on this path requires code. Everything on it is a document or an owner answer.

---

## 5. Gates and the approval rule

Two gates sit on this milestone, and they are separate acts.

| Gate | What the owner does |
|------|---------------------|
| **Content gate** | Satisfied when all 17 deliverables exist, the seven conflicts are closed with recorded answers, and the register carries the R1–R9 decisions |
| **Approval gate** | The owner says so, explicitly |

To approve M1 the owner must: read the design set, confirm or reject each open R row,
confirm the conflict resolutions, and then give an explicit approval. The task board
records the form this takes — M0 was "awaiting the literal word approve", and M1 closes
the same way.

**A finished document set does not by itself approve the milestone.** Completeness is the
content gate; approval is a separate act by the owner. The documents being written, the
conflicts being listed, and this file existing all change nothing about status until that
act happens. Until then M2 stays unauthorized, nothing is committed past M0, and nothing
is pushed to `origin`.

---

## 6. Risks to the schedule

| # | Risk | Owner | Mitigation |
|---|------|-------|------------|
| 1 | The nine open rows (R1–R9) drift unanswered, and a late answer invalidates finished design work | Owner | Answer R3, R5 and R9 first; the rest carry recommendations and can follow without a rewrite |
| 2 | Design conflicts between documents surface one at a time instead of in a batch | DevOS (PM) with owner sign-off | Work the conflict list in `M1-ROLE-PERMISSION-MATRIX.md` §7 as a checklist; run the consistency pass in §4 step 4 before the approval question |
| 3 | Repository state: six unpushed commits on `main`, a nested `backend/.git` with 40 dirty paths, and no `git log --oneline -20` from either side | Owner (O13) | Back up both histories, supply the two logs, identify the source of truth; nothing is merged, deleted or force-pushed |
| 4 | Unverified M0 evidence: the full forensic reports were summarised in PRD §22 rather than supplied, so M0 re-checked a summary of each | Owner | Supply `Pasted text(7).txt` and `Pasted text(10).txt`; M0 findings are re-verified against the originals during M1-A |
| 5 | The M1 set stays uncommitted while review continues, so a working-tree accident could lose it | DevOS (PM) | Commit the M1 documents as soon as the owner authorizes it; the push hold on `origin` stays regardless |
| 6 | Ghana legal advice (O10) arrives late and leaves retention unfinished | Owner | Deletion stays disabled by default; M6 closes with retention configurable and off, which is a valid state |
| 7 | Implementation pressure starts before approval, because documents look finished | Owner and DevOS | The status header in this file and the board's `[ HUMAN_CHECKPOINT ]` state both hold M2 until the approval act |

---

## 7. Requirement-to-mechanism map

Where the PRD's milestone, acceptance and release sections land in this document.

| PRD section | What it asks for | Where this document covers it |
|-------------|------------------|-------------------------------|
| §20 initial release list | Security and privacy items that must ship in the first release | §2: the items that need code sit in M3, M4 and M6; the ones that are design (retention, audit logging) sit in M1's security and retention documents |
| §20 Ghana data-protection review before production | Legal review precedes deployment | §3.2 external dependencies; §6 risk 6 |
| §21 non-functional requirements | Correctness, security, reliability, usability, accessibility, performance, maintainability, observability, compatibility | §2 exit gates: each proposed milestone names the check its exit gate runs; compatibility (keep the current stack) applies to all of M2–M6 |
| §22 forensic reports and repository investigation | Read both reports, re-verify every finding, satisfy the eight repository safety requirements | M0 row in §2 (done, with the gap in §6 risk 4); safety items 4, 5 and 6 reappear as dependencies in §3.2 |
| §22 "QR plus SMS OTP is the chosen flow" and the four "still open" items | Baseline verification flow and open security questions | §1 rows 1–4: superseded by O2, O3, O4, O6 on 2026-10-16 |
| §19 item 11 traceability matrix linking requirements to tests and acceptance criteria | Requirements must trace to tests | §7 maps requirements to milestone sections; the requirement-to-test rows live in `M1-SECURITY-AND-TEST-STRATEGY.md` and are executed from M2 onward |
| §5, §17 multi-business and conceptual database requirements | Tenancy on every record, no cascade deletes, integrity | M2 row in §2 (nineteen models, nine migrations, safe FK behaviour) |
| §12, §13 status, punctuality and automatic clock-out | Rule-driven status, no universal grace, shift-aware closure | M4 row in §2, gated on R4 |
| §14 help requests and corrections | Separate auditable workflows with no self-approval | M4 row in §2, gated on R6 and R7 |
| §16 SMS failures and recovery | Handle SMS failure without false success | Superseded for clock-in by O2; the email recovery path (O6) sits in M3 |
