/**
 * Slice C — User management (SUPERADMIN / HR).
 *
 * Exercises the five user endpoints against the seeded database.
 * Asserts PRD contract: soft delete via isActive, tempPassword returned on create,
 * role guards (SUPERADMIN only for create/delete, HR+SUPERADMIN for list/update).
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../server.js";
import prisma from "../config/prismaClient.js";

const SUPERADMIN_EMAIL = "superadmin@attendpro.com";
const HR_EMAIL = "hr@attendpro.com";
const STAFF_EMAIL = "john.doe@company.com";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(envVar: string, email: string): Promise<string> {
  const res = await signIn(email, requireEnv(envVar));
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
  return res.body.token as string;
}

let superadminToken: string;
let hrToken: string;
let staffToken: string;
let createdUserId: string;

beforeAll(async () => {
  superadminToken = await tokenFor("SUPERADMIN_PASSWORD", SUPERADMIN_EMAIL);
  hrToken = await tokenFor("HR_PASSWORD", HR_EMAIL);
  staffToken = await tokenFor("STAFF_PASSWORD", STAFF_EMAIL);
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
    expect(res.body.pagination.totalUsers).toBeGreaterThanOrEqual(7);
  });

  it("returns paginated list for HR", async () => {
    const res = await request(app)
      .get("/api/users?limit=5")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
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

describe("POST /api/users (create — SUPERADMIN only)", () => {
  it("creates a user and returns tempPassword", async () => {
    const uniqueEmail = `test.user.${Date.now()}@company.com`;
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
    expect(res.body).toHaveProperty("tempPassword");
    expect(typeof res.body.tempPassword).toBe("string");
    expect(res.body.tempPassword.length).toBeGreaterThan(0);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.role).toBe("STAFF");
    expect(res.body.data.employeeCode).toMatch(/^EMP-\d{4}$/);
    createdUserId = res.body.data.id;
  });

  it("rejects HR with 403", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ email: "should-fail@company.com", firstName: "X", lastName: "Y", role: "STAFF" });

    expect(res.status).toBe(403);
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ email: "should-fail@company.com", firstName: "X", lastName: "Y", role: "STAFF" });

    expect(res.status).toBe(403);
  });

  it("rejects duplicate email with 400", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        email: SUPERADMIN_EMAIL,
        firstName: "Dup",
        lastName: "User",
        role: "STAFF",
      });

    expect(res.status).toBe(400);
  });

  it("rejects missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ firstName: "Only" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/users/:id (any authenticated)", () => {
  it("allows STAFF to view their own record", async () => {
    // Search for the staff user by email
    const listRes = await request(app)
      .get(`/api/users?search=${STAFF_EMAIL}`)
      .set("Authorization", `Bearer ${superadminToken}`);
    const staffUser = listRes.body.data[0];

    const res = await request(app)
      .get(`/api/users/${staffUser.id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(STAFF_EMAIL);
  });

  it("allows SUPERADMIN to view any record", async () => {
    // Ensure we have a created user ID
    if (!createdUserId) {
      // Create one if needed
      const createRes = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${superadminToken}`)
        .send({
          email: `test.view.${Date.now()}@company.com`,
          firstName: "View",
          lastName: "Test",
          role: "STAFF",
        });
      createdUserId = createRes.body.data.id;
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

describe("PUT /api/users/:id (SUPERADMIN, HR)", () => {
  it("allows SUPERADMIN to update department", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ department: "Updated Dept" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.department).toBe("Updated Dept");
  });

  it("allows HR to update jobTitle", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ jobTitle: "Senior Developer" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobTitle).toBe("Senior Developer");
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .put(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ department: "Hack" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/users/:id (SUPERADMIN only — soft delete)", () => {
  it("soft-deletes the user (isActive=false)", async () => {
    const createRes = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        email: `todelete.${Date.now()}@company.com`,
        firstName: "Delete",
        lastName: "Me",
        department: "Engineering",
        role: "STAFF",
      });
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;

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

  it("rejects HR with 403", async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(403);
  });

  it("rejects STAFF with 403", async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});