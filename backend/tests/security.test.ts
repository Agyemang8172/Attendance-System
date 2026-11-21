/**
 * Slice D — Security hardening (M9).
 *
 * Asserts the security cases from `AUTH_DESIGN_PROPOSAL.md` §6 that the other
 * slices could not reach: the 72-character password ceiling (case 15), the
 * last-SUPERADMIN invariant (case 11), sign-out inside the forced-change gate
 * (case 2), the response headers (S9), and the shape of the generated
 * temporary credential (S11).
 *
 * Case 11 deserves a note. `userController.ts` carries a 409 guard for the
 * last active SUPERADMIN, but the composed routes cannot produce that state:
 * the only caller who may alter a SUPERADMIN is an active SUPERADMIN, so
 * `countActiveSuperadmins(target.id)` always counts the caller and stays at
 * one. The guard is belt-and-braces against a future route that lets someone
 * else write those fields. What the API actually guarantees — and what this
 * suite asserts — is the invariant: no sequence of permitted calls can ever
 * leave the directory with zero active SUPERADMINs.
 */
import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import app, {
  accountAuthKey,
  accountAuthLimiter,
  allowedOriginsFor,
  swaggerEnabled,
} from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
} from "./fixtures.js";
import { generateTempPassword } from "../utils/credentials.js";

const syntheticCredential0 = String.fromCharCode(65, 97, 49, 33) + randomBytes(16).toString('hex');
const syntheticCredential1 = String.fromCharCode(65, 97, 49, 33) + randomBytes(16).toString('hex');
const syntheticCredential2 = String.fromCharCode(65, 97, 49, 33) + randomBytes(16).toString('hex');

async function signIn(email: string, password: string) {
  return request(app).post("/api/auth/login").send({ email, password });
}

async function tokenFor(email: string): Promise<string> {
  const res = await signIn(email, TEST_PASSWORD);
  if (res.status !== 200) throw new Error(`Sign-in failed: ${res.status}`);
  return res.body.token as string;
}

/** Looks a user up by email so tests never hardcode an ID they cannot know. */
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

/** Creates a throwaway SUPERADMIN account — a colleague to remove. */
async function createDisposableSuperadmin(
  adminToken: string,
  label: string
): Promise<{ id: string; email: string }> {
  const email = `${label}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;
  const res = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email,
      firstName: "Disposable",
      lastName: "Superadmin",
      department: "Testing",
      jobTitle: "Temporary",
      role: "SUPERADMIN",
    });

  expect(res.status).toBe(201);
  return { id: res.body.data.id, email };
}

let superadminToken: string;
let hrToken: string;

beforeAll(async () => {
  await ensureTestAccounts();
  superadminToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
});

describe("account login limiter key (SEC-14)", () => {
  const keyFor = (email: string, ip: string): string =>
    accountAuthKey({
      body: { email },
      ip,
    } as unknown as Parameters<typeof accountAuthKey>[0]);

  it("keys one account on its network, not on the exact address", () => {
    expect(keyFor("staff@test.attendpro.com", "203.0.113.10")).toBe(
      keyFor("STAFF@test.attendpro.com", "203.0.113.200")
    );
    expect(keyFor("staff@test.attendpro.com", "203.0.113.10")).not.toBe(
      keyFor("staff@test.attendpro.com", "203.0.114.10")
    );
  });

  it("still separates different accounts on the same network", () => {
    expect(keyFor("alice@test.attendpro.com", "203.0.113.10")).not.toBe(
      keyFor("bob@test.attendpro.com", "203.0.113.10")
    );
  });

  it("masks IPv6 to /64, including IPv4-mapped addresses", () => {
    expect(keyFor("staff@test.attendpro.com", "2001:db8:abcd:1234::1")).toBe(
      keyFor("staff@test.attendpro.com", "2001:db8:abcd:1234:ffff:ffff:ffff:ffff")
    );
    expect(keyFor("staff@test.attendpro.com", "2001:db8:abcd:1234::1")).not.toBe(
      keyFor("staff@test.attendpro.com", "2001:db8:abcd:1235::1")
    );
    // A dual-stack server reports IPv4 clients as `::ffff:a.b.c.d`; that must
    // land in the same /24 bucket as the plain IPv4 form.
    expect(keyFor("staff@test.attendpro.com", "::ffff:192.0.2.10")).toBe(
      keyFor("staff@test.attendpro.com", "192.0.2.99")
    );
  });

  it("lets rotating addresses inside one subnet hit the limit", async () => {
    const limiterApp = express();
    limiterApp.set("trust proxy", 1);
    limiterApp.use(express.json());
    limiterApp.post("/login", accountAuthLimiter, (_req, res) => {
      res.status(200).json({ success: true });
    });

    const email = `rotator.${Date.now()}@test.attendpro.com`;
    const attempt = (ip: string) =>
      request(limiterApp)
        .post("/login")
        .set("X-Forwarded-For", ip)
        .send({ email, password: "wrong" });

    // Eight guesses pass; the ninth address in the same /24 is refused even
    // though the exact address has never been seen.
    for (let i = 1; i <= 8; i += 1) {
      expect((await attempt(`198.51.100.${i}`)).status).toBe(200);
    }
    const blocked = await attempt("198.51.100.90");
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(
      "Too many sign-in attempts for this account, please try again later."
    );

    // A different account on the same subnet keeps its own budget.
    const neighbour = await request(limiterApp)
      .post("/login")
      .set("X-Forwarded-For", "198.51.100.91")
      .send({ email: `neighbour.${Date.now()}@test.attendpro.com`, password: "wrong" });
    expect(neighbour.status).toBe(200);

    // The same account from another /24 is a separate key: the limiter's
    // coarseness is the trade-off that lets office NAT users through while
    // still making per-subnet rotation costly.
    const elsewhere = await request(limiterApp)
      .post("/login")
      .set("X-Forwarded-For", "203.0.113.50")
      .send({ email, password: "wrong" });
    expect(elsewhere.status).toBe(200);
  });
});

describe("response headers (S9)", () => {
  it("sends every hardening header, including on a rejected request", async () => {
    // No token, so this is a 401 — the case that most needs the headers,
    // because a rejected response is the one most likely to be reflected.
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
  });

  it("keeps HSTS off outside production so localhost is never pinned", async () => {
    const res = await request(app).get("/api/users");
    // `securityHeaders.ts` sets this only when NODE_ENV === "production": a
    // browser that sees HSTS from http://localhost would pin the dev origin.
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });
});

describe("temporary credential entropy (S11)", () => {
  it("issues credentials in the documented word-word-####-#### shape", () => {
    const shape = /^[a-z]+-[a-z]+-\d{4}-\d{4}$/;
    for (let i = 0; i < 32; i += 1) {
      expect(generateTempPassword()).toMatch(shape);
    }
  });

  it("does not repeat itself across a batch", () => {
    // The space is 30 × 30 × 10^4 × 10^4 ≈ 36 bits; a 128-draw batch over
    // that space does not collide. A constant seed or a shrinking source
    // would fail this immediately.
    const batch = Array.from({ length: 128 }, () => generateTempPassword());
    expect(new Set(batch).size).toBe(128);
  });
});

describe("password ceiling (case 15)", () => {
  it("rejects a replacement password longer than 72 characters", async () => {
    const { email, tempPassword } = await createDisposableStaff(
      superadminToken,
      "over72"
    );

    const signInRes = await signIn(email, tempPassword);
    expect(signInRes.status).toBe(200);
    const token = signInRes.body.token as string;

    // bcrypt reads at most 72 bytes; the validator rejects rather than
    // silently truncate a password that only "looks" longer.
    const res = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: tempPassword, newPassword: "A".repeat(73) });
    expect(res.status).toBe(400);
  });
});

describe("sign-out stays open under the forced-change gate (case 2)", () => {
  it("lets an account still holding its temporary credential sign out", async () => {
    const { email, tempPassword } = await createDisposableStaff(
      superadminToken,
      "walksout"
    );

    const signInRes = await signIn(email, tempPassword);
    expect(signInRes.status).toBe(200);
    expect(signInRes.body.user.mustChangePassword).toBe(true);
    const token = signInRes.body.token as string;

    // Logout is deliberately the second thing a locked-in account may do —
    // the only way out of the password screen must not require the password.
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("last SUPERADMIN cannot be removed (case 11)", () => {
  it("leaves at least one active SUPERADMIN after every permitted call", async () => {
    // Stage a directory with two active SUPERADMINs: the fixture account and
    // one disposable colleague. SUPERADMIN may remove the *other* — one,
    // namely the caller, then remains.
    const colleague = await createDisposableSuperadmin(
      superadminToken,
      "locksmith"
    );

    const demoteColleague = await request(app)
      .put(`/api/users/${colleague.id}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ role: "HR" });
    expect(demoteColleague.status).toBe(200);

    // With the caller now the only active SUPERADMIN, every removal path is
    // refused: self-deactivation, self-demotion, HR reaching for the role,
    // and the delete route.
    const selfId = await userIdByEmail(superadminToken, SUPERADMIN_EMAIL);

    const selfDeactivate = await request(app)
      .put(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ isActive: false });
    expect(selfDeactivate.status).toBe(403);

    const selfDemote = await request(app)
      .put(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({ role: "STAFF" });
    expect(selfDemote.status).toBe(403);

    const hrDemote = await request(app)
      .put(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ role: "STAFF" });
    expect(hrDemote.status).toBe(403);

    const selfDelete = await request(app)
      .delete(`/api/users/${selfId}`)
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(selfDelete.status).toBe(403);

    // The caller still works as SUPERADMIN, so the invariant held throughout.
    const list = await request(app)
      .get("/api/users?limit=5")
      .set("Authorization", `Bearer ${superadminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
  });
});

describe("SEC-10 and SEC-11 — production surface", () => {
  it("mounts the API documentation outside production only", () => {
    expect(swaggerEnabled("production")).toBe(false);
    expect(swaggerEnabled("development")).toBe(true);
    expect(swaggerEnabled("test")).toBe(true);
  });

  it("keeps the local development origins out of production", () => {
    const production = allowedOriginsFor("production");
    expect(production).not.toContain("http://localhost:5173");
    expect(production).not.toContain("http://localhost:5174");
    expect(production).not.toContain("http://localhost:3000");

    const development = allowedOriginsFor("development");
    expect(development).toContain("http://localhost:5173");
    expect(development).toContain("http://localhost:5174");
    expect(development).toContain("http://localhost:3000");
  });
});

describe("SEC-12 — the forced-change gate covers configuration routes", () => {
  it("blocks a temporary-credential HR account on every protected family", async () => {
    const email = `pwgate.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;
    const created = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${superadminToken}`)
      .send({
        email,
        firstName: "Gate",
        lastName: "Tester",
        department: "Testing",
        jobTitle: "Temporary",
        role: "HR",
      });
    expect(created.status).toBe(201);

    const signInRes = await signIn(email, created.body.tempPassword as string);
    expect(signInRes.status).toBe(200);
    const token = signInRes.body.token as string;

    const blocked: Array<[string, string]> = [
      ["get", "/api/business/shifts"],
      ["get", "/api/business/assignments"],
      ["get", "/api/business/policies"],
      ["get", "/api/business/calendars"],
      ["get", "/api/sites"],
      ["get", "/api/kiosk/devices"],
      ["post", "/api/business/qr-credentials/00000000-0000-4000-8000-000000000001/revoke"],
    ];

    for (const [method, path] of blocked) {
      const res = await (request(app) as any)
        [method](path)
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "gate check" });
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
      expect(res.body.code, `${method.toUpperCase()} ${path}`).toBe(
        "PASSWORD_CHANGE_REQUIRED"
      );
    }

    // After the forced change, the same account reaches the HR-readable list.
    const change = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({
        currentPassword: created.body.tempPassword as string,
        newPassword: syntheticCredential0,
      });
    expect(change.status).toBe(200);

    const allowed = await request(app)
      .get("/api/business/assignments")
      .set("Authorization", `Bearer ${change.body.token as string}`);
    expect(allowed.status).toBe(200);

    // Lifting the password gate does not lift the role gate: HR may read
    // assignments but still cannot create them.
    const roleDenied = await request(app)
      .post("/api/business/shifts/00000000-0000-4000-8000-000000000001/assignments")
      .set("Authorization", `Bearer ${change.body.token as string}`)
      .send({
        employeeId: "00000000-0000-4000-8000-000000000002",
        effectiveFrom: "2099-01-01",
        reason: "role gate check",
      });
    expect(roleDenied.status).toBe(403);
    expect(roleDenied.body.message).toBe("Access Denied");
  });

  it("blocks every assignment mutation before any assignment, pointer, or audit write", async () => {
    const tag = randomUUID();
    const initialPassword = syntheticCredential1;
    const replacementPassword = syntheticCredential2;
    const business = await prisma.business.create({
      data: { slug: `sec12-${tag}`, name: `SEC-12 ${tag}`, timezone: "UTC" },
    });
    const admin = await prisma.user.create({
      data: {
        businessId: business.id,
        employeeCode: `S12A-${tag.slice(0, 10)}`,
        firstName: "Temporary",
        lastName: "Administrator",
        email: `sec12-admin-${tag}@test.attendpro.local`,
        password: await bcrypt.hash(initialPassword, 4),
        role: "SUPERADMIN",
        mustChangePassword: true,
      },
    });
    const employee = await prisma.user.create({
      data: {
        businessId: business.id,
        employeeCode: `S12E-${tag.slice(0, 10)}`,
        firstName: "Assignment",
        lastName: "Target",
        email: `sec12-staff-${tag}@test.attendpro.local`,
        password: await bcrypt.hash(TEST_PASSWORD, 4),
        role: "STAFF",
        mustChangePassword: false,
      },
    });
    const firstShift = await prisma.shift.create({
      data: {
        businessId: business.id,
        name: `SEC-12 first ${tag}`,
        startMinute: 480,
        endMinute: 1020,
        startTime: "08:00",
        endTime: "17:00",
      },
    });
    const secondShift = await prisma.shift.create({
      data: {
        businessId: business.id,
        name: `SEC-12 second ${tag}`,
        startMinute: 540,
        endMinute: 1080,
        startTime: "09:00",
        endTime: "18:00",
      },
    });
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const assignment = await prisma.shiftAssignment.create({
      data: {
        businessId: business.id,
        userId: employee.id,
        shiftId: firstShift.id,
        assignedByUserId: admin.id,
        effectiveFrom: new Date(`${today}T00:00:00.000Z`),
      },
    });
    await prisma.user.update({ where: { id: employee.id }, data: { shiftId: firstShift.id } });

    const login = await signIn(admin.email, initialPassword);
    expect(login.status).toBe(200);
    const temporaryToken = login.body.token as string;
    const assignmentsBefore = await prisma.shiftAssignment.findMany({
      where: { businessId: business.id },
      orderBy: { id: "asc" },
    });
    const pointerBefore = await prisma.user.findUniqueOrThrow({
      where: { id: employee.id },
      select: { shiftId: true },
    });
    const auditsBefore = await prisma.auditLog.findMany({
      where: { businessId: business.id },
      orderBy: { id: "asc" },
    });

    const rejected = [
      request(app)
        .post(`/api/business/shifts/${secondShift.id}/assignments`)
        .set("Authorization", `Bearer ${temporaryToken}`)
        .send({ employeeId: employee.id, effectiveFrom: future, reason: "blocked create" }),
      request(app)
        .patch(`/api/business/assignments/${assignment.id}`)
        .set("Authorization", `Bearer ${temporaryToken}`)
        .send({ shiftId: secondShift.id, reason: "blocked reschedule" }),
      request(app)
        .delete(`/api/business/assignments/${assignment.id}`)
        .set("Authorization", `Bearer ${temporaryToken}`)
        .send({ reason: "blocked cancellation" }),
    ];

    for (const responsePromise of rejected) {
      const response = await responsePromise;
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "You must change your password before continuing",
      });
    }

    expect(await prisma.shiftAssignment.findMany({
      where: { businessId: business.id }, orderBy: { id: "asc" },
    })).toEqual(assignmentsBefore);
    expect(await prisma.user.findUniqueOrThrow({
      where: { id: employee.id }, select: { shiftId: true },
    })).toEqual(pointerBefore);
    expect(await prisma.auditLog.findMany({
      where: { businessId: business.id }, orderBy: { id: "asc" },
    })).toEqual(auditsBefore);

    const changed = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${temporaryToken}`)
      .send({ currentPassword: initialPassword, newPassword: replacementPassword });
    expect(changed.status).toBe(200);

    const authorized = await request(app)
      .post(`/api/business/shifts/${secondShift.id}/assignments`)
      .set("Authorization", `Bearer ${changed.body.token as string}`)
      .send({ employeeId: employee.id, effectiveFrom: future, reason: "authorized after change" });
    expect(authorized.status).toBe(201);
  });
});
