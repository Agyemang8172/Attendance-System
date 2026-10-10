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
import request from "supertest";
import app from "../server.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
} from "./fixtures.js";
import { generateTempPassword } from "../utils/credentials.js";

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