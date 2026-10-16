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

The scenarios below test features that live mostly on the API. To call them,
sign in through the API once, copy the `token` from the response, and send it as
an `Authorization: Bearer <token>` header on every call:

```
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@test.attendpro.com","password":"devos123"}'
```

Where a step says `<id>`, paste an id you copied from an earlier response.
Ids in the steps are placeholders, not literal text. `page` defaults to 1 and
`limit` to 50 (max 100); list responses carry a `pagination` object with
`currentPage`, `totalPages`, and `total`.

### Scenario I: Employee Directory, Creation & Updates (HR / SUPERADMIN)

- [ ] 1. Sign in as `hr@test.attendpro.com` through the API and call
      `GET /api/hr/employees?page=1&limit=10`. Verify you get a paginated list
      and it contains only STAFF members. HR is scoped to STAFF in the list.
- [ ] 2. Try the filters: `GET /api/hr/employees?search=Ama`,
      `GET /api/hr/employees?department=Operations`, and
      `GET /api/hr/employees?isActive=false`. Verify each narrows the rows and
      the `pagination.total` matches what you see.
- [ ] 3. Still as HR, call `POST /api/hr/employees` with this body and verify a
      `201` response that contains `data` (the new employee) and `tempPassword`:

      ```json
      {
        "firstName": "Ama",
        "lastName": "Mensah",
        "email": "ama.mensah@test.attendpro.com",
        "department": "Operations",
        "role": "STAFF",
        "jobTitle": "Data Clerk"
      }
      ```

- [ ] 4. Verify the temporary password appears exactly once. Sending the same
      request again with the same email must return `409` (email taken). Copy
      the new employee's `id` and keep it — later scenarios use it.
- [ ] 5. Repeat the create call with `"role": "HR"`. Verify HR is refused with
      `403` (HR may only create STAFF). Test the same as SUPERADMIN and verify
      the same refusal — only SUPERADMIN account administration under
      `/api/users` changes roles.
- [ ] 6. As HR, call `PATCH /api/hr/employees/<id>` on the employee you created
      with `{ "department": "Finance", "jobTitle": "Data Assistant" }`. Verify
      the response returns the updated row and the change shows in step 2's
      department filter.
- [ ] 7. Negative: as HR, call `PATCH /api/hr/employees/<id>` where `<id>` is a
      HR or SUPERADMIN account id. Verify `403` — HR may update STAFF only.
- [ ] 8. As SUPERADMIN, call `PATCH /api/hr/employees/<id>` on your **own**
      account with `{ "isActive": false }` and again with
      `{ "role": "HR" }`. Both must return `409`: the last active SUPERADMIN
      cannot be deactivated or demoted.

### Scenario J: Audited Kiosk PIN Reset (HR / SUPERADMIN)

- [ ] 1. Sign in as `hr@test.attendpro.com` and call
      `POST /api/hr/users/<id>/reset-pin` where `<id>` is Ama Mensah's employee
      id from Scenario I, with this body:

      ```json
      { "reason": "Employee forgot PIN at the kiosk on 2026-10-16" }
      ```

      Verify a `201` response with `{ data: { userId, pinUpdatedAt } }`.
- [ ] 2. Read the full response body. Verify it does **not** contain the new
      PIN, the old PIN, or any PIN-like value. HR never sees the PIN.
- [ ] 3. Call `GET /api/audit?action=<pin-reset action>` as SUPERADMIN (or the
      audit endpoint with a `startDate` covering today). Verify a new audit row
      exists for this reset that names the actor, the target user, and the
      reason, and carries no PIN value.
- [ ] 4. Negative: call the same endpoint with `{}` (no reason). Verify `400`.
- [ ] 5. Negative: call it with a reason longer than 500 characters (paste
      501 characters of filler). Verify `400`.
- [ ] 6. Negative: call it with a well-formed but random UUID that does not
      exist. Verify `404` (a cross-business id returns the same refusal).
- [ ] 7. Negative: sign in as `staff@test.attendpro.com` and call the same
      endpoint against your own id. Verify `401` or `403` — STAFF cannot reach
      it.

### Scenario K: Sites & Geo-fences (SUPERADMIN)

- [ ] 1. Sign in as `superadmin@test.attendpro.com` and call `POST /api/sites`
      with:

      ```json
      {
        "name": "Accra Head Office",
        "latitude": 5.6037,
        "longitude": -0.187,
        "radiusMeters": 150
      }
      ```

      Verify `201` and that the response echoes the fields. Copy the site `id`.
- [ ] 2. Negative: send `radiusMeters: 10` (below 25) and again with
      `radiusMeters: 2000` (above 1000). Both must return `400` with a
      validation message.
- [ ] 3. Negative: send `latitude: 95` and `longitude: -190` in two further
      calls. Both must return `400`.
- [ ] 4. Negative: send the exact same body as step 1 again (same name). Verify
      `409` — names are unique per business.
- [ ] 5. Sign in as `hr@test.attendpro.com` and call `POST /api/sites`. Verify
      `403` — HR may read sites (`GET /api/sites`) but not create them.
- [ ] 6. As SUPERADMIN, call `GET /api/sites` and verify the new site appears
      with `isActive: true`.
- [ ] 7. Call `POST /api/sites/<id>/deactivate` (no body) and verify the
      success message.
- [ ] 8. Verify history survives: if any attendance attempts or kiosks already
      reference this site, confirm those rows still show the site id and name
      after deactivation. Deactivating a site removes it from new assessments
      but never deletes past records.

### Scenario L: Work Calendars & Exceptions (SUPERADMIN)

- [ ] 1. Call `GET /api/business/calendars` as `hr@test.attendpro.com` and
      verify the response is a list of `{ calendar, exceptions }` objects.
      HR may read calendars; SUPERADMIN edits them.
- [ ] 2. Switch to SUPERADMIN and call `PATCH /api/business/calendars/<id>`
      with:

      ```json
      {
        "timezone": "Africa/Accra",
        "saturday": false,
        "sunday": false
      }
      ```

      Verify the response returns the updated calendar and `GET` now shows the
      new timezone and weekday flags.
- [ ] 3. Call `POST /api/business/calendars/<id>/exceptions` with:

      ```json
      { "date": "2026-12-25", "kind": "HOLIDAY", "name": "Christmas Day" }
      ```

      Verify `201` and that the exception appears in the calendar's
      `exceptions` list on the next `GET`.
- [ ] 4. Add a working day: call the same endpoint with
      `{ "date": "2026-12-27", "kind": "WORKING_OVERRIDE", "name": "Year-end cover" }`.
      Verify `201`.
- [ ] 5. Negative: repeat step 3's body exactly (same date). Verify `409` —
      one exception per calendar and date.
- [ ] 6. Negative: send `"kind": "SICK_DAY"`. Verify `400` — only `HOLIDAY`
      and `WORKING_OVERRIDE` are accepted.
- [ ] 7. Negative: send `"date": "25/12/2026"`. Verify `400` — the format must
      be `YYYY-MM-DD`.
- [ ] 8. One-default rule: if a second calendar exists (see the note below),
      call `PATCH /api/business/calendars/<second-id>` with
      `{ "isDefault": true }`. Re-list the calendars and verify the second
      calendar is now default and the first is no longer marked default —
      at most one default per business.

> There is no documented route that creates a work calendar. The default-swap
> check in step 8 needs two calendars, so it depends on the seed data or any
> creation path added later. If your local database has only one calendar,
> note the gap and move on.

### Scenario M: QR Badge Credentials (SUPERADMIN)

- [ ] 1. As SUPERADMIN, call
      `POST /api/business/employees/<id>/qr-credential` where `<id>` is Ama
      Mensah's employee id. Verify `201` with `data.id` (credential id) and
      `data.qrPayload`. Copy the payload now — it is shown exactly once.
- [ ] 2. Call `GET`-style re-reads or re-issue on purpose: call the same
      endpoint again. Verify `201` again but with a **different** `qrPayload`.
      The first credential is now revoked: in the database, its
      `qr_credentials` row has `revoked_at` set. Issue another and revoke it
      afterwards (step 4) if you want to keep the badge stable.
- [ ] 3. Negative: sign in as `hr@test.attendpro.com` and call the same
      endpoint. Verify `403` — only SUPERADMIN issues badges.
- [ ] 4. As SUPERADMIN, call
      `POST /api/business/qr-credentials/<credential-id>/revoke` (no body).
      Verify the success response and that the credential shows as revoked.
- [ ] 5. Negative: revoke the same credential id again, or use a random
      well-formed UUID. Verify `404` (or the appropriate already-revoked
      refusal) — nothing is silently accepted.
- [ ] 6. Verify in the audit log that issuance and revocation each wrote a row
      (action `qr.reissued` on issuance) and that no audit row contains the
      payload value.

### Scenario N: Shifts & Shift Assignments (SUPERADMIN, M3)

- [ ] 1. Call `POST /api/business/shifts` as SUPERADMIN with:

      ```json
      {
        "name": "Night Security",
        "startMinute": 1080,
        "endMinute": 360,
        "crossesMidnight": true
      }
      ```

      Minutes count from 00:00, so 1080 is 18:00 and 360 is 06:00. Verify
      `201` and copy the shift id.
- [ ] 2. Negative: send `startMinute: 1440`. Verify `400` — the range is
      0..1439 (1439 is 23:59).
- [ ] 3. Negative: send `{ "startMinute": 480, "endMinute": 300 }` without
      `crossesMidnight`. Verify `400` — end must be after start unless the
      shift crosses midnight. Re-send with `crossesMidnight: true` and verify
      it is accepted (then deactivate this throwaway shift with
      `POST /api/business/shifts/<id>/deactivate`).
- [ ] 4. Shifts have **no delete route**. Verify this: try
      `DELETE /api/business/shifts/<id>` and confirm it is not a valid route.
      Deactivation is the only removal path, and it never deletes attendance
      rows.
- [ ] 5. Assign the shift: call
      `POST /api/business/shifts/<shift-id>/assignments` with:

      ```json
      { "employeeId": "<Ama Mensah's id>", "effectiveFrom": "2026-10-20" }
      ```

      Verify `201 { data: assignment }` and copy the assignment id.
- [ ] 6. Verify the sync in the database: the `users` row for Ama Mensah now
      has `shift_id` equal to the assigned shift.
- [ ] 7. Assign her to a second shift with a later `effectiveFrom` (for example
      `2026-10-27`). Verify `201`, then call
      `GET /api/business/assignments?employeeId=<Ama Mensah's id>` and verify
      the first assignment now has `effectiveTo` set to the second one's
      `effectiveFrom` — the open assignment was auto-closed and only one is
      still open.
- [ ] 8. Close the newest assignment: call
      `DELETE /api/business/assignments/<assignment-id>` and verify success.
      Re-list the assignments and verify that row's `effectiveTo` is now set.
      Nothing is deleted from the table; history is closed, not removed.
- [ ] 9. Negative: call the assignment endpoint with an employee id that does
      not exist. Verify `404`.

### Scenario O: Workplace Policies & Versions (SUPERADMIN, M3)

- [ ] 1. Call `GET /api/business/policies` as SUPERADMIN and note whether a
      policy already exists (the automated suite or previous testing may have
      created one).
- [ ] 2. If none exists, call `POST /api/business/policies` with:

      ```json
      {
        "name": "Default timing policy",
        "graceLateMinutes": 15,
        "graceEarlyMinutes": 10,
        "earlyThresholdMinutes": 20,
        "autoClockOutEnabled": true,
        "autoClockOutBufferMinutes": 120,
        "autoClockOutMaxOpenMinutes": 840,
        "correctionWindowDays": 7,
        "geoFenceRadiusMeters": 150,
        "locationAccuracyThresholdMeters": 50,
        "gpsFreshnessSeconds": 60,
        "observePublicHolidays": true,
        "effectiveFrom": "2026-10-20"
      }
      ```

      Verify `201 { data: { policy, version } }`. The first policy created
      becomes the default, so verify the default flag is set on it.
- [ ] 3. Re-check `GET /api/business/policies`. Verify the response shows the
      policy with its versions list and that version 1 matches the values you
      sent.
- [ ] 4. Publish a change: call `POST /api/business/policies/<id>/versions`
      with the same fields but `graceLateMinutes: 10` and
      `effectiveFrom: "2026-11-01"`. Verify `201`. Re-list the policies and
      verify the old version is closed with an `effectiveTo` and the new one
      is open from `2026-11-01`.
- [ ] 5. Negative: call the versions endpoint again with an `effectiveFrom`
      **before** the current version's start (for example `2026-10-25`).
      Verify the request is rejected with a validation or conflict status —
      versions must start after the version now in force.
- [ ] 6. Negative: send `graceLateMinutes: 200`. Verify `400` — the allowed
      range is 0..120.

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