/**
 * Kiosk device lifecycle + QR credential integration tests.
 *
 * Device lifecycle (contracts §7, kiosk §2):
 *   POST /api/kiosk/pairing-codes   SUPERADMIN issues a one-time code
 *   POST /api/kiosk/pair            public device redemption
 *   POST /api/kiosk/token/renew     kiosk device token rotation
 *   GET  /api/kiosk/devices         SUPERADMIN list
 *   POST /api/kiosk/devices/:id/revoke
 *
 * QR credentials (contracts §7, kiosk §3):
 *   POST /api/business/employees/:id/qr-credential
 *   POST /api/business/qr-credentials/:id/revoke
 *
 * Every row created here is tagged with a run-unique label/code and removed in
 * `afterAll`. Audit rows are append-only and stay in the database by design.
 *
 * The pair route is rate-limited to 10 redemptions per 15 minutes per IP, so
 * this file deliberately stays under that ceiling and the verification suite
 * seeds paired terminals rather than redeeming more codes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";
import {
  cleanupKiosk,
  createTempStaff,
  seedActiveKiosk,
  uniqueTag,
  qrTokenHash,
  type SeededKiosk,
  type TempStaff,
} from "./kioskFixtures.js";

async function tokenFor(email: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let saToken: string;
let hrToken: string;
let staffToken: string;
let businessId: string;

let tempStaff: TempStaff;
let inactiveStaff: TempStaff;
let siteId: string;

/** Every terminal this file creates, whether by API or by seed. */
const kioskIds: string[] = [];
/** A seeded terminal used for the 90-day age branch (no pairing needed). */
let agedKiosk: SeededKiosk;
/** Device paired through the real route. */
let pairedDevice: { id: string; token: string; publicId: string };
let currentToken: string;

/** The first code issued for the re-pair fixture. */
let firstCode: string;
/** The code reissued onto the same pending terminal. */
let reissuedCode: string;
/** The device the reissued code paired. */
let reissueTerminalId: string;

let credentialId: string;
let firstQrPayload: string;

beforeAll(async () => {
  await ensureTestAccounts();
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  staffToken = await tokenFor(STAFF_EMAIL);

  const staff = await prisma.user.findUnique({
    where: { email: STAFF_EMAIL },
    select: { businessId: true },
  });
  if (!staff) throw new Error("Fixture STAFF account missing");
  businessId = staff.businessId;

  tempStaff = await createTempStaff(businessId);
  inactiveStaff = await createTempStaff(businessId, { isActive: false });

  const site = await prisma.site.create({
    data: {
      businessId,
      name: `Kiosk Site ${uniqueTag()}`,
      latitude: 5.6037,
      longitude: -0.187,
      radiusMeters: 150,
    },
    select: { id: true },
  });
  siteId = site.id;

  agedKiosk = await seedActiveKiosk(businessId, { label: `Aged kiosk ${uniqueTag()}` });
  kioskIds.push(agedKiosk.id);
});

afterAll(async () => {
  await cleanupKiosk({
    kioskIds: Array.from(new Set(kioskIds)),
    employeeIds: [tempStaff.id, inactiveStaff.id],
    siteIds: [siteId],
  });
});

// ── Pairing-code issue ──────────────────────────────────────────────────────

describe("POST /api/kiosk/pairing-codes", () => {
  const issue = (token: string | null, body: Record<string, unknown>) => {
    const req = request(app).post("/api/kiosk/pairing-codes");
    return (token ? req.set(auth(token)) : req).send(body);
  };

  it("requires authentication", async () => {
    const res = await issue(null, { label: "No session" });
    expect(res.status).toBe(401);
  });

  it("refuses HR and STAFF (SUPERADMIN only)", async () => {
    expect((await issue(hrToken, { label: "HR attempt" })).status).toBe(403);
    expect((await issue(staffToken, { label: "Staff attempt" })).status).toBe(403);
  });

  it("rejects a missing label", async () => {
    const res = await issue(saToken, {});
    expect(res.status).toBe(400);
  });

  it("refuses a site from another business / an unknown site", async () => {
    const res = await issue(saToken, { label: `Site ${uniqueTag()}`, siteId: randomUUID() });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Site not found");
  });

  it("issues a one-time code, stores only its keyed hash, and audits the issue", async () => {
    const label = `Front desk ${uniqueTag()}`;
    const res = await issue(saToken, { label, siteId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.kioskId).toEqual(expect.any(String));
    expect(res.body.data.publicId).toMatch(/^KT-/);
    expect(res.body.data.pairingCode).toMatch(/^[A-Z2-9]{8}$/);
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    kioskIds.push(res.body.data.kioskId);
    firstCode = res.body.data.pairingCode;

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: res.body.data.kioskId },
      select: {
        state: true,
        pairingCodeHash: true,
        pairingCodeExpiresAt: true,
        siteId: true,
        registeredByUserId: true,
      },
    });
    expect(stored?.state).toBe("PENDING_PAIRING");
    expect(stored?.siteId).toBe(siteId);
    expect(stored?.pairingCodeHash).not.toBe(firstCode);
    expect(stored?.pairingCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.registeredByUserId).toEqual(expect.any(String));

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.pairing_code_issued", entityId: res.body.data.kioskId },
      select: { businessId: true, entityType: true },
    });
    expect(audit).toMatchObject({ businessId, entityType: "kiosk" });
  });

  it("reissues onto the same pending terminal instead of creating a second row", async () => {
    const label = `Front desk ${uniqueTag()}`;
    const created = await issue(saToken, { label, siteId });
    expect(created.status).toBe(201);
    kioskIds.push(created.body.data.kioskId);

    const before = await prisma.auditLog.count({
      where: { action: "kiosk.pairing_code_issued", entityId: created.body.data.kioskId },
    });

    const reissued = await issue(saToken, { label, siteId });
    expect(reissued.status).toBe(201);
    expect(reissued.body.data.kioskId).toBe(created.body.data.kioskId);
    expect(reissued.body.data.publicId).toBe(created.body.data.publicId);
    expect(reissued.body.data.pairingCode).not.toBe(created.body.data.pairingCode);

    reissueTerminalId = reissued.body.data.kioskId;
    reissuedCode = reissued.body.data.pairingCode;

    const after = await prisma.auditLog.count({
      where: { action: "kiosk.pairing_code_issued", entityId: created.body.data.kioskId },
    });
    expect(after).toBe(before + 1);

    // Keep both halves of the pair fixture: the old code must be dead once the
    // new hash lands, which the pair-route tests assert.
    firstCode = created.body.data.pairingCode;
  });

  it("fails closed with a 500 when the pairing key is missing", async () => {
    const original = process.env.KIOSK_PAIRING_KEY;
    delete process.env.KIOSK_PAIRING_KEY;
    try {
      const res = await issue(saToken, { label: `No key ${uniqueTag()}` });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false });
    } finally {
      process.env.KIOSK_PAIRING_KEY = original;
    }
  });
});

// ── Pairing redemption ──────────────────────────────────────────────────────

describe("POST /api/kiosk/pair", () => {
  const pair = (body: Record<string, unknown>) => request(app).post("/api/kiosk/pair").send(body);

  it("rejects an unknown pairing code with the generic refusal", async () => {
    const res = await pair({ pairingCode: "ZZZZZZZZ" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Invalid or expired pairing code" });
  });

  it("rejects a code that fails validation", async () => {
    const res = await pair({ pairingCode: "ABC" });
    expect(res.status).toBe(400);
  });

  it("rejects a correct-but-expired code with the same refusal", async () => {
    const issued = await request(app)
      .post("/api/kiosk/pairing-codes")
      .set(auth(saToken))
      .send({ label: `Expired device ${uniqueTag()}`, siteId });
    expect(issued.status).toBe(201);
    kioskIds.push(issued.body.data.kioskId);

    await prisma.kioskTerminal.update({
      where: { id: issued.body.data.kioskId },
      data: { pairingCodeExpiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await pair({ pairingCode: issued.body.data.pairingCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired pairing code");
  });

  it("rejects the superseded code after a reissue", async () => {
    const res = await pair({ pairingCode: firstCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired pairing code");
  });

  it("pairs a device from a lower-case, whitespace-padded code and issues a token", async () => {
    const res = await pair({ pairingCode: ` ${reissuedCode.toLowerCase()} ` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.publicId).toMatch(/^KT-/);
    expect(new Date(res.body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    pairedDevice = {
      id: reissueTerminalId,
      token: res.body.data.token,
      publicId: res.body.data.publicId,
    };
    currentToken = res.body.data.token;

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: reissueTerminalId },
      select: {
        state: true,
        pairingCodeHash: true,
        pairingCodeExpiresAt: true,
        tokenHash: true,
        tokenVersion: true,
        pairedAt: true,
      },
    });
    expect(stored).toMatchObject({
      state: "ACTIVE",
      pairingCodeHash: null,
      pairingCodeExpiresAt: null,
      tokenVersion: 1,
    });
    expect(stored?.tokenHash).not.toBe(res.body.data.token);
    expect(stored?.pairedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.paired", entityId: reissueTerminalId },
      select: { entityType: true, reason: true },
    });
    expect(audit).toMatchObject({ entityType: "kiosk", reason: "pairing code used" });
  });

  it("refuses to re-pair an already-paired device with the spent code", async () => {
    const res = await pair({ pairingCode: reissuedCode });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid or expired pairing code");

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: pairedDevice.id },
      select: { state: true, tokenVersion: true },
    });
    // The refusal changed nothing: one live credential, still one version.
    expect(stored).toMatchObject({ state: "ACTIVE", tokenVersion: 1 });
  });

  it("fails closed with a 500 when the kiosk token key is missing", async () => {
    const original = process.env.KIOSK_TOKEN_KEY;
    delete process.env.KIOSK_TOKEN_KEY;
    try {
      const res = await pair({ pairingCode: reissuedCode });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false });
    } finally {
      process.env.KIOSK_TOKEN_KEY = original;
    }
  });
});

// ── Token renewal ───────────────────────────────────────────────────────────

describe("POST /api/kiosk/token/renew", () => {
  const renew = (token: string | null) => {
    const req = request(app).post("/api/kiosk/token/renew");
    return token ? req.set(auth(token)) : req;
  };

  it("requires a device token", async () => {
    expect((await renew(null)).status).toBe(401);
    expect((await renew("not-a-jwt")).status).toBe(401);
  });

  it("refuses an employee session token (kind claim mismatch)", async () => {
    const res = await renew(saToken);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

  it("rotates the token and rejects the previous one", async () => {
    const rotated = await renew(currentToken);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.token).toEqual(expect.any(String));
    expect(rotated.body.data.token).not.toBe(currentToken);

    const stale = await renew(currentToken);
    expect(stale.status).toBe(401);

    const next = await renew(rotated.body.data.token);
    expect(next.status).toBe(200);
    currentToken = next.body.data.token;

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: pairedDevice.id },
      select: { tokenVersion: true, tokenIssuedAt: true },
    });
    expect(stored?.tokenVersion).toBe(3);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.token_renewed", entityId: pairedDevice.id },
      orderBy: { createdAt: "desc" },
      select: { entityType: true },
    });
    expect(audit).toMatchObject({ entityType: "kiosk" });

    const rejected = await prisma.auditLog.findFirst({
      where: { action: "kiosk.token_rejected", entityId: pairedDevice.id },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    expect(rejected?.reason).toBe("token version mismatch");
  });

  it("fails closed with a 500 when the kiosk token key is missing", async () => {
    const original = process.env.KIOSK_TOKEN_KEY;
    delete process.env.KIOSK_TOKEN_KEY;
    try {
      const res = await renew(currentToken);
      expect(res.status).toBe(500);
    } finally {
      process.env.KIOSK_TOKEN_KEY = original;
    }
  });

  it("rejects a token whose stored expiry has passed", async () => {
    await prisma.kioskTerminal.update({
      where: { id: pairedDevice.id },
      data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await renew(currentToken);
    expect(res.status).toBe(401);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.token_rejected", entityId: pairedDevice.id },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    expect(audit?.reason).toBe("token expired");

    // Restore a live window so the later revocation assertions are about the
    // revoke, not about the expiry we just forced.
    await prisma.kioskTerminal.update({
      where: { id: pairedDevice.id },
      data: { tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
  });

  it("sends a device at the 90-day maximum age back to PENDING_PAIRING", async () => {
    await prisma.kioskTerminal.update({
      where: { id: agedKiosk.id },
      data: { tokenIssuedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
    });

    const res = await renew(agedKiosk.token);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/maximum age/i);

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: agedKiosk.id },
      select: {
        state: true,
        tokenHash: true,
        tokenVersion: true,
        tokenIssuedAt: true,
        tokenExpiresAt: true,
      },
    });
    expect(stored).toMatchObject({
      state: "PENDING_PAIRING",
      tokenHash: null,
      tokenVersion: 0,
      tokenIssuedAt: null,
      tokenExpiresAt: null,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.expired", entityId: agedKiosk.id },
      select: { businessId: true, reason: true },
    });
    expect(audit?.reason).toBe("token reached 90-day maximum age");
  });
});

// ── Device list ─────────────────────────────────────────────────────────────

describe("GET /api/kiosk/devices", () => {
  const list = (token: string | null, query = "") => {
    const req = request(app).get(`/api/kiosk/devices${query}`);
    return token ? req.set(auth(token)) : req;
  };

  it("requires authentication and SUPERADMIN", async () => {
    expect((await list(null)).status).toBe(401);
    expect((await list(hrToken)).status).toBe(403);
    expect((await list(staffToken)).status).toBe(403);
  });

  it("rejects an unknown state filter", async () => {
    expect((await list(saToken, "?state=NOPE")).status).toBe(400);
  });

  it("lists devices without exposing secret hashes", async () => {
    const res = await list(saToken, "?limit=100");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toMatchObject({
      currentPage: 1,
      totalDevices: expect.any(Number),
    });

    const mine = (res.body.data as Array<Record<string, unknown>>).find(
      (d) => d.id === pairedDevice.id
    );
    expect(mine).toMatchObject({
      id: pairedDevice.id,
      publicId: pairedDevice.publicId,
      state: "ACTIVE",
      siteId,
    });
    expect(mine).not.toHaveProperty("tokenHash");
    expect(mine).not.toHaveProperty("pairingCodeHash");
  });

  it("filters by state and site", async () => {
    const active = await list(saToken, "?state=ACTIVE&limit=100");
    expect(active.status).toBe(200);
    expect(active.body.data.every((d: { state: string }) => d.state === "ACTIVE")).toBe(true);
    expect(active.body.data.some((d: { id: string }) => d.id === pairedDevice.id)).toBe(true);

    const bySite = await list(saToken, `?siteId=${siteId}&limit=100`);
    expect(bySite.status).toBe(200);
    expect(bySite.body.data.some((d: { id: string }) => d.id === pairedDevice.id)).toBe(true);
  });

  it("paginates", async () => {
    const res = await list(saToken, "?page=1&limit=1");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.currentPage).toBe(1);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });
});

// ── Revocation ──────────────────────────────────────────────────────────────

describe("POST /api/kiosk/devices/:id/revoke", () => {
  const revoke = (token: string | null, id: string, body: Record<string, unknown> = {}) => {
    const req = request(app).post(`/api/kiosk/devices/${id}/revoke`);
    return (token ? req.set(auth(token)) : req).send(body);
  };

  it("requires SUPERADMIN", async () => {
    expect((await revoke(null, pairedDevice.id)).status).toBe(401);
    expect((await revoke(hrToken, pairedDevice.id)).status).toBe(403);
    expect((await revoke(staffToken, pairedDevice.id)).status).toBe(403);
  });

  it("validates the device id", async () => {
    expect((await revoke(saToken, "not-a-uuid")).status).toBe(400);
  });

  it("returns 404 for an unknown device", async () => {
    const res = await revoke(saToken, randomUUID(), { reason: "unknown" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Device not found");
  });

  it("revokes the device, bumps the version, and audits the reason", async () => {
    const before = await prisma.kioskTerminal.findUnique({
      where: { id: pairedDevice.id },
      select: { tokenVersion: true },
    });

    const res = await revoke(saToken, pairedDevice.id, { reason: "lost in transit" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: pairedDevice.id, state: "REVOKED" });

    const stored = await prisma.kioskTerminal.findUnique({
      where: { id: pairedDevice.id },
      select: { state: true, tokenVersion: true, revokedAt: true, revokedByUserId: true },
    });
    expect(stored?.state).toBe("REVOKED");
    expect(stored?.tokenVersion).toBe((before?.tokenVersion ?? 0) + 1);
    expect(stored?.revokedAt).toBeInstanceOf(Date);
    expect(stored?.revokedByUserId).toEqual(expect.any(String));

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.revoked", entityId: pairedDevice.id },
      select: { reason: true, businessId: true },
    });
    expect(audit).toMatchObject({ reason: "lost in transit", businessId });
  });

  it("refuses a second revocation with 409", async () => {
    const res = await revoke(saToken, pairedDevice.id);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Device is already revoked");
  });

  it("kills the live token the moment the device is revoked", async () => {
    const res = await request(app)
      .post("/api/kiosk/token/renew")
      .set(auth(currentToken));
    expect(res.status).toBe(401);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "kiosk.token_rejected", entityId: pairedDevice.id },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    expect(audit?.reason).toContain("terminal not in active state");
  });

  it("shows the revoked state in the device list filter", async () => {
    const res = await request(app)
      .get("/api/kiosk/devices?state=REVOKED&limit=100")
      .set(auth(saToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((d: { id: string }) => d.id === pairedDevice.id)).toBe(true);
  });
});

// ── QR credentials ──────────────────────────────────────────────────────────

describe("QR credential issue/revoke", () => {
  const issueQr = (token: string | null, employeeId: string) => {
    const req = request(app).post(`/api/business/employees/${employeeId}/qr-credential`);
    return token ? req.set(auth(token)) : req;
  };
  const revokeQr = (token: string | null, id: string) => {
    const req = request(app).post(`/api/business/qr-credentials/${id}/revoke`);
    return token ? req.set(auth(token)) : req;
  };

  it("requires authentication and SUPERADMIN", async () => {
    expect((await issueQr(null, tempStaff.id)).status).toBe(401);
    expect((await issueQr(hrToken, tempStaff.id)).status).toBe(403);
    expect((await issueQr(staffToken, tempStaff.id)).status).toBe(403);
    expect((await revokeQr(null, randomUUID())).status).toBe(401);
    expect((await revokeQr(hrToken, randomUUID())).status).toBe(403);
    expect((await revokeQr(staffToken, randomUUID())).status).toBe(403);
  });

  it("validates the employee id and returns 404 for an unknown employee", async () => {
    expect((await issueQr(saToken, "not-a-uuid")).status).toBe(400);
    const res = await issueQr(saToken, randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Employee not found");
  });

  it("issues a credential, shows the payload once, and stores only its hash", async () => {
    const res = await issueQr(saToken, tempStaff.id);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(res.body.data.qrPayload).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(res.body.data.schemaVersion).toBe(1);
    expect(res.body.data).not.toHaveProperty("tokenHash");

    credentialId = res.body.data.id;
    firstQrPayload = res.body.data.qrPayload;

    const stored = await prisma.qrCredential.findUnique({
      where: { id: credentialId },
      select: { tokenHash: true, revokedAt: true, employeeId: true, businessId: true },
    });
    expect(stored?.tokenHash).toBe(qrTokenHash(firstQrPayload));
    expect(stored?.tokenHash).not.toBe(firstQrPayload);
    expect(stored?.revokedAt).toBeNull();
    expect(stored).toMatchObject({ employeeId: tempStaff.id, businessId });
  });

  it("re-issue revokes the previous active credential", async () => {
    const res = await issueQr(saToken, tempStaff.id);
    expect(res.status).toBe(201);
    expect(res.body.data.qrPayload).not.toBe(firstQrPayload);

    const old = await prisma.qrCredential.findUnique({
      where: { id: credentialId },
      select: { revokedAt: true, revokedByUserId: true },
    });
    expect(old?.revokedAt).toBeInstanceOf(Date);
    expect(old?.revokedByUserId).toEqual(expect.any(String));

    const active = await prisma.qrCredential.count({
      where: { employeeId: tempStaff.id, revokedAt: null },
    });
    expect(active).toBe(1);

    credentialId = res.body.data.id;
  });

  it("refuses to issue for an inactive employee", async () => {
    const res = await issueQr(saToken, inactiveStaff.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Employee is not active");
  });

  it("fails closed with a 500 when the QR key is missing", async () => {
    const original = process.env.QR_SECRET_KEY;
    delete process.env.QR_SECRET_KEY;
    try {
      const res = await issueQr(saToken, tempStaff.id);
      expect(res.status).toBe(500);
    } finally {
      process.env.QR_SECRET_KEY = original;
    }
  });

  it("validates the credential id and returns 404 for an unknown credential", async () => {
    expect((await revokeQr(saToken, "not-a-uuid")).status).toBe(400);
    const res = await revokeQr(saToken, randomUUID());
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Credential not found");
  });

  it("revokes the credential and refuses a second revocation", async () => {
    const res = await revokeQr(saToken, credentialId);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Credential revoked");

    const stored = await prisma.qrCredential.findUnique({
      where: { id: credentialId },
      select: { revokedAt: true, revokedByUserId: true },
    });
    expect(stored?.revokedAt).toBeInstanceOf(Date);
    expect(stored?.revokedByUserId).toEqual(expect.any(String));

    const again = await revokeQr(saToken, credentialId);
    expect(again.status).toBe(400);
    expect(again.body.message).toBe("Credential is already revoked");
  });
});
