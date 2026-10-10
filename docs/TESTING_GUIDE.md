# Application Testing & QA Guide

**Application:** AttendPro — Attendance System
**Environment:** Local Development (`http://localhost:5173`)
**Target Audience:** Human QA Testers, Product Owners, Startup Founders
**Default Credentials Password:** `devos123` (universal across all test accounts)

---

## 1. Quick Start & Prerequisites

Start the three services in separate terminals, in this order:

1. **Prisma Postgres proxy** — `cd backend && npx prisma dev`
   (listens on port `51214`; the backend connects through it)
2. **Backend API** — `cd backend && npm run dev`
   (listens on port `8000`; `http://localhost:8000/api`)
3. **Frontend** — `npm run dev` (from the repository root)
   (listens on port `5173`; the Vite dev server feeds the browser)

Open `http://localhost:5173` in the browser. You will land on the sign-in page.

**First-time database setup (owner-run, destructive):**
- Seed accounts and shift rows are written by `backend/prisma/seed.ts`, which
  is gitignored and reads `SUPERADMIN_PASSWORD`, `HR_PASSWORD`, and
  `STAFF_PASSWORD` from the gitignored `backend/.env`. Set those three to
  `devos123` there before seeding, so the passwords below are exactly right.
  Then run `cd backend && npm run db:seed`.
- If you changed any seed password in `backend/.env`, use that value wherever
  this guide names `devos123`.

**Automated test suite (optional but a good smoke check):**
- Backend: `cd backend && npx vitest run` (needs the proxy from step 1;
  writes rows to the local database, so it is owner-run).
- Frontend: `npx vitest run` (from the repository root, runs in jsdom).

---

## 2. Seed Data Fixtures

### Standard test accounts (created by the automated suite, always available)

These are upserted by `backend/tests/fixtures.ts` the first time the backend
suite runs. They exist in the database from then on, are always active, and
never owe a password change.

| Account | Employee code | Role | Password |
|---|---|---|---|
| `superadmin@test.attendpro.com` | `EMP-9001` | SUPERADMIN | `devos123` |
| `hr@test.attendpro.com` | `EMP-9002` | HR | `devos123` |
| `staff@test.attendpro.com` | `EMP-9003` | STAFF | `devos123` |

### Seeded accounts (written by `seed.ts`)

| Account | Role | Notes |
|---|---|---|
| `superadmin@attendpro.com` | SUPERADMIN | first login forces a password change |
| `hr@attendpro.com` | HR | first login forces a password change |
| `staff@attendpro.com` | STAFF (Jordan Reed) | first login forces a password change |

The seeded accounts start with `mustChangePassword = true` (R4), so the very
first sign-in redirects to `/set-password`. The test accounts above bypass
that step, which makes them the faster path for feature testing.

### Supporting data

- Shifts: `shift-morning` 06:00–14:00, `shift-afternoon` 14:00–22:00.
- The 06:30 clock-in threshold marks a morning arrival as **late**.

---

## 3. Test Scenarios (Step-by-Step Walkthroughs)

### Scenario A: Authentication & Role Verification

- [ ] 1. Open `http://localhost:5173` — verify you are redirected to `/login`.
- [ ] 2. Sign in as `staff@test.attendpro.com` / `devos123`. Verify you land
      on the staff `/dashboard`.
- [ ] 3. Sign out from the account menu. Sign in as `hr@test.attendpro.com` /
      `devos123`. Verify you land on `/hr-dashboard`.
- [ ] 4. Sign out. Sign in as `superadmin@test.attendpro.com` / `devos123`.
      Verify you land on `/superadmin-dashboard`.
- [ ] 5. With HR signed in, open `http://localhost:5173/manage-staff` directly —
      verify no redirect. Open `/superadmin-dashboard` — verify HR is bounced
      to its own home.
- [ ] 6. Sign in with a wrong password and verify an error message appears and
      you stay on the sign-in page (no crash, no reveal about whether the
      account exists).
- [ ] 7. Sign in as `staff@attendpro.com` (seeded account). Verify the very
      first login lands on `/set-password`, a strong new password is accepted,
      and you are then routed to the staff home.

### Scenario B: Staff Management (SUPERADMIN and HR)

- [ ] 1. Sign in as `hr@test.attendpro.com` and open `/manage-staff`.
- [ ] 2. Open **Add Employee**. Verify `Role` is **grayed out / disabled** and
      the saved record is created as STAFF.
- [ ] 3. Create an employee (any first/last name, valid email, pick a shift).
      Verify the record appears in the active list and shows the temporary
      password in the response area.
- [ ] 4. Edit that employee. Verify `Role` is disabled for HR and the update
      saves without it.
- [ ] 5. Sign out, sign in as `superadmin@test.attendpro.com`. Open the same
      employee. Verify `Role` is **enabled** and a role change saves.
- [ ] 6. As SUPERADMIN, edit your **own** account. Verify `Role` is disabled
      for yourself (guards against self-elevation).
- [ ] 7. Try deactivating an HR account while signed in as HR — verify it is
      refused. Repeat as SUPERADMIN — verify it succeeds and the row moves to
      the inactive view.

### Scenario C: Admin Password Reset (forgot the temporary password)

- [ ] 1. Sign in as `hr@test.attendpro.com`, open `/manage-staff`.
- [ ] 2. On an active STAFF row, click **Reset password**.
- [ ] 3. Verify a two-step confirmation: the first screen asks you to confirm;
      the second reveals the new temporary password **once**, with a way to
      copy it.
- [ ] 4. Sign out, sign in as that employee with the revealed password. Verify
      the login lands on `/set-password` (forced change).
- [ ] 5. Repeat with `superadmin@test.attendpro.com` — verify SUPERADMIN may
      reset HR and STAFF, and verify resetting your own account is refused.

### Scenario D: Reactivation

- [ ] 1. Sign in as `superadmin@test.attendpro.com`, open `/manage-staff`, and
      switch the view to **Inactive**.
- [ ] 2. Verify the empty state (no inactive users) shows an actionable
      message rather than a bare table.
- [ ] 3. Deactivate an employee, then return to the inactive view and click
      **Reactivate**. Verify the employee is active again and appears in the
      active list.
- [ ] 4. Repeat as `hr@test.attendpro.com`. Verify the Reactivate action is
      **disabled** for HR (visible but unavailable — never hidden).
- [ ] 5. Sign in as the reactivated employee's account and verify a normal
      staff login works (no forced-change screen for a reactivated account
      that had already changed its password).

### Scenario E: Attendance Clock In / Clock Out (STAFF)

- [ ] 1. Sign in as `staff@test.attendpro.com`, open the staff `/dashboard`.
- [ ] 2. Click **Clock In**. Verify an open session is recorded and the button
      state changes to allow Clock Out.
- [ ] 3. Click **Clock Out**. Verify the record closes and shows hours worked.
- [ ] 4. Click **Clock In** again immediately — verify a second open session is
      rejected (one open session per user).

### Scenario F: Attendance Table Behaviour (HR / SUPERADMIN)

- [ ] 1. Sign in as `hr@test.attendpro.com` and open the HR dashboard.
- [ ] 2. Verify the attendance list defaults to **exceptions first** — late
      rows are on top and carry a late marker.
- [ ] 3. Click the **Date** column header. Verify the sort direction toggles
      (newest-first ↔ oldest-first) and the header announces the sort state.
- [ ] 4. With more than 12 rows, verify pagination shows 12 per page and a
      visible total row count.
- [ ] 5. Type in the search box and verify filtering by name, department, date,
      or status narrows the rows live.

### Scenario G: Monthly Report & Export (SUPERADMIN)

- [ ] 1. Sign in as `superadmin@test.attendpro.com`, open the
      `/superadmin-dashboard`.
- [ ] 2. Find the **Monthly Report** panel. Select a month and verify the row
      set filters to that month.
- [ ] 3. Click **CSV**. Verify a file named `attendance-<month>.csv` downloads
      and opens in a spreadsheet with headers and totals per row.
- [ ] 4. Click **PDF**. Verify a print-friendly report panel opens for the
      selected month.

### Scenario H: Edge Cases & Boundary Handling

- [ ] 1. Create an employee with a duplicate email — verify a clear error and
      no duplicate row.
- [ ] 2. Create an employee with a 6-character password — verify both the
      client form and the server reject it (S7 policy).
- [ ] 3. Try to use the app while a session token is invalid (clear
      `localStorage` in DevTools and reload) — verify the app returns you to
      `/login`.
- [ ] 4. Sign in as SUPERADMIN and open the HR dashboard directly — verify you
      are bounced to your own home.
- [ ] 5. As SUPERADMIN, change your own role or deactivate yourself — verify
      both are refused.
- [ ] 6. With one active SUPERADMIN left, try to deactivate or demote that
      account — verify a 409 "at least one active SUPERADMIN must remain".

---

## 4. Known Limitations & Notes

- **Rate limiting:** failed logins are throttled per IP (10 attempts / 15
  minutes). Rapid wrong-password attempts will start returning 429. Wait out
  the window or restart the backend (the limiter is skipped under
  `NODE_ENV=test`).
- **Forced password change:** an HR or SUPERADMIN resetting a password resets
  that account's `mustChangePassword` flag, so the next login of that user
  must set a new password before any app route opens.
- **Excel export:** the Excel path needs an extra dependency
  (`npm install xlsx`) and will show a toast instead of a file until it is
  installed. CSV and PDF always work.
- **Seed passwords:** all fixture accounts use `devos123`. The seeded
  `@attendpro.com` accounts read their passwords from the gitignored
  `backend/.env`; keep those values aligned with this guide or substitute the
  ones you set.
- **Deactivated sessions:** deactivating or deleting an account invalidates its
  existing sessions immediately — sign out and back in after reactivation.