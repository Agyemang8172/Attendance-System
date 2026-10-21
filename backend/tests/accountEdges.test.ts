/**
 * M9 Phase 1 — account security and directory edges.
 *
 * The main user suite covers the account CRUD happy paths. This file covers the
 * code those paths never reach:
 *   PUT /api/users/change-password       own password, wrong/current checks
 *   PUT /api/users/:id/reset-password    self-reset refusal
 *   POST /api/users/:id/reset-pin        staff-only PIN reset, key fail-closed
 *   GET /api/users                       search/department/role/paging filters
 *   GET/PUT/DELETE /api/users/:id        404s for unknown ids
 *
 * The fixture STAFF password and PIN columns are snapshotted and restored in
 * `afterAll`; the tests must not leave the shared account with a credential the
 * next suite cannot use.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

async function tokenFor(email: string, password = TEST_PASSWORD): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const NEW_PASSWORD = "NewDevos123!";

let saToken: string;
let hrToken: string;
let staffToken: string;
let saUserId: string;
let hrUserId: string;
let staffUserId: string;
let originalStaff: {
  password: string;
  mustChangePassword: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  pinUpdatedAt: Date | null;
  pinFailedCount: number;
  pinLockedUntil: Date | null;
  pinLastFailedAt: Date | null;
  mustChangePin: boolean;
};

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const [sa, hr, staff] = await Promise.all([
    prisma.user.findUnique({ where: { email: SUPERADMIN_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: HR_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({
      where: { email: STAFF_EMAIL },
      select: {
        id: true,
        password: true,
        mustChangePassword: true,
        pinHash: true,
        pinSalt: true,
        pinUpdatedAt: true,
        pinFailedCount: true,
        pinLockedUntil: true,
        pinLastFailedAt: true,
        mustChangePin: true,
      },
    }),
  ]);
  if (!sa || !hr || !staff) throw new Error("Fixture accounts missing");
  saUserId = sa.id;
  hrUserId = hr.id;
  staffUserId = staff.id;
  originalStaff = {
    password: staff.password,
    mustChangePassword: staff.mustChangePassword,
    pinHash: staff.pinHash,
    pinSalt: staff.pinSalt,
    pinUpdatedAt: staff.pinUpdatedAt,
    pinFailedCount: staff.pinFailedCount,
    pinLockedUntil: staff.pinLockedUntil,
    pinLastFailedAt: staff.pinLastFailedAt,
    mustChangePin: staff.mustChangePin,
  };
});

afterAll(async () => {
  await prisma.user
    .update({ where: { id: staffUserId }, data: originalStaff })
    .catch(() => undefined);
});

describe("PUT /api/users/change-password", () => {
  it("changes the caller's password and clears the forced-change flag", async () => {
    const res = await request(app)
      .put("/api/users/change-password")
      .set(auth(staffToken))
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stored = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { mustChangePassword: true },
    });
    expect(stored?.mustChangePassword).toBe(false);

    // The new credential works; the old one no longer does.
    await expect(tokenFor(STAFF_EMAIL, NEW_PASSWORD)).resolves.toBeTruthy();
    const old = await request(app)
      .post("/api/auth/login")
      .send({ email: STAFF_EMAIL, password: TEST_PASSWORD });
    expect(old.status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const res = await request(app)
      .put("/api/users/change-password")
      .set(auth(staffToken))
      .send({ currentPassword: "DefinitelyWrong123!", newPassword: "AnotherPass123!" });
    expect(res.status).toBe(401);
  });

  it("rejects a new password equal to the current one", async () => {
    const res = await request(app)
      .put("/api/users/change-password")
      .set(auth(staffToken))
      .send({ currentPassword: NEW_PASSWORD, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("rejects a new password that fails the policy", async () => {
    const res = await request(app)
      .put("/api/users/change-password")
      .set(auth(staffToken))
      .send({ currentPassword: NEW_PASSWORD, newPassword: "short" });
    expect(res.status).toBe(400);
  });
});

describe("Administrative password and PIN resets", () => {
  it("refuses a SUPERADMIN resetting their own password through the admin route", async () => {
    const res = await request(app)
      .put(`/api/users/${saUserId}/reset-password`)
      .set(auth(saToken))
      .send({});
    expect(res.status).toBe(403);
  });

  it("resets a staff password for SUPERADMIN and forces a change", async () => {
    const res = await request(app)
      .put(`/api/users/${staffUserId}/reset-password`)
      .set(auth(saToken))
      .send({});

    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe("string");
    const stored = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { mustChangePassword: true },
    });
    expect(stored?.mustChangePassword).toBe(true);
  });

  it("resets a staff PIN and never returns the PIN in the response", async () => {
    const res = await request(app)
      .post(`/api/hr/users/${staffUserId}/reset-pin`)
      .set(auth(saToken))
      .send({ reason: "M9 coverage: staff forgot the kiosk PIN" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(staffUserId);
    expect(res.body.data.pin).toBeUndefined();
    expect(res.body.pin).toBeUndefined();

    const stored = await prisma.user.findUnique({
      where: { id: staffUserId },
      select: { pinHash: true, pinSalt: true, mustChangePin: true, pinFailedCount: true },
    });
    expect(stored?.pinHash).toBeTruthy();
    expect(stored?.pinSalt).toBeTruthy();
    expect(stored?.mustChangePin).toBe(true);
    expect(stored?.pinFailedCount).toBe(0);
  });

  it("lets HR reset a staff PIN", async () => {
    const res = await request(app)
      .post(`/api/hr/users/${staffUserId}/reset-pin`)
      .set(auth(hrToken))
      .send({ reason: "M9 coverage: HR reset" });
    expect(res.status).toBe(201);
  });

  it("refuses a PIN reset on an HR or SUPERADMIN account", async () => {
    const hr = await request(app)
      .post(`/api/hr/users/${hrUserId}/reset-pin`)
      .set(auth(saToken))
      .send({ reason: "M9 coverage: wrong target" });
    expect(hr.status).toBe(403);

    const sa = await request(app)
      .post(`/api/hr/users/${saUserId}/reset-pin`)
      .set(auth(saToken))
      .send({ reason: "M9 coverage: wrong target" });
    expect(sa.status).toBe(403);
  });

  it("returns 404 for an unknown PIN target and 400 for a missing reason", async () => {
    const missing = await request(app)
      .post("/api/hr/users/00000000-0000-4000-8000-000000000095/reset-pin")
      .set(auth(saToken))
      .send({ reason: "M9 coverage: missing target" });
    expect(missing.status).toBe(404);

    const noReason = await request(app)
      .post(`/api/hr/users/${staffUserId}/reset-pin`)
      .set(auth(saToken))
      .send({});
    expect(noReason.status).toBe(400);
  });

  it("fails closed when PIN_HMAC_KEY is unset", async () => {
    const key = process.env.PIN_HMAC_KEY;
    delete process.env.PIN_HMAC_KEY;
    try {
      const res = await request(app)
        .post(`/api/hr/users/${staffUserId}/reset-pin`)
        .set(auth(saToken))
        .send({ reason: "M9 coverage: missing key" });
      expect(res.status).toBe(500);
    } finally {
      if (key) process.env.PIN_HMAC_KEY = key;
    }
  });
});

describe("User directory filters and unknown ids", () => {
  it("filters by search, department, role and active state", async () => {
    // Search by the fixture employee code, not by a display name: a later
    // suite may edit a name, but EMP-9003 is the stable staff handle.
    const search = await request(app).get("/api/users?search=EMP-9003").set(auth(saToken));
    expect(search.status).toBe(200);
    expect(search.body.data.some((user: { email: string }) => user.email === STAFF_EMAIL)).toBe(true);

    const department = await request(app).get("/api/users?department=Testing").set(auth(saToken));
    expect(department.status).toBe(200);
    expect(department.body.data.length).toBeGreaterThan(0);

    const role = await request(app).get("/api/users?role=STAFF&limit=100").set(auth(saToken));
    expect(role.status).toBe(200);
    expect(role.body.data.every((user: { role: string }) => user.role === "STAFF")).toBe(true);

    const inactive = await request(app).get("/api/users?isActive=false&limit=100").set(auth(saToken));
    expect(inactive.status).toBe(200);
    expect(inactive.body.data.every((user: { isActive: boolean }) => user.isActive === false)).toBe(true);

    const paged = await request(app).get("/api/users?page=1&limit=1").set(auth(saToken));
    expect(paged.status).toBe(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pagination.currentPage).toBe(1);
  });

  it("keeps HR scoped to staff even when the query asks for another role", async () => {
    const res = await request(app).get("/api/users?role=SUPERADMIN&limit=100").set(auth(hrToken));
    expect(res.status).toBe(200);
    expect(res.body.data.every((user: { role: string }) => user.role === "STAFF")).toBe(true);
  });

  it("returns 404 for an unknown account on read, update and deactivate", async () => {
    const id = "00000000-0000-4000-8000-000000000094";
    expect((await request(app).get(`/api/users/${id}`).set(auth(saToken))).status).toBe(404);
    expect(
      (
        await request(app)
          .put(`/api/users/${id}`)
          .set(auth(saToken))
          .send({ department: "Nobody" })
      ).status
    ).toBe(404);
    expect((await request(app).delete(`/api/users/${id}`).set(auth(saToken))).status).toBe(404);
  });
});
