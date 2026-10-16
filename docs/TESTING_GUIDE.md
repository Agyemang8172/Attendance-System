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

> **Superseded by M5.** The punch endpoints no longer accept a staff session
> token. `POST /api/attendance/clock-in` and `/api/attendance/clock-out` now
> require a kiosk device token and a verified QR + PIN session (Scenarios
> P–S below). The dashboard button still sends the staff token, so the call
> now answers `401` instead of recording a punch. Read this scenario as
> historical UI context; punch testing happens at the kiosk now.

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

The scenarios below cover the M5 kiosk. They follow the same API-walkthrough
rules as Scenarios I–O. One new bearer type appears: a **kiosk device token**
from Scenario P, sent as `Authorization: Bearer <kiosk-token>` plus the
kiosk's own JSON body. Throughout, `<site-id>` is the site from Scenario K and
`<qrPayload>` is Ama Mensah's badge value from Scenario M.

> **Before the kiosk scenarios.** Two setup pieces sit outside the API.
>
> - The kiosk secrets in `backend/.env` (templates in `backend/.env.example`):
>   `KIOSK_TOKEN_KEY`, `QR_SECRET_KEY`, `PIN_HMAC_KEY`, `KIOSK_PAIRING_KEY`.
>   A kiosk route whose key is missing answers `500` on purpose.
> - A PIN the tester actually knows. The audited reset (Scenario J) sets a
>   random PIN and never reveals it — not in the response, not in the audit
>   log. The employee is expected to receive it out of band, which no
>   automated test can do. For local testing, write one directly into the
>   database once and re-run this after every reset you test:
>
>   ```bash
>   cd backend && node --env-file=.env -e "
>   const { createHmac, randomBytes } = require('crypto');
>   const { PrismaClient } = require('@prisma/client');
>   const prisma = new PrismaClient();
>   (async () => {
>     const user = await prisma.user.findUnique({
>       where: { email: 'ama.mensah@test.attendpro.com' },
>     });
>     if (!user) throw new Error('Ama Mensah not found — run Scenario I first');
>     const pin = '135790';
>     const pinSalt = randomBytes(16).toString('hex');
>     const pinHash = createHmac('sha256', process.env.PIN_HMAC_KEY)
>       .update(user.id + pin + pinSalt).digest('hex');
>     await prisma.user.update({
>       where: { id: user.id },
>       data: { pinHash, pinSalt, pinFailedCount: 0, pinLockedUntil: null },
>     });
>     await prisma.$disconnect();
>     console.log('PIN for Ama Mensah set to ' + pin);
>   })();
>   "
>   ```
>
> Rate limits are live outside `NODE_ENV=test`: pairing redemption allows
> about 10 wrong codes per 15 minutes per IP. Space the negative steps out or
> restart the backend if you trip the limiter.

### Scenario P: Pair a Kiosk Device (SUPERADMIN, M5)

- [ ] 1. Sign in as `superadmin@test.attendpro.com` through the API and call
      `POST /api/kiosk/pairing-codes` with:

      ```json
      { "label": "Front desk tablet" }
      ```

      Verify `201 { data: { kioskId, publicId, pairingCode, expiresAt } }`.
      The `expiresAt` time sits about 10 minutes ahead. Copy the
      `pairingCode` now.
- [ ] 2. Issue a second code with the same label. Verify the response reuses
      the same `kioskId` and `publicId` (there is still only one pending
      terminal) but carries a fresh `pairingCode`. The first code is now
      dead — this is the replace rule from Scenario M's badge reissue, applied
      to pairing codes.
- [ ] 3. Negative: call `POST /api/kiosk/pair` (no auth header) with
      `{ "pairingCode": "NOT-A-CODE" }`. Verify `400` with the message
      "Invalid or expired pairing code".
- [ ] 4. Negative: call `POST /api/kiosk/pair` with the **replaced** code from
      step 1. Verify the same `400` and the same message — a replaced code is
      indistinguishable from a wrong one.
- [ ] 5. Pair the device: call `POST /api/kiosk/pair` with the current code
      from step 2. Verify `200 { data: { token, publicId, expiresAt } }`,
      with `expiresAt` roughly 30 days out. Save the token as
      `<kiosk-token>` — later scenarios use it.
- [ ] 6. Negative: send step 5's body again. Verify the same generic `400` —
      the code was cleared the moment it paired.
- [ ] 7. Call `GET /api/kiosk/devices` as SUPERADMIN. Verify the device shows
      `state` `ACTIVE` with `pairedAt` and `lastSeenAt` set, and that no
      response field anywhere carries a pairing-code or token hash.
- [ ] 8. Negative: sign in as `hr@test.attendpro.com` and call both
      `POST /api/kiosk/pairing-codes` and `GET /api/kiosk/devices`. Verify
      `403` on both — pairing is a SUPERADMIN action (device management, O3).
- [ ] 9. Optional: expiry check. Issue a code and leave it unused past its
      10 minutes, then try to pair with it. Verify the same generic `400`.
      Skipping this is fine when the window is inconvenient — steps 3 and 4
      already proved the message itself.

### Scenario Q: Badge Identification at the Kiosk (kiosk token, M5)

- [ ] 1. With `<kiosk-token>` as the bearer, call `POST /api/kiosk/identify`
      with:

      ```json
      { "qrToken": "<qrPayload from Scenario M>" }
      ```

      Verify `201 { data: { sessionId, employeeDisplayName, permittedAction,
      locationResult } }` and that `employeeDisplayName` is "Ama Mensah".
      Read the full body: there is **no employee id**, no badge value, and no
      PIN field. `permittedAction` is `CLOCK_IN` while she has no open
      attendance row.
- [ ] 2. Location fields. If the kiosk was paired with a `siteId` (the
      Scenario K site), re-run step 1 with location fields added:

      ```json
      {
        "qrToken": "<qrPayload>",
        "latitude": 5.6037,
        "longitude": -0.187,
        "accuracyMeters": 10,
        "capturedAt": "2026-10-16T09:00:00.000Z"
      }
      ```

      Verify `locationResult` is `INSIDE` (the coordinates sit on the site).
      Without location fields, or when no site is paired, verify it returns
      `UNKNOWN` — flagged for review, never a block.
- [ ] 3. Negative: call identify with
      `{ "qrToken": "not-a-real-badge-token" }`. Verify `404` with the message
      "Badge not recognised. See HR."
- [ ] 4. Revoked badge: revoke Ama's credential (Scenario M step 4), then
      identify again. Verify `403` with the message "This badge is no longer
      valid. See HR." — a different refusal than the unknown one. Issue a
      fresh credential afterwards so the rest of the scenarios keep working.
- [ ] 5. Inactive employee: deactivate Ama Mensah (as in Scenario D), then
      identify with her **active** badge. Verify `403` with the message
      "This account is not active. See HR." Reactivate her afterwards.
- [ ] 6. Badge of another business: the design makes this refusal share the
      unknown-badge 404 body, so probing learns nothing. A second business is
      rarely present in a local database; if yours has one, identify from
      this kiosk with that business's badge and verify you get the same 404
      body as step 3. If not, note the gap and move on.
- [ ] 7. Evidence check: every refused call above wrote an
      `attendance_attempts` row with `step` `IDENTIFY` and outcome `REJECTED`
      (query the database as SUPERADMIN). Rows for unknown badges carry no
      employee id.
- [ ] 8. Negative: call identify without the kiosk token (or with a user
      token). Verify `401` — a badge alone reaches nothing.

### Scenario R: PIN Verify and the Atomic Punch (kiosk token, M5)

- [ ] 1. Identify Ama (Scenario Q step 1) and copy the `sessionId`. The
      session lives **2 minutes**, so keep moving.
- [ ] 2. Call `POST /api/kiosk/verify-pin` with:

      ```json
      { "sessionId": "<sessionId>", "pin": "135790" }
      ```

      Verify `201 { data: { result: "VERIFIED", action, status } }`. The
      `action` is recomputed by the server here, not carried over from the
      identify response.
- [ ] 3. Punch: call `POST /api/attendance/clock-in` with the kiosk token
      as the bearer:

      ```json
      {
        "verificationSessionId": "<sessionId>",
        "latitude": 5.6037,
        "longitude": -0.187,
        "accuracyMeters": 10,
        "capturedAt": "2026-10-16T09:05:00.000Z"
      }
      ```

      Verify `201 { data: attendance }` with the row `OPEN` and Ama as the
      employee. One badge scan plus one PIN turned into exactly one row.
- [ ] 4. Negative: send step 3's body again. Verify `409` with the message
      "Verification session was already used" — the session is single-use —
      and that no second attendance row appeared.
- [ ] 5. Negative: repeat step 3 with Ama's **staff** token as the bearer
      instead of the kiosk token. Verify `401` — punch routes take device
      tokens only (this is what supersedes the Scenario E walkthrough).
- [ ] 6. Wrong PIN: identify again and call verify-pin with
      `"pin": "123456"`. Verify `400` with the message "That PIN is not
      correct. Try again." Repeat until the **fifth** call: every response,
      including the lock-tripping one, has the same body — no count of
      attempts left. The **sixth** call verifies `429` with the message
      "Too many tries. Try again later or see HR."
- [ ] 7. Employee lock: run a fresh identify and a verify-pin for Ama with
      the correct PIN. Verify `429` with the message "Try again later or see
      HR." — the lock after five failures holds across sessions for about
      15 minutes, per employee, not per session. Re-run the setup snippet
      from the note above to clear the lock before continuing.
- [ ] 8. HR reset clears the lock: run Scenario J step 1 (the audited
      `reset-pin`). Then identify again and send a deliberately **wrong**
      PIN. Verify `400` (the lock is gone) rather than `429`. Also verify the
      sessionId from before the reset no longer works — the reset expires
      every open verification session for the employee.
- [ ] 9. Nothing fabricated: across steps 4–8, compare Ama's attendance rows
      before and after. Unknown badges and wrong PINs create **no** attendance
      row. The evidence lives in `attendance_attempts` (`step` `VERIFY`,
      outcome `REJECTED`, a reason string), never in `attendances`.
- [ ] 10. Expiry: identify once more, wait out the 2 minutes, then verify-pin
      with the correct PIN. Verify `400` with the message "Session expired.
      Scan your badge again."

### Scenario S: Clock-Out, Missing Closure, and the Night Shift (kiosk token, M5)

- [ ] 1. With the open row from Scenario R: identify Ama (response should now
      say `permittedAction` `CLOCK_OUT`), verify her PIN, and call
      `POST /api/attendance/clock-out` with the same body shape as the
      clock-in. Verify `200 { data: attendance }` with `clockOut` set,
      `sessionStatus` `CLOSED`, `closureReason` `VERIFIED_CLOCK_OUT`, and a
      positive `hoursWorked`.
- [ ] 2. Identify again. Verify `permittedAction` is back to `CLOCK_IN`.
- [ ] 3. Negative: identify, verify, and send the **clock-out** body while
      she has no open row. Verify `400` with the message "You need to have an
      active session open first" — then confirm that the same `sessionId`
      can still be used for a real clock-in. A refusal does not burn the
      session.
- [ ] 4. `CLOCK_OUT_MISSING`: make sure Ama is assigned to the morning shift
      (06:00–14:00, `shift-morning`). Clock her in during the morning, leave
      the row open, and clock out after 14:00. Verify the row closes with
      `status` `CLOCK_OUT_MISSING` — a session nobody closed inside the
      shift window flags instead of quietly looking normal.
- [ ] 5. Night shift: create the night shift of Scenario N if it does not
      exist (18:00–06:00, `crossesMidnight: true`) and assign it to Ama. In
      the evening, run identify → verify-pin → clock-in. After midnight, run
      identify → verify-pin → clock-out. Verify the row's date belongs to the
      day the shift **started** and `hoursWorked` covers the overnight span.
      Also verify the cross-midnight rule: a clock-out on the opening evening
      (before midnight, after 18:00) keeps the clock-in status, a clock-out
      between 00:00 and 06:00 is the shift closing normally, and one after
      06:00 flags `CLOCK_OUT_MISSING`. These steps need the right wall-clock
      windows, so run them when the times fit.

### Scenario T: Device Lifecycle (SUPERADMIN, M5)

- [ ] 1. Call `GET /api/kiosk/devices` as SUPERADMIN. Verify the list shows
      `publicId`, `label`, `siteId`, `state`, `pairedAt`, `lastSeenAt`,
      `tokenExpiresAt`, and `revokedAt` — and never a token or pairing-code
      hash (the dashboard sees states, not secrets).
- [ ] 2. `lastSeenAt` tracking: make any kiosk-authenticated call (an
      identify is enough), then re-list. Verify `lastSeenAt` moved to that
      call's time.
- [ ] 3. Renewal: call `POST /api/kiosk/token/renew` with the current
      `<kiosk-token>` as the bearer. Verify `200 { data: { token, expiresAt }
      }` with `expiresAt` about 30 days out. Save the new token. Then use the
      **old** token on an identify. Verify `401` — each renewal rotates the
      stored hash, so the previous token dies at once.
- [ ] 4. The 90-day ceiling, simulated by inspection: re-list the devices and
      verify that renewal moved `tokenExpiresAt` forward but did **not** move
      `tokenIssuedAt` — the maximum age counts from the original issue, and
      no amount of use restarts it. At 90 days or past it, the renew call
      sends the terminal back to `PENDING_PAIRING` (token data cleared,
      `tokenVersion` 0) and answers `401` with a "pair the device again"
      message. Nobody should wait 90 days to test this; the inspection above
      is the proof available locally.
- [ ] 5. Revoke: call `POST /api/kiosk/devices/<id>/revoke` with:

      ```json
      { "reason": "QA revoke test" }
      ```

      Verify the success response. Then send any kiosk-authenticated request
      with the stored token. Verify `401` immediately — revocation bumps the
      token version on the row, and every call rechecks the row, so the
      device fails on its next request rather than at day 30.
- [ ] 6. Negative: call revoke on the same device again. Verify `409` with a
      "Device is already revoked" message.
- [ ] 7. Re-pairing: issue a new pairing code with the same label. Verify it
      creates a **new** terminal row (a new `publicId`) instead of reusing
      the revoked one; the old device stays `REVOKED` in the list. Pairing
      the new row issues a fresh token on the new terminal.
- [ ] 8. History check: attendance rows the revoked device created keep
      their ids and values — revocation never deletes records.

### Scenario U: Correction Submission (STAFF / HR self, M5)

Corrections are self-scoped: an employee corrects **their own** rows. Sign in
as Ama Mensah through the API using the temporary password Scenario I
revealed (finish the forced password change if asked), so the correction
belongs to her.

- [ ] 1. Call `POST /api/attendance/corrections` with the id of today's
      attendance row for Ama (from Scenario R/S):

      ```json
      {
        "attendanceId": "<Ama's row for today>",
        "reason": "The kiosk recorded 09:05 but I arrived at 08:40; the badge reader was slow."
      }
      ```

      Verify `201 { data: { id, status: "SUBMITTED", reviewTier:
      "SAME_DAY" } }` — the row's date is today, so the tier is `SAME_DAY`.
- [ ] 2. Negative: send the same body again. Verify `409` with a message
      about a correction already awaiting review — one open correction per
      row.
- [ ] 3. Escalated tier: pick one of Ama's older **finished** rows that is
      still inside the window and submit. Verify `reviewTier` `ESCALATED` —
      the tier follows the record's date, not your opinion of it. If your
      database has no aged row inside the window, set one row's `date` a few
      days back directly in the database (owner-run) and retry.
- [ ] 4. Outside the window: move a row's `date` past the window (default
      seven days from the default policy's `correctionWindowDays`, Scenario
      O), then submit. Verify `409` with a message that names the window.
- [ ] 5. Negative: submit against `staff@test.attendpro.com`'s attendance row
      while signed in as Ama. Verify `404` — nobody corrects someone else's
      record, and the refusal does not confirm the record exists.
- [ ] 6. Negative: sign in as `superadmin@test.attendpro.com` and call the
      same endpoint. Verify `403` — SUPERADMIN is not on this contract row.
- [ ] 7. Negative: send an empty `reason` and again with over 2000
      characters. Both verify `400`.
- [ ] 8. Decision route: call `PATCH /api/hr/corrections/<id>/decision`.
      Verify it is not a live route in M5 — the decision endpoint lands later
      (M6 / HR area), so corrections stay `SUBMITTED` for now.

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