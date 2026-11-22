# Implementation Plan: AttendPro M9 — Test Suite, CI, Security Review, Close-Out

- **Date:** 2026-10-18
- **Milestone:** M9 (final milestone: full test coverage, CI pipeline, security review, project close-out)
- **DependsOn:** M8 (committed `e6f41eb` — all portals, design system complete)
- **Status:** Approved by owner 2026-10-18 — CI: GitHub Actions; Test DB: Prisma Postgres instance; Coverage: enforced ≥90% statements/≥85% branches; E2E: Chromium only
- **Target:** Production-ready AttendPro v1 with full test coverage, CI/CD pipeline, security audit, and documentation

---

## Overview

M9 closes the AttendPro v1 programme. All features are built (M0–M8). This milestone delivers:

1. **Complete test suite** — unit, integration, and e2e tests covering all M1–M8 features
2. **Testing guide** — expanded `docs/TESTING_GUIDE.md` with all scenarios, seed data, dev accounts
3. **CI/CD pipeline** — GitHub Actions for lint, typecheck, test, security scan, build
4. **Security review** — OWASP Top 10 audit, dependency scan, auth/authorization verification
5. **Close-out docs** — CHANGELOG, release notes, deployment runbook, lessons learned

---

## Phase Plan (each phase = one agent)

### Phase 0 — Test Infrastructure & Configuration
- Wire Playwright for e2e (already approved M8-R12, install `@playwright/test`)
- Configure vitest + Playwright in `vite.config.ts` (test block, setup files)
- Add test scripts to `package.json`: `test:unit`, `test:e2e`, `test:all`
- Set up test database seeding (separate test DB per O14)
- Configure MSW or test API mocking for frontend e2e

### Phase 1 — Backend Test Suite (Unit + Integration)
- Test all controllers: auth, attendance, corrections, help requests, employees, reports, audit, settings, kiosk
- Test middleware: auth, role guards, kiosk auth, job auth, rate limiters
- Test utils: statusEngine, shiftWindow, location, auditWriter, tenant, PIN hashing
- Test jobs: autoClockOut (idempotency, drift, flagging, closure reasons)
- Test validators: all zod schemas, edge cases
- Test Prisma transactions, RLS policies (where testable)
- Coverage target: ≥90% statements, ≥85% branches

### Phase 2 — Frontend Test Suite (Component + E2E)
- Component tests for all shared primitives: PageHeader, SectionHeader, Pill, SearchInput, Pagination, ModalShell, ConfirmDialog, FilterBar, AttendanceTable, StaffTable, KpiCard, Skeleton, charts
- Component tests for all screens: Landing, Login, StaffDashboard, StaffAttendance, StaffSchedule, StaffOffDays, StaffHelpRequests, StaffCorrections, Profile, StaffChangePin, HrDashboard, HrAttendance, HrExceptions, ManageStaff, HrHelpRequests, HrCorrections, HrReports, HrAudit, SuperAdminDashboard, SuperAdminSettings, admin screens
- E2E tests (Playwright) for critical user journeys:
  - Staff: login → dashboard → attendance → schedule → help request → correction → profile → change PIN → logout
  - HR: login → dashboard → attendance register → exceptions → employee management → PIN reset → help queue → corrections queue → decision panel → reports → CSV export → audit history
  - SA: login → dashboard → settings → shift management → policies → calendars → sites → devices → reports → audit log
  - Kiosk: device pairing → QR scan → PIN entry → clock in/out → lockout recovery
  - Public: landing page → login → role redirect

### Phase 3 — Testing Guide (docs/TESTING_GUIDE.md)
- Expand to cover all M1–M8 scenarios with step-by-step instructions
- Add seed data definitions (dev accounts with `historical test credential (removed)` universal password)
- Include error state screenshots, expected API responses
- Document browser testing checklist for 375/768/1440 viewports
- Add troubleshooting section

### Phase 4 — CI/CD Pipeline (GitHub Actions)
- Workflow: `.github/workflows/ci.yml`
  - Lint: `npm run lint` (if ESLint configured) / typecheck
  - Test: `npm run test:unit` + `npm run test:e2e` (with Playwright)
  - Security: `npm audit`, dependency scan, gitleaks
  - Build: `npm run build`
- Workflow: `.github/workflows/deploy.yml` (manual trigger, requires approval)
- Cache node_modules, Playwright browsers
- Run on PRs and pushes to main

### Phase 5 — Security Review
- OWASP Top 10 audit: auth, authorization, input validation, injection, crypto, logging
- Dependency vulnerability scan (`npm audit`, GitHub Dependabot)
- JWT handling review (token versioning, refresh, logout)
- Rate limiter effectiveness
- CORS, CSP, security headers
- SQL injection / Prisma query safety
- RLS policy verification
- Secrets management (no hardcoded secrets, .env.example sync)

### Phase 6 — Close-Out Documentation
- CHANGELOG.md (from conventional commits)
- Release notes v1.0.0
- Deployment runbook (database, migrations, env vars, health checks)
- LESSONS.md update
- README.md update with quickstart
- Archive decision register supersessions

---

## Gates (must pass before commit)

| Gate | Command | Threshold |
|------|---------|-----------|
| TypeScript | `npm run typecheck` | 0 errors |
| Unit tests | `npm run test:unit` | 100% pass, ≥90% coverage |
| E2E tests | `npm run test:e2e` | 100% pass |
| Lint/UI taste | `bash .agents/scripts/ui-taste-check.sh .` | Pass |
| Humanizer | `bash .agents/scripts/humanize-check.sh <docs>` | Clean |
| DB check | `bash .agents/scripts/db-check.sh` | Pass |
| Env check | `bash .agents/scripts/env-check.sh .` | Pass |
| Security scan | `npm audit` + gitleaks | No CRITICAL/HIGH |

---

## Owner Decisions — CONFIRMED (2026-10-18)

| # | Item | Confirmed |
|---|------|-----------|
| 1 | CI provider | GitHub Actions (existing repo workflows) |
| 2 | Test DB strategy | Prisma Postgres designated test instance (O14) |
| 3 | Coverage enforcement | ≥90% statements, ≥85% branches enforced in CI |
| 4 | E2E browser matrix | Chromium only (Playwright default) |
| 5 | Deploy target | Documentation only in M9; real deploy in future milestone |
| 6 | Security scan tools | npm audit + gitleaks (no paid tools) |

---

## Amendment — 2026-10-20 (Coverage gate scope)

The original gate applied 90/85 to the frontend `npm run test:unit` command,
while the only phase-level coverage target was written under Phase 1 (backend).
The owner resolved the conflict on 2026-10-20 (option B):

- **Backend:** 90% statements and 85% branches, enforced in CI through
  `backend` `npm run test:coverage`. The first measurement on 2026-10-20 was
  63.78% statements / 64.50% branches: eight controllers had no request-level
  tests. The M9 campaign closed the gap with request-level lane suites plus
  direct guard and failure-injection tests. The final measured result is
  93.43% statements / 85.93% branches / 98.05% functions / 93.43% lines across
  22 files and 590 tests; the 90/85 thresholds are now on.
- **Frontend:** a staged ratchet. The M9 baseline is 29.95% statements, 49.79%
  functions and 71.38% branches. Every later milestone raises the statement and
  line floor by at least 10 points and the branch floor by at least 3, until the
  suite reaches 90/85. The M9 floor is 29/71/49/29 and `npm run test:coverage`
  passes at 29.95/71.38/49.79/29.95.
- The 90/85 frontend target in the gate table above is superseded by this
  amendment. The floors live in `vitest.config.ts`, so a regression fails CI.

---

## Constraints

- Zero database schema changes in M9 (all migrations done M1–M8)
- No new production dependencies without owner approval
- All test accounts use universal password `historical test credential (removed)`
- Documentation must pass humanizer check
- No git pushes without owner approval