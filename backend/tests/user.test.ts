/**
 * Slice C — User management (SUPERADMIN / HR).
 *
 * Exercises the user endpoints against accounts provisioned by
 * tests/fixtures.ts, not against whatever the seed happened to leave behind.
 * Asserts the PRD contract: soft delete via isActive, tempPassword returned on
 * create, HR scoped to STAFF accounts, and the permission matrix that keeps a
 * STAFF token out of the directory.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../server.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

/**
 * Satisfies the D7 policy — ten characters, not on the blocklist — and differs
 * from every temporary credential, which are randomly generated per account.
 * Derived from the one canonical test credential rather than introduced as a
 * second literal: there is already exactly one test secret in this suite, and
 * a second would have to be justified on its own.
 */
const STRONG_NEW_PASSWORD = `${TEST_PASSWORD}-rotated`;

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(email: string): Promise<string> {
  const res = await signIn(email, TEST_PASSWORD);
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
  return res.body.token as string;
}

/**
 * Looks a user up by email so tests never hardcode an ID they cannot know.
 *
 * `GET /api/users` filters on a single boolean rather than treating an absent
 * filter as "all", so an account that has been deactivated is invisible to the
 * default query. Both views are tried, which is why the search runs twice.
 */
async function userIdByEmail(
  adminToken: string,
  email: string
): Promise<string> {
  const query = (isActive: "true" | "false") =>
    request(app)
      .get(
        `/api/users?search=${encodeURIComponent(email)}&limit=50&isActive=${isActive}`
      )
      .set("Authorization", `Bearer ${adminToken}`);

  for (const isActive of ["true", "false"] as const) {
    const res = await query(isActive);
    if (res.status !== 200) continue;
    const match = (res.body.data as Array<{ id: string; email: string }>).find(
      (u) => u.email === email
    );
    if (match) return match.id;
  }

  throw new Error(`No user found for ${email}`);
}

/** Creates a throwaway STAFF account and returns its id and temp credential. */
async function createDisposableStaff(
  adminToken: string,
  label: string
): Promise<{ id: string; tempPassword: string; email: string }> {
  const email = `${label}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;
  const res = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email,
      firstName: "Disposable",
      lastName: "Account",
      department: "Testing",
      jobTitle: "Temporary",
      role: "STAFF",
    });

  expect(res.status).toBe(201);
  return { id: res.body.data.id, tempPassword: res.body.tempPassword, email };
}

let superadminToken: string;
let hrToken: string;
let staffToken: string;
let createdUserId: string;

beforeAll(async () => {
  await ensureTestAccounts();
  superadminToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);
});

describe("GET /api/users (list)", () => {
  it("returns paginated list for SUPERADMIN", async () => {
    const res = await request(app)
      .get("/api/users?limit=5")
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    // Three provisioned test accounts at minimum. Deliberately not tied to the
    // seeded directory: this suite must not depend on rows it did not create.
    expect(res.body.pagination.totalUsers).toBeGreaterThanOrEqual(3);
  });

  it("returns paginated list for HR", async () => {
    const res = await request(app)
      .get("/api/users?limit=5")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("scopes HR to staff accounts only", async () => {
    const res = await request(app)
      .get("/api/users?limit=100")
      .set("Authorization", `Bearer ${hrToken}`);

    const roles = (res.body.data as Array<{ role: string }>).map((u) => u.role);
    expect(roles.length).toBeGreaterThan(0);
    expect(new Set(roles)).toEqual(new Set(["STAFF"]));
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated with 401", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/users (create)", () => {
  it("creates a user and returns tempPassword", async () => {
    const uniqueEmail = `test.user.${Date.now()}@test.attendpro.com`;
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        email: uniqueEmail,
        firstName: "Test",
        lastName: "User",
        department: "Engineering",
        jobTitle: "Developer",
        role: "STAFF",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.tempPassword).toBe("string");
    expect(res.body.tempPassword.length).toBeGreaterThan(0);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.role).toBe("STAFF");
    expect(res.body.data.employeeCode).toMatch(/^EMP-\d{4}$/);
    // The account must change the credential before it can use the app.
    expect(res.body.data.mustChangePassword).toBe(true);
    createdUserId = res.body.data.id;
  });

  it("issues a temporary password that satisfies the D7 policy", async () => {
    const { tempPassword } = await createDisposableStaff(
      superadminToken,
      "policy"
    );
    expect(tempPassword.length).toBeGreaterThanOrEqual(10);
  });

  it("allows HR to create a STAFF account", async () => {
    const uniqueEmail = `hr.created.${Date.now()}@test.attendpro.com`;
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        email: uniqueEmail,
        firstName: "HR",
        lastName: "Created",
        department: "Sales",
        role: "STAFF",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("STAFF");
  });

  it("refuses HR when it asks for an HR account", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        email: `hr.escalation.${Date.now()}@test.attendpro.com`,
        firstName: "Nope",
        lastName: "NotHr",
        department: "Human Resources",
        role: "HR",
      });

    expect(res.status).toBe(403);
  });

  it("refuses STAFF with 403", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        email: `staff.escalation.${Date.now()}@test.attendpro.com`,
        firstName: "X",
        lastName: "Y",
        department: "Testing",
        role: "STAFF",
      });

    expect(res.status).toBe(403);
  });

  it("rejects duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        email: SUPERADMIN_EMAIL,
        firstName: "Dup",
        lastName: "User",
        department: "Administration",
        role: "STAFF",
      });

    // P2002 on the unique email constraint. The route no longer answers 400
    // here: 400 means the request was malformed, and this one was well formed.
    expect(res.status).toBe(409);
  });

  it("rejects missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ firstName: "Only" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/:id — ownership", () => {
  it("allows STAFF to view their own record", async () => {
    const ownId = await userIdByEmail(superadminToken, STAFF_EMAIL);

    const res = await request(app)
      .get(`/api/users/${ownId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(STAFF_EMAIL);
  });

  it("refuses STAFF when it asks for someone else's record", async () => {
    const otherId = await userIdByEmail(superadminToken, HR_EMAIL);

    const res = await request(app)
      .get(`/api/users/${otherId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    // Any authenticated account could previously read any other account.
    expect(res.status).toBe(403);
  });

  it("refuses HR when it asks for another HR account", async () => {
    const otherId = await userIdByEmail(superadminToken, SUPERADMIN_EMAIL);

    const res = await request(app)
      .get(`/api/users/${otherId}`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(403);
  });

  it("allows SUPERADMIN to view any record", async () => {
    if (!createdUserId) {
      const { id } = await createDisposableStaff(superadminToken, "viewany");
      createdUserId = id;
    }

    const res = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects malformed UUID with 400", async () => {
    const res = await request(app)
      .get("/api/users/not-a-uuid")
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /api/users/:id — updates", () => {
  it("allows SUPERADMIN to update department", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ department: "Updated Dept" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.department).toBe("Updated Dept");
  });

  it("allows HR to update jobTitle on a staff account", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ jobTitle: "Senior Developer" });

    expect(res.status).toBe(200);
    expect(res.body.data.jobTitle).toBe("Senior Developer");
  });

  it("drops role and isActive when HR sends them", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ role: "SUPERADMIN", isActive: false, jobTitle: "Still Staff" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("STAFF");
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.jobTitle).toBe("Still Staff");
  });

  it("drops password and employeeCode when SUPERADMIN sends them", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ password: "not-even-a-hash", employeeCode: "EMP-9999" });

    expect(res.status).toBe(200);
    expect(res.body.data.employeeCode).not.toBe("EMP-9999");
  });

  it("refuses SUPERADMIN changing their own role", async () => {
    const selfId = await userIdByEmail(superadminToken, SUPERADMIN_EMAIL);

    const res = await request(app)
      .put(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ role: "STAFF" });

    expect(res.status).toBe(403);
  });

  it("refuses SUPERADMIN deactivating themselves", async () => {
    const selfId = await userIdByEmail(superadminToken, SUPERADMIN_EMAIL);

    const res = await request(app)
      .put(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it("refuses HR acting on an HR account", async () => {
    const hrId = await userIdByEmail(superadminToken, HR_EMAIL);

    const res = await request(app)
      .put(`/api/users/${hrId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ jobTitle: "Nope" });

    expect(res.status).toBe(403);
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ department: "Hack" });

    expect(res.status).toBe(403);
  });
});

describe("PUT /api/users/:id/reset-password", () => {
  it("lets SUPERADMIN reset a staff account and issues a new credential", async () => {
    const target = await createDisposableStaff(superadminToken, "reset.sa");

    const res = await request(app)
      .put(`/api/users/${target.id}/reset-password`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe("string");
    expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(10);

    // The account is put back into the forced-change state.
    const signInRes = await signIn(target.email, res.body.tempPassword);
    expect(signInRes.status).toBe(200);
    expect(signInRes.body.user.mustChangePassword).toBe(true);
  });

  it("lets HR reset a staff account", async () => {
    const target = await createDisposableStaff(superadminToken, "reset.hr");

    const res = await request(app)
      .put(`/api/users/${target.id}/reset-password`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe("string");
  });

  it("refuses HR resetting an HR account", async () => {
    const hrId = await userIdByEmail(superadminToken, HR_EMAIL);

    const res = await request(app)
      .put(`/api/users/${hrId}/reset-password`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(403);
  });

  it("refuses STAFF with 403", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}/reset-password`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/users/:id (deactivate)", () => {
  it("soft-deletes the user (isActive=false)", async () => {
    const { id } = await createDisposableStaff(superadminToken, "todelete");

    const delRes = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/users/${id}`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(getRes.body.data.isActive).toBe(false);
  });

  it("lets HR deactivate a staff account", async () => {
    const { id } = await createDisposableStaff(superadminToken, "hr.delete");

    const res = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
  });

  it("refuses HR deactivating an HR account", async () => {
    const hrId = await userIdByEmail(superadminToken, HR_EMAIL);

    const res = await request(app)
      .delete(`/api/users/${hrId}`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(403);
  });

  it("refuses STAFF with 403", async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it("refuses SUPERADMIN deactivating themselves", async () => {
    const selfId = await userIdByEmail(superadminToken, SUPERADMIN_EMAIL);

    const res = await request(app)
      .delete(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects a second deactivation with 400", async () => {
    const { id } = await createDisposableStaff(superadminToken, "twice");

    const first = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .delete(`/api/users/${id}`)
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(second.status).toBe(400);
  });
});

describe("deactivated accounts lose their session immediately", () => {
  it("rejects a still-valid token once the account is deactivated", async () => {
    const target = await createDisposableStaff(superadminToken, "revoked");

    const targetSignIn = await signIn(target.email, target.tempPassword);
    expect(targetSignIn.status).toBe(200);
    const targetToken = targetSignIn.body.token as string;

    // A freshly created account still holds its temporary credential, so the
    // forced-change gate would answer 403 here and the assertion below would be
    // comparing a blocked request against a rejected one. Clear the gate first,
    // so what follows is an ordinary account doing ordinary work.
    const change = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${targetToken}`)
      .send({
        currentPassword: target.tempPassword,
        newPassword: STRONG_NEW_PASSWORD,
      });
    expect(change.status).toBe(200);

    // Works while the account is active.
    const before = await request(app)
      .get("/api/attendance/my-attendance")
      .set("Authorization", `Bearer ${targetToken}`);
    expect(before.status).toBe(200);

    const deactivate = await request(app)
      .delete(`/api/users/${target.id}`)
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(deactivate.status).toBe(200);

    // Same token, same signature, still inside its lifetime.
    const after = await request(app)
      .get("/api/attendance/my-attendance")
      .set("Authorization", `Bearer ${targetToken}`);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("ACCOUNT_DEACTIVATED");
  });
});

describe("forced password change on first sign-in", () => {
  it("blocks the application until the temporary credential is replaced", async () => {
    const target = await createDisposableStaff(superadminToken, "mustchange");

    const signInRes = await signIn(target.email, target.tempPassword);
    expect(signInRes.status).toBe(200);
    const token = signInRes.body.token as string;
    expect(signInRes.body.user.mustChangePassword).toBe(true);

    // Everything except changing the password is refused.
    const blocked = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const blockedClock = await request(app)
      .post("/api/attendance/clock-in")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(blockedClock.status).toBe(403);

    // Changing it is allowed, and is the point.
    const change = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: target.tempPassword,
        newPassword: STRONG_NEW_PASSWORD,
      });
    expect(change.status).toBe(200);

    // The gate is down for the rest of the session.
    const after = await request(app)
      .get("/api/attendance/my-attendance")
      .set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(200);

    // And the old credential no longer works.
    const reuseOld = await signIn(target.email, target.tempPassword);
    expect(reuseOld.status).toBe(401);
  });

  it("rejects a new password that fails the D7 policy", async () => {
    const target = await createDisposableStaff(superadminToken, "weakpw");

    const signInRes = await signIn(target.email, target.tempPassword);
    const token = signInRes.body.token as string;

    const tooShort = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: target.tempPassword, newPassword: "short123" });
    expect(tooShort.status).toBe(400);

    const blocked = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: target.tempPassword,
        newPassword: "password123",
      });
    expect(blocked.status).toBe(400);

    const unchanged = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: target.tempPassword,
        newPassword: target.tempPassword,
      });
    expect(unchanged.status).toBe(400);
  });
});
