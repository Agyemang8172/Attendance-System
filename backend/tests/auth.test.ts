/**
 * Slice A — Authentication and role enforcement.
 *
 * Asserts the behaviour the PRD promises (docs/PROJECT_REQUIREMENTS.md), not
 * the behaviour the code happens to have.
 *
 * Read-only at the HTTP level: every test authenticates or reads. The one
 * write is `ensureTestAccounts` in `beforeAll`, which provisions the three
 * accounts this suite signs in as — see tests/fixtures.ts. No password is
 * written in this file.
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

/** A password that is not a real credential — deliberately wrong every time. */
const WRONG_PASSWORD = "definitely-not-the-password";
/** A domain that cannot exist in this database. */
const UNKNOWN_EMAIL = "nobody-here@example.invalid";

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(email: string): Promise<string> {
  const res = await signIn(email, TEST_PASSWORD);
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

beforeAll(async () => {
  await ensureTestAccounts();
});

describe("POST /api/auth/login — successful sign-in", () => {
  it("returns a token and the caller's role for the superadmin", async () => {
    const res = await signIn(SUPERADMIN_EMAIL, TEST_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe(SUPERADMIN_EMAIL);
    expect(res.body.user.role).toBe("SUPERADMIN");
    expect(typeof res.body.user.mustChangePassword).toBe("boolean");
  });

  it("does not return the password hash in the response", async () => {
    const res = await signIn(HR_EMAIL, TEST_PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toContain("$2b$");
  });
});

describe("POST /api/auth/login — failed sign-in", () => {
  // PRD section 7: "Wrong password at sign-in — 401; the response does not
  // reveal whether the account exists."
  it("returns 400 when a required field is missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SUPERADMIN_EMAIL });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
  });

  it("returns 401 for a wrong password", async () => {
    const res = await signIn(SUPERADMIN_EMAIL, WRONG_PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("does not reveal whether an account exists", async () => {
    const wrongPassword = await signIn(SUPERADMIN_EMAIL, WRONG_PASSWORD);
    const unknownAccount = await signIn(UNKNOWN_EMAIL, WRONG_PASSWORD);

    // Statuses must match, otherwise 401 vs 404 enumerates valid emails.
    expect(unknownAccount.status).toBe(wrongPassword.status);
    // Messages must match, otherwise the wording enumerates valid emails.
    expect(unknownAccount.body.message).toBe(wrongPassword.body.message);
    expect(unknownAccount.body.token).toBeUndefined();
    expect(wrongPassword.body.token).toBeUndefined();
  });
});

describe("auth middleware — missing or malformed credentials", () => {
  it("returns 401 with no token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a token that is not a JWT", async () => {
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
    expect(res.body.user).toBeUndefined();
  });

  it("returns 401 with a token signed by the wrong secret", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign(
      { userId: "00000000-0000-0000-0000-000000000000", role: "SUPERADMIN" },
      "not-the-server-secret",
      { expiresIn: "24h" }
    );

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it("returns 401 for a well-signed token naming an account that does not exist", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign(
      { userId: "00000000-0000-0000-0000-000000000000", role: "SUPERADMIN" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });
});

describe("role enforcement", () => {
  it("grants HR access to GET /api/users", async () => {
    const token = await tokenFor(HR_EMAIL);
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  // PRD section 7: "Staff member calls an admin route — 403."
  it("refuses STAFF with 403 on GET /api/users", async () => {
    const token = await tokenFor(STAFF_EMAIL);
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Access Denied");
  });

  // HR creates staff accounts now, so reaching the route is no longer the
  // thing being tested — the payload still has to be valid.
  it("returns 400 rather than 403 when HR sends an empty create payload", async () => {
    const token = await tokenFor(HR_EMAIL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("refuses HR with 403 when it tries to create a non-STAFF account", async () => {
    const token = await tokenFor(HR_EMAIL);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: `escalation.${Date.now()}@test.attendpro.com`,
        firstName: "Attempted",
        lastName: "Escalation",
        department: "Testing",
        role: "SUPERADMIN",
      });

    expect(res.status).toBe(403);
  });

  it("allows SUPERADMIN to reach the user list", async () => {
    const token = await tokenFor(SUPERADMIN_EMAIL);
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe("health check", () => {
  it("reports a connected database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.database).toBe("connected");
  });
});
