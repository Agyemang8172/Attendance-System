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
>     const pin = '1357';
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
      { "sessionId": "<sessionId>", "pin": "1357" }
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
      `"pin": "1234"`. Verify `400` with the message "That PIN is not
      correct. Try again." Repeat until the **tenth** call: every response,
      including the lock-tripping one, has the same body — no count of
      attempts left. The **eleventh** call verifies `429` with the message
      "Too many tries. Try again later or see HR."
- [ ] 7. Employee lock: run a fresh identify and a verify-pin for Ama with
      the correct PIN. Verify `429` with the message "Try again later or see
      HR." — the lock after ten failures holds across sessions for about
      5 minutes, per employee, not per session. Re-run the setup snippet
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

### Scenario V: Automatic Clock-Out Job (M6)

A background job sweeps the attendance table for open sessions whose scheduled
shift end plus the policy's buffer has passed and closes them automatically.
Only rows whose policy record itself cannot be resolved are flagged to HR;
since the owner's 2026-10-17 R10 ruling, an open session with automatic
clock-out enabled but no resolvable shift window closes at the policy's
maximum open duration instead of being flagged. Two routes
serve it (API contracts §9): the run sweep and the status read. The walkthrough
reuses the kiosk punch from Scenarios Q and R; the scenario has no screen of
its own.

> **Before this scenario: the job token.** The run route refuses to serve
> without `JOB_TOKEN` in the server environment; with the value unset it
> answers `401` to every caller, a fail-closed rule.
>
> - The variable is documented in the root `.env.example`
>   (`JOB_TOKEN=replace_with_a_long_random_secret`). The backend loads its
>   own gitignored `backend/.env` at startup, so also put the line there,
>   next to `JWT_SECRET`, and restart the backend. Generate a long random
>   secret the same way you would for `JWT_SECRET`:
>
>   ```bash
>   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
>   ```
>
> - Put the same value into your test shell so the curl steps can read it:
>   `export JOB_TOKEN=<the value you generated>`.
> - The token is a server secret, not a user token. It carries no employee
>   identity and proves nothing about a person. Only the two `/api/jobs`
>   routes accept it; sent as a bearer to any user or kiosk route it fails
>   the normal token check with `401`.
> - The run route accepts 5 calls per minute per IP. The job is meant to run
>   every 15 minutes, driven by an external scheduler (decision O8), so a
>   human tester never trips this unless hammering. A `429` means wait out
>   the minute and continue.
> - A punch needs Ama Mensah's badge (Scenario M) and her known PIN (the
>   setup note before Scenario P). The date, policy, and snapshot edits
>   below are owner-run database changes, the same approach Scenario U
>   takes for aged rows.

- [ ] 1. Turn automatic clock-out on. As SUPERADMIN, call
       `GET /api/business/policies` (Scenario O) and check whether any
       version in force has `autoClockOutEnabled` true. If none is live, call
       `POST /api/business/policies/<id>/versions` with the Scenario O body,
       keep `autoClockOutEnabled: true`, and set `effectiveFrom` to today.
       Verify `201`. Note the offset the job will use: the version's
       `autoClockOutOffsetMinutes` when it is set, otherwise
       `autoClockOutBufferMinutes` (default 120).

- [ ] 2. Open a fresh session for Ama Mensah. Pair the kiosk (Scenario P),
       then run identify, verify-pin, and `POST /api/attendance/clock-in`
       exactly as Scenarios Q and R walk them. Verify `201` and an OPEN
       attendance row for her. The punch freezes what the job later reads:
       the shift minute snapshots and the policy version id stamped on the
       row at punch time.

- [ ] 3. Make the session overdue. Eligibility holds once
       `now >= (shift end of the row's date) + offset`, and the dependable
       way to arrange that by hand is an owner-run database edit that moves
       the row's `date` back a few days. Only `date` changes; the snapshot
       columns stay as punched:

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const user = await prisma.user.findUnique({
           where: { email: 'ama.mensah@test.attendpro.com' },
         });
         if (!user) throw new Error('Ama Mensah not found — run Scenario I first');
         const row = await prisma.attendance.findFirst({
           where: { userId: user.id, sessionStatus: 'OPEN' },
           orderBy: { clockIn: 'desc' },
         });
         if (!row) throw new Error('No open attendance row for Ama Mensah');
         const date = new Date(Date.now() - 2 * 86400000);
         await prisma.attendance.update({ where: { id: row.id }, data: { date } });
         console.log('Attendance ' + row.id + ' moved to ' + date.toISOString().slice(0, 10));
         await prisma.$disconnect();
       })();
       "
       ```

       On the morning shift the snapshots say 14:00 on that date, so with the
       default buffer the job closes the row at 16:00 of that same date. An
       alternative with no edit: a punch taken later than the shift end plus
       the buffer is eligible straight away, no matter when you then run the
       sweep.

- [ ] 4. Run the sweep:

       ```bash
       curl -s -X POST http://localhost:8000/api/jobs/auto-clock-out/run \
         -H "Authorization: Bearer $JOB_TOKEN" \
         -H "Content-Type: application/json" -d '{}'
       ```

       Verify `200` with `success` true and
       `data: { closed: 1, flagged: 0, businesses: 1 }` alongside a `message`
       naming the job. The body may also be omitted entirely;
       `{"businessId": "<uuid>"}` aims the pass at one business.
       `businesses` counts the active businesses swept, one in a local
       database.

- [ ] 5. Read the status:

       ```bash
       curl -s http://localhost:8000/api/jobs/status \
         -H "Authorization: Bearer $JOB_TOKEN"
       ```

       Verify `200` with `data: { lastRun, closed: 1, flagged: 0 }` and a
       `lastRun` timestamp within the last minute. The counts are read back
       out of the audit rows, so they describe the most recent pass.

- [ ] 6. Verify the write in the database. Open the attendance row and check
       `sessionStatus` `CLOSED`, `status` `AUTO_CLOSED`,
       `closureReason` `AUTO_CLOCK_OUT`, a `clockOut` at 16:00 of the row's
       date (shift end plus the 120-minute buffer), and `hoursWorked`
       recomputed from the stored `clockIn`. The `audit_logs` table holds one
       row with `actor_type` `SYSTEM`, action `job.auto_clock_out_closed`,
       and the attendance id as the target.

- [ ] 7. Check the console. The backend terminal prints exactly one summary
       line per pass: `"Auto clock-out sweep finished"` with the `closed`,
       `flagged`, and `businesses` counts and `event: "auto_clock_out_run"`.
       No employee id or row id appears on that line; the per-row detail
       lives in `audit_logs`.

- [ ] 8. Idempotence. Run step 4's curl again straight away. Verify every
       count is `0`, `GET /api/jobs/status` reports the new pass with
       `closed: 0`, and the attendance row still carries the values from
       step 6. The second pass matched nothing because the row is no longer
       OPEN; nothing was written twice.

- [ ] 9. A genuine clock-out wins. Punch a fresh open session for Ama
       (identify, verify-pin, clock-in), move its `date` back with step 3's
       edit, and then let her close it herself through the kiosk before you
       run the job (identify, verify-pin,
       `POST /api/attendance/clock-out`, Scenario S). A punch after the
       shift end closes her row with `status` `CLOCK_OUT_MISSING` and
       `closureReason` `VERIFIED_CLOCK_OUT` at her real time. Now run the
       sweep. Verify `closed: 0` and that her row still carries her own
       clock-out time, `CLOCK_OUT_MISSING`, and no `AUTO_CLOSED` anywhere.
       The job only touches rows still OPEN.

- [ ] 10. Disabled policy. An overdue OPEN row must be left alone once the
       business turns the job off. Turn it off with an owner-run edit on the
       version row the row stamps (publishing a version cannot flip an
       already-live one immediately):

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const row = await prisma.attendance.findFirst({
           where: { sessionStatus: 'OPEN' },
           orderBy: { clockIn: 'desc' },
           select: { id: true, policyVersionId: true },
         });
         if (!row) throw new Error('No open attendance row found');
         if (!row.policyVersionId) throw new Error('Row carries no policy version');
         await prisma.policyVersion.update({
           where: { id: row.policyVersionId },
           data: { autoClockOutEnabled: false },
         });
         console.log('Auto clock-out disabled on version ' + row.policyVersionId);
         await prisma.$disconnect();
       })();
       "
       ```

       Punch a fresh open session for Ama, move its `date` back, and run the
       sweep. Verify `closed: 0` and `flagged: 0`, the row left exactly as it
       stood: still OPEN with the `status` the clock-in graded, no review
       flag, and no `audit_logs` row for it. The missing flag itself stays
       where the lifecycle puts it (a session nobody closed reads
       `CLOCK_OUT_MISSING` at close-out time); the job's silence is the
       point. Run the snippet again with `autoClockOutEnabled: true` before
       the next step.

- [ ] 11. Unresolvable window — two cases (owner ruling R10, 2026-10-17).
       A row whose shift window cannot be resolved CLOSES at the policy's
       maximum open duration when its policy record resolves and automatic
       clock-out is enabled, and is still flagged `REQUIRES_REVIEW` when no
       usable policy record can be found.

       Case (i). Punch a fresh open session, then edit that row in the
       database so its shift window cannot be resolved: set
       `shiftEndMinuteSnapshot` to `null` (staging needs the edit because
       every kiosk punch stamps the snapshots) and move `clockIn` back about
       three days, `date` along with it. Moving `date` alone would do
       nothing here — with no end snapshot the job measures the session from
       the stored `clockIn` — so `clockIn` itself must sit more than 14
       hours in the past:

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const user = await prisma.user.findUnique({
           where: { email: 'ama.mensah@test.attendpro.com' },
         });
         if (!user) throw new Error('Ama Mensah not found — run Scenario I first');
         const row = await prisma.attendance.findFirst({
           where: { userId: user.id, sessionStatus: 'OPEN' },
           orderBy: { clockIn: 'desc' },
         });
         if (!row) throw new Error('No open attendance row for Ama Mensah');
         const clockIn = new Date(Date.now() - 3 * 86400000);
         const date = new Date(Date.UTC(
           clockIn.getUTCFullYear(),
           clockIn.getUTCMonth(),
           clockIn.getUTCDate()
         ));
         await prisma.attendance.update({
           where: { id: row.id },
           data: { clockIn, date, shiftEndMinuteSnapshot: null },
         });
         console.log('Attendance ' + row.id + ' moved back with no end snapshot');
         await prisma.$disconnect();
       })();
       "
       ```

       Run the sweep (step 4's curl). Verify `closed: 1` and `flagged: 0`.
       The row closes at the maximum rather than being flagged:
       `sessionStatus` `CLOSED`, `status` `AUTO_CLOSED`,
       `closureReason` `AUTO_CLOCK_OUT`, a `clockOut` exactly 14 hours
       (the default `autoClockOutMaxOpenMinutes`; a version carrying a
       different value closes at that value instead) after the stored
       `clockIn`, and `hoursWorked` recomputed over that span. The
       `audit_logs` table holds one row with `actor_type` `SYSTEM` and
       action `job.auto_clock_out_closed`, whose reason names the maximum
       minutes and explains there was no scheduled shift window.
       `GET /api/jobs/status` reflects `closed: 1` for the
       latest pass.

       Case (ii). No usable policy record: punch a fresh open session, then
       stage the unresolvable-policy case with an owner-run edit. The row
       loses its stamped `policyVersionId` and the business default loses
       the `isDefault` flag the job's fallback lookup would otherwise read,
       so no version is resolvable at all:

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const row = await prisma.attendance.findFirst({
           where: { sessionStatus: 'OPEN' },
           orderBy: { clockIn: 'desc' },
           select: { id: true, businessId: true },
         });
         if (!row) throw new Error('No open attendance row found');
         await prisma.attendance.update({
           where: { id: row.id },
           data: { policyVersionId: null },
         });
         const policy = await prisma.workplacePolicy.findFirst({
           where: { businessId: row.businessId, isDefault: true },
         });
         if (!policy) throw new Error('No default policy — case already staged');
         await prisma.workplacePolicy.update({
           where: { id: policy.id },
           data: { isDefault: false },
         });
         console.log('Row ' + row.id + ' now has no usable policy record');
         await prisma.$disconnect();
       })();
       "
       ```

       Run the sweep. Verify `flagged: 1` and `closed: 0`. The row shows
       `status` `REQUIRES_REVIEW`, a `requiresReviewReason` naming the
       missing policy version, and `sessionStatus` `OPEN` unchanged, so
       HR's close-out still applies. `GET /api/jobs/status` reflects
       `flagged: 1` for the latest pass. Afterwards put `isDefault` back to
       `true` on the same policy row (run the edit again with
       `isDefault: true`); the attendance row itself stays in review until
       HR closes it.

- [ ] 12. Concurrency. Fire two runs at once:

       ```bash
       curl -s -X POST http://localhost:8000/api/jobs/auto-clock-out/run \
         -H "Authorization: Bearer $JOB_TOKEN" -d '{}' -o run1.json &
       curl -s -X POST http://localhost:8000/api/jobs/auto-clock-out/run \
         -H "Authorization: Bearer $JOB_TOKEN" -d '{}' -o run2.json &
       wait
       cat run1.json run2.json
       ```

       One caller gets `200` and the other `409` with
       `{"success":false,"message":"Another run is already in progress"}`:
       the sweep holds an advisory lock and a second caller is refused
       rather than queued behind a duplicate pass. Timing caveat, stated
       plainly: on a local database with one settled row the sweep can
       finish in milliseconds, so some attempts answer two 200s. Fire the
       pair a few times, or while step 11's staged row makes the pass last a
       moment.

- [ ] 13. Authorization. Send the run route no authorization header at all
       and verify a generic `401` "Unauthorized" body, with nothing revealed
       about the configuration. Send a SUPERADMIN session token instead of
       `JOB_TOKEN` and verify `401` again: the run route takes the job token
       only. On `GET /api/jobs/status` the three outcomes are: SUPERADMIN
       session → `200` reporting their own business's numbers, HR session →
       `403`, job token → `200` over every business. Last, send the job
       token as the bearer anywhere else (for example `GET /api/audit`) and
       verify `401`; the token opens the two job routes and nothing else.

The scenarios below cover the M7 features: help requests, correction decisions
with the no-self-approval backstop, reports with the CSV export, and the audit
trail. They follow the same API-walkthrough rules as Scenarios I–V. All four
report routes, both help-request HR routes, the decision route, and the audit
trail answer to an HR or SUPERADMIN token (`hr@test.attendpro.com` or
`superadmin@test.attendpro.com`, password `devos123`); Scenario X's drift test
reuses the `JOB_TOKEN` export from Scenario V's setup note.

### Scenario W: Help Requests End to End (STAFF self + HR lane, M7)

An employee who cannot fix their own access files a help request; HR answers it
from the business-wide queue. The requester and the tenant are always taken
from the signed-in caller, so no payload can file a ticket for someone else.

> The staff submission route is throttled: five `POST` calls per account (and
> its IP address) per 15 minutes. Do not rapid-fire the negative steps below —
> the limiter answers `429` with "Too many requests, please try again later."
> A backend restart clears the counter (limiters are skipped under
> `NODE_ENV=test`).

- [ ] 1. Sign in as `staff@test.attendpro.com` through the API and call
       `POST /api/staff/help-requests` with:

       ```json
       {
         "category": "pin",
         "subject": "Front desk kiosk will not accept my PIN",
         "body": "The reader beeps twice and goes back to the PIN prompt. I get locked out after ten tries."
       }
       ```

       Verify `201 { success: true, message: "Help request submitted",
       data: { id, status: "OPEN" } }`. `category` must be one of `pin`,
       `kiosk`, `profile`, `access`, `other`. Copy the `id` — call it request A.
- [ ] 2. Negative sizes: a 2-character `subject` returns `400 "Validation
       failed"` with the errors array naming the 3-character minimum; a
       121-character subject names the 120 cap; an empty `body` names the
       required description (the cap is 4000). No row is written for any of
       them.
- [ ] 3. Call `GET /api/staff/help-requests`. Verify your own queue, newest
       first, each row carrying `id`, `category`, `subject`, `body`, `status`,
       `resolutionNote`, `resolvedAt`, `createdAt`, `updatedAt` and no
       `requester` object. The `?status=OPEN` query narrows the list.
- [ ] 4. Sign in as Ama Mensah (Scenario I's temporary password) and file her
       own request (category `kiosk`). Copy its `id` — call it request B.
- [ ] 5. Negative: as `staff@test.attendpro.com`, call
       `GET /api/staff/help-requests/<request B id>`. Verify `403 { success:
       false, message: "Access denied" }` — the ticket exists in the same
       business, but it is not yours to read.
- [ ] 6. Negative: call the same GET with a well-formed UUID that does not
       exist (and again with an id from another business, if your database has
       one). Verify both return the same generic `404 { success: false,
       message: "Request not found" }`.
- [ ] 7. Sign in as `hr@test.attendpro.com` and call
       `GET /api/hr/help-requests`. Verify the whole business queue, newest
       first, with a `requester` object (`id`, `firstName`, `lastName`,
       `email`) on every row so HR can reach the person.
- [ ] 8. Call `PATCH /api/hr/help-requests/<request A>` with
       `{ "status": "IN_REVIEW" }` (optional `resolutionNote` rides along).
       Verify `200 { success: true, message: "Help request updated", data }`
       with `status` `IN_REVIEW` and `resolvedAt` `null`. In the database, the
       `audit_logs` table holds an action `help.request_status_changed` row.
- [ ] 9. Call the PATCH again with `{ "status": "RESOLVED",
       "resolutionNote": "PIN reset done; the badge reader was also cleaned." }`.
       Verify `200` with the note echoed and `resolvedAt` set — that column is
       the row's only resolution timestamp (the deciding actor lives in the
       audit row). The audit action this time is `help.request_resolved`.
       Negative: send a 501-character note first. Verify `400` (the note cap
       is 500).
- [ ] 10. Negative: repeat the exact status that already sits on a row (for
       example `RESOLVED` on request A). Verify `409 { success: false, message:
      "The request is already in this status, RESOLVED" }` — the status value
       is quoted verbatim in the message.
- [ ] 11. Role walls: as `staff@test.attendpro.com`, call
       `GET /api/hr/help-requests` and the PATCH. Verify both answer `403 with
       the message "Access Denied"` (route gate). As
       `hr@test.attendpro.com`, call `POST /api/staff/help-requests`. Verify
       `403` — filing is a STAFF self lane.

### Scenario X: Correction Decisions and the No-Self-Approval Matrix (HR / SUPERADMIN, M7)

Submission rules were covered in Scenario U — this scenario picks the
decision half up. `PATCH /api/hr/corrections/:id/decision` runs the whole
approver matrix in one transaction: the decision, the rewritten attendance
row, the append-only revision, and the audit rows commit together or not at
all. No self-approval is absolute: the requester never decides their own
correction, in any role, with no backstop escape.

> Setup: pair the kiosk and punch open sessions for Ama Mensah exactly as
> Scenarios Q and R walk them (her PIN setup note sits before Scenario P), and
> sign her in with the temporary password from Scenario I. The database edits
> below follow the owner-run pattern Scenario V uses.

- [ ] 1. Punch a fresh open session for Ama, then as Ama call
       `POST /api/attendance/corrections` with:

       ```json
       {
         "attendanceId": "<Ama's open row from today>",
         "reason": "The kiosk recorded 09:05 but I arrived at 08:40; the badge reader was slow.",
         "proposedClockIn": "2026-10-17T08:40:00.000Z"
       }
       ```

       Verify `201 { data: { id, status: "SUBMITTED", reviewTier: "SAME_DAY" }
       }` — the row's date is today. Copy the correction `id`.
- [ ] 2. No self-approval: sign back in as Ama and call
       `PATCH /api/hr/corrections/<correction id>/decision` with
       `{ "decision": "REJECTED" }`. Verify `403` with the message
       "Access Denied" — STAFF never reaches the decision handler. The fully
       worded refusal ("You cannot approve your own correction") exists for a
       requester who sits in an HR or SUPERADMIN seat (an officer who
       corrected their own row); with the standard fixtures nobody holds one,
       so skip it unless you stage that case.
- [ ] 3. HR approves the `SAME_DAY` correction: as
       `hr@test.attendpro.com`, call the decision endpoint with:

       ```json
       {
         "decision": "APPROVED",
         "note": "Kiosk reader fault confirmed at the front desk; the earlier arrival is accepted."
       }
       ```

       Verify `200 { success: true, message: "Correction approved",
       data: { correction, attendance, escalation: null } }`. The
       `attendance` object carries the proposed clock-in, a recomputed
       `status`, and fresh `hoursWorked`. In the database verify the
       `attendance_correction_revisions` row: `revisionNo` 1, action
       `APPLIED`, `values_before` holding what the row said at submission and
       `values_after` holding the applied values. The `audit_logs` table
       holds an action `correction.decided` row whose `reason` is a JSON
       string with the original, proposed, and approved values, the actor's
       role, and the attendance id.
- [ ] 4. Now to ESCALATED: punch a fresh open session for Ama, then move that
       row's `date` back two days (only `date` changes; the snapshots stay as
       punched):

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const user = await prisma.user.findUnique({
           where: { email: 'ama.mensah@test.attendpro.com' },
         });
         if (!user) throw new Error('Ama Mensah not found — run Scenario I first');
         const row = await prisma.attendance.findFirst({
           where: { userId: user.id, sessionStatus: 'OPEN' },
           orderBy: { clockIn: 'desc' },
         });
         if (!row) throw new Error('No open attendance row for Ama Mensah');
         const date = new Date(Date.now() - 2 * 86400000);
         await prisma.attendance.update({ where: { id: row.id }, data: { date } });
         console.log('Attendance ' + row.id + ' moved to ' + date.toISOString().slice(0, 10));
         await prisma.$disconnect();
       })();
       "
       ```

       As Ama, submit a correction on that row with a `proposedClockIn`.
       Verify `reviewTier` `ESCALATED` — the tier follows the record's date
       at submission, not your opinion of it.
- [ ] 5. Sole-HR refusal: as `hr@test.attendpro.com`, decide that correction
       (any decision). Verify `403 { success: false, message: "Escalated
       corrections need a second reviewer — a SUPERADMIN may act as
       backstop" }`. The standard fixtures carry only one active HR officer,
       so this is the refusal you should see; with a second active HR officer
       on the business the same call would decide instead, as the second
       reviewer.
- [ ] 6. SUPERADMIN in no named lane: as `superadmin@test.attendpro.com`,
       decide it with `{ "decision": "REJECTED" }` and no backstop fields.
       Verify `403` with the message "An escalated correction needs the
       SUPERADMIN backstop conditions, or a second HR reviewer".
- [ ] 7. Half-sent backstop: send
       `{ "decision": "REJECTED", "backstopCondition": "EXPLICIT_HANDOFF" }`
       with no reason. Verify `403` with the message "The backstop needs both
       a condition and a non-empty reason; without them a second HR reviewer
       decides instead".
- [ ] 8. HR cannot ride the backstop: as `hr@test.attendpro.com`, send both
       backstop fields with a reason. Verify `403` with the message
       "Only a SUPERADMIN may use the backstop conditions".
- [ ] 9. The backstop decides: as `superadmin@test.attendpro.com`, call the
       decision endpoint with:

       ```json
       {
         "decision": "APPROVED",
         "note": "Sole reviewer out since the morning; decided under the wait rule.",
         "backstopCondition": "UNCLAIMED_24H",
         "backstopReason": "The only HR officer has been away since the morning; the decision could not wait."
       }
       ```

       Verify `200` with `data.escalation` `{ type: "SUPERADMIN_BACKSTOP",
       condition: "UNCLAIMED_24H" }` and the correction object carrying
       `status` `APPROVED`, `decidedAt`, `decisionNote`, and `reviewedById`.
       The revision row's `reason` names the condition and its reason; the
       `audit_logs` action for this one is `correction.decided.backstop`.
       (A `CONFLICT_OF_INTEREST` or `EXPLICIT_HANDOFF` condition works the
       same way; `EXPLICIT_HANDOFF` also writes an extra
       `correction.escalated` audit row.)
- [ ] 10. Already decided: send step 9's body again. Verify `409 { success:
       false, message: "This correction has already been decided" }`. (A
       withdrawn correction answers the same `409` with the message "This
       correction was withdrawn by its requester".)
- [ ] 11. Drift test. Punch a fresh open session for Ama and submit a
       correction on it (same body shape as step 1). Then move that row's
       `date` back two days with step 4's snippet (a copy aimed at the newest
       open row), and close the whole overdue board from Scenario V: run
       `POST /api/jobs/auto-clock-out/run` with the job token. The sweep
       closes every overdue open row; verify `closed` counts at least your
       new row and the attendance row now reads `sessionStatus` `CLOSED`,
       `status` `AUTO_CLOSED`, with a written `clockOut`.
- [ ] 12. Approve into the drift: as `hr@test.attendpro.com`, call the
       decision endpoint on the drifted correction with
       `{ "decision": "APPROVED", "note": "Trying to approve after the job closed the row." }`.
       Verify `409 { success: false, message: "The record changed since this
       correction was raised" }` — an approval may only move a row forward
       from the values the correction was raised against. Confirm the
       correction stays `SUBMITTED` and the attendance row still carries the
       job's closure untouched.
- [ ] 13. Close it out: a rejection does not run the reality recheck, so send
       `{ "decision": "REJECTED", "note": "Row was closed by the job after the correction was filed." }`.
       Verify `200 { success: true, message: "Correction rejected" }` with
       `data` carrying the correction, attendance, and `escalation: null`.
       The revision row this time is action `DECIDED` with no
       `values_after`, because nothing was applied.

### Scenario Y: Reports, CSV Export and the Audit Trail (HR / SUPERADMIN, M7)

Four report reads answer to HR and SUPERADMIN; the CSV export is the one bulk
egress and earns an audit row, the rest change nothing and leave the trail
alone. The audit-trail read assembles one attendance row's whole correction
story in a single view.

- [ ] 1. Plant an exception. Two reliable ways: identify at the kiosk with
       coordinates well outside the paired site (Scenario Q step 2's body,
       but `latitude: 5.70, longitude: -0.45`), and verify `locationResult`
       `OUTSIDE` — outside the fence is flagged, never blocked; or reuse the
       `REQUIRES_REVIEW` row that Scenario V case (ii) left behind.
- [ ] 2. Register: as `hr@test.attendpro.com`, call
       `GET /api/reports/attendance-register?startDate=<start>&endDate=<end>&page=1&limit=10`
       (`YYYY-MM-DD` values, a span of up to 190 days). Verify the paginated
       rows, newest first by date then clock-in, each carrying `date`,
       `clockIn`, `clockOut`, `hoursWorked`, `status`, `sessionStatus`,
       `closureReason`, `requiresReviewReason`, an `employee` object with
       `employeeCode` and names, and `shiftName` taken from the row's
       historical snapshot. Re-call with `employeeId=<Ama's id>` and again
       with `shiftId` and verify both narrow the set and the
       `pagination.total` follows.
- [ ] 3. Negative: send a range of 191 days, and then `endDate` before
       `startDate`. Both return `400 "Invalid query parameters"` with the
       `errors` array pointing at `endDate`.
- [ ] 4. Punctuality summary: call
       `GET /api/reports/punctuality-summary?startDate=<start>&endDate=<end>&groupBy=employee`,
       and repeat with `groupBy=shift` and `groupBy=day`. Each row carries
       `group` plus the buckets `early`, `onTime`, `late`, `openSession`,
       `autoClosed`, `missing`, `absent`, `requiresReview`, and `total`. The
       `absent` column needs a careful eye, because it is computed:
       `employee` and `day` count calendar days in the range with no
       attendance row for the person (so Ama shows an absence for every day
       of the range she did not punch, active STAFF only); `shift` counts
       only stored absent rows, so it stays `0` today.
- [ ] 5. Exceptions: call `GET /api/reports/exceptions` for the same range.
       Verify one combined list where `kind` is `ATTENDANCE` (review-flagged
       rows, or an open session past its shift end) or `ATTEMPT` (punch
       attempts whose `locationResult` was `OUTSIDE` or `UNKNOWN`), every row
       with a plain `reason`. The OUTSIDE identify from step 1 must appear
       here.
- [ ] 6. CSV export: call the export the same way the JSON register is
       called, plus `format=csv`:

       ```bash
       curl -s -o register.csv \
         "http://localhost:8000/api/reports/attendance-register/export?startDate=<start>&endDate=<end>&format=csv" \
         -H "Authorization: Bearer $HR_TOKEN"
       ```

       Open `register.csv` as text and verify:
       - the header is exactly `staff id,name,date,shift,clock-in,clock-out,
         total hours,status,source,flags`;
       - rows print oldest first (a register reads chronologically — the
         opposite of the JSON register);
       - `clock-in` and `clock-out` read in the business timezone (check the
         `timezone` value on the settings read in step 11 and compare one
         row against the same instant in the JSON register's `clockIn`);
       - `status` carries the class the row graded; `source` reads `KIOSK`
         for a kiosk punch, `CORRECTION` for a row a correction closed,
         `AUTO_JOB` for an auto-closed one; `flags` repeats the review
         reason and is blank when there is none;
       - an empty clock-out prints an empty cell.
       In the database, the finished export wrote exactly one `report.exported`
       audit row whose `reason` names the range and the row count.
- [ ] 7. Negative: send `format=xlsx`. Verify `400` with the plain message
       "format must be csv" — the surface exports one format.
- [ ] 8. The apostrophe guard. The escape rule prefixes any cell beginning
       `=`, `+`, `-`, or `@` with an apostrophe, so a spreadsheet cannot
       execute it as a formula. Rename an existing staff member's first name
       to start with a hyphen (owner-run; run the snippet once to set it and
       once more after the export to restore):

       ```bash
       cd backend && node --env-file=.env -e "
       const { PrismaClient } = require('@prisma/client');
       const prisma = new PrismaClient();
       (async () => {
         const user = await prisma.user.findUnique({
           where: { email: 'staff@test.attendpro.com' },
           select: { id: true, firstName: true },
         });
         if (!user) throw new Error('Fixture account not found');
         const next = user.firstName.startsWith('-')
           ? user.firstName.slice(1)
           : '-' + user.firstName;
         await prisma.user.update({
           where: { id: user.id },
           data: { firstName: next },
         });
         console.log('firstName is now ' + next + ' (was ' + user.firstName + ')');
         await prisma.$disconnect();
       })();
       "
       ```

       Re-export the CSV and find that row's `name` cell. Verify it reads
       `'-Jordan Reed` (or wherever the hyphen sat) — the guard must arrive
       before the CSV escaping, so the apostrophe is the first character.
       Run the snippet again to restore the real name. The audit trail never
       records the rename.
- [ ] 9. Role wall: as `staff@test.attendpro.com`, call the register endpoint.
       Verify `403` with the message "Access Denied".
- [ ] 10. Audit trail: as `hr@test.attendpro.com`, call
       `GET /api/audit/corrections/<the attendance id Ama corrected in
       Scenario X>`. Verify `200 { data: [ corrections ] }`, corrections
       newest first, each holding the correction (with `originalValues`,
       `approvedValues`, `requestedBy`, `reviewedBy`, and the embedded
       `attendance` row), plus `attendanceCorrectionRevisions` in
       `revisionNo` order and `audits` oldest first — the decision rows
       `correction.decided` and `correction.decided.backstop` from Scenario X
       (and `correction.escalated`, when a handoff condition was used).
- [ ] 11. Trail refusals: send a non-UUID path value. Verify `400 "Invalid
       parameters"`. Send a well-formed UUID for an unknown (or
       cross-business) attendance row. Verify the same generic
       `404 { success: false, message: "Attendance record not found" }`.
- [ ] 12. Retention settings, read: as `superadmin@test.attendpro.com`, call
       `GET /api/business/settings`. Verify `data` with the branding group,
       `retentionYears` (default 7), `retentionEnabled: false` — deletion is
       stored-but-off everywhere in v1 — and both day windows
       (`attendanceRetentionDays`, `auditRetentionDays`) `null` until set.
       As `hr@test.attendpro.com`, the GET answers `403` (SUPERADMIN only).
- [ ] 13. Retention settings, the blocked flip: as SUPERADMIN, PATCH the
       settings with `{ "retentionEnabled": true }`. Verify `400 "Validation
       failed"` with the errors array naming `retentionEnabled` and the
       message "retentionEnabled must stay false — enabling deletion waits
       for the Ghana-specific legal advice O10 requires". No values move.
- [ ] 14. The other knobs update: PATCH with
       `{ "attendanceRetentionDays": 1095 }`. Verify
       `200 { success: true, message: "Business settings updated", data }`
       echoing the new value, and a `settings.updated` audit row whose
       `reason` JSON carries `fields`, `before`, and `after`. Then PATCH the
       exact same body again: verify `200` still, and the new audit row says
       in its reason that no effective change happened. Negative: misspell
       the key (`"retentionYear": 5`) — verify `400` with an
       unrecognized-key error (unknown keys are refused, never dropped), and
       send `"timezone": "Not/AZone"` — `400` naming the IANA check.

---

## 4. Known Limitations & Notes

- **Rate limiting:** failed logins are throttled per IP (10 attempts / 15
  minutes). Rapid wrong-password attempts will start returning 429. Wait out
  the window or restart the backend (the limiter is skipped under
  `NODE_ENV=test`). Filing help requests has its own cap: five submissions per
  account and IP address per 15 minutes (`POST /api/staff/help-requests`,
  Scenario W).
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