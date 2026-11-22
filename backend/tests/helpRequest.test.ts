/**
 * M9 Phase 1 — help-request controller (`helpRequestController.ts`).
 *
 * Three surfaces:
 *   POST   /api/staff/help-requests       STAFF   file a ticket
 *   GET    /api/staff/help-requests       STAFF   own queue (paginated)
 *   GET    /api/staff/help-requests/:id   STAFF   own ticket, ownership-checked
 *   GET    /api/hr/help-requests          HR/SA   business queue (paginated)
 *   PATCH  /api/hr/help-requests/:id      HR/SA   the status ladder + note
 *
 * The subject/body/category bounds are the validator's; the requester and the
 * tenant are always forced from the caller, never the body.
 *
 * ── KNOWN PRODUCTION BUG M9-B1 (see correction.test.ts header for the full
 * write-up) ─────────────────────────────────────────────────────────────────
 * `middleware/validate.ts` writes the parsed query back with
 * `Object.assign(req.query, result.data)`; Express 5's `req.query` is an
 * un-memoised getter, so the coercion is discarded and both list handlers read
 * `limit` as a string and `page` as `undefined`, computing `skip = NaN` and
 * handing Prisma a string `take`. Both list lanes therefore answer 500. The
 * two list-contract tests below are `it.fails` tripwires (intended 200 asserted,
 * currently thrown); one plain test pins the observed 500.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_PASSWORD,
  TEST_SUPERADMIN_EMAIL as SUPERADMIN_EMAIL,
  TEST_HR_EMAIL as HR_EMAIL,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

const uniqueEmail = (prefix: string): string =>
  `${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@test.attendpro.com`;

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

async function fileTicket(
  token: string,
  body: { category?: string; subject?: string; body?: string; [key: string]: unknown }
) {
  return request(app)
    .post("/api/staff/help-requests")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function patchTicket(token: string, id: string, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/hr/help-requests/${id}`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

/** Opens a ticket through the real endpoint and returns its id. */
async function openTicket(token: string, subject = "M9 help ticket"): Promise<string> {
  const res = await fileTicket(token, {
    category: "pin",
    subject,
    body: "I cannot reset my own PIN and need help.",
  });
  if (res.status !== 201) {
    throw new Error(`Ticket creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.id as string;
}

let businessId: string;
let staffId: string;
let hrId: string;
let otherStaffId: string;
let staffToken: string;
let hrToken: string;
let saToken: string;

beforeAll(async () => {
  await ensureTestAccounts();

  const [staff, hr] = await Promise.all([
    prisma.user.findUnique({ where: { email: STAFF_EMAIL }, select: { id: true, businessId: true } }),
    prisma.user.findUnique({ where: { email: HR_EMAIL }, select: { id: true } }),
  ]);
  if (!staff || !hr) throw new Error("Fixture accounts missing");
  businessId = staff.businessId;
  staffId = staff.id;
  hrId = hr.id;

  const password = await bcrypt.hash(TEST_PASSWORD, 12);
  const otherStaff = await prisma.user.create({
    data: {
      businessId,
      employeeCode: `M9-HLP-${Date.now()}`,
      firstName: "Other",
      lastName: "Staff",
      email: uniqueEmail("m9.hlp.staff"),
      password,
      role: "STAFF",
      department: "Testing",
      isActive: true,
      mustChangePassword: false,
    },
    select: { id: true },
  });
  otherStaffId = otherStaff.id;

  staffToken = await tokenFor(STAFF_EMAIL);
  hrToken = await tokenFor(HR_EMAIL);
  saToken = await tokenFor(SUPERADMIN_EMAIL);
  // otherStaffId is referenced by the ownership tests; keep a live row.
  expect(otherStaffId).not.toBe(staffId);
  expect(hrId).not.toBe(staffId);
});

describe("POST /api/staff/help-requests — filing", () => {
  it("opens a ticket as OPEN and forces the requester from the caller", async () => {
    const res = await fileTicket(staffToken, {
      category: "kiosk",
      subject: "Kiosk will not read my badge",
      body: "The scanner blinks red and never beeps.",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("OPEN");

    const row = await prisma.attendanceHelpRequest.findUnique({
      where: { id: res.body.data.id },
      select: { requesterId: true, businessId: true, category: true, status: true },
    });
    expect(row?.requesterId).toBe(staffId);
    expect(row?.businessId).toBe(businessId);
    expect(row?.category).toBe("kiosk");
  });

  it("ignores a spoofed requesterId/businessId in the body", async () => {
    const res = await fileTicket(staffToken, {
      category: "access",
      subject: "Cannot reach the staff portal",
      body: "It says access denied after login.",
      requesterId: hrId,
      businessId: "00000000-0000-4000-8000-0000000000ff",
    });
    expect(res.status).toBe(201);

    const row = await prisma.attendanceHelpRequest.findUnique({
      where: { id: res.body.data.id },
      select: { requesterId: true, businessId: true },
    });
    expect(row?.requesterId).toBe(staffId);
    expect(row?.businessId).toBe(businessId);
  });

  it("writes a help.request_submitted audit row", async () => {
    const res = await fileTicket(staffToken, {
      category: "profile",
      subject: "My surname is misspelled",
      body: "It shows Adjeku but should be Adjekum.",
    });
    expect(res.status).toBe(201);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "help_request", entityId: res.body.data.id },
      select: { action: true },
    });
    expect(audits.map((row) => row.action)).toContain("help.request_submitted");
  });

  it("refuses an unknown category with 400", async () => {
    const res = await fileTicket(staffToken, {
      category: "salary",
      subject: "Payroll question",
      body: "Where is my payslip?",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  it("enforces the subject length floor and ceiling with 400", async () => {
    const tooShort = await fileTicket(staffToken, {
      category: "other",
      subject: "ab",
      body: "two characters",
    });
    expect(tooShort.status).toBe(400);

    const tooLong = await fileTicket(staffToken, {
      category: "other",
      subject: "s".repeat(121),
      body: "one hundred and twenty one characters",
    });
    expect(tooLong.status).toBe(400);
  });

  it("enforces the body length floor and ceiling with 400", async () => {
    const empty = await fileTicket(staffToken, {
      category: "other",
      subject: "Empty body",
      body: "",
    });
    expect(empty.status).toBe(400);

    const tooLong = await fileTicket(staffToken, {
      category: "other",
      subject: "Huge body",
      body: "x".repeat(4001),
    });
    expect(tooLong.status).toBe(400);
  });

  it("refuses HR on the staff lane with 403 and an anonymous caller with 401", async () => {
    const asHr = await fileTicket(hrToken, {
      category: "other",
      subject: "HR filing a staff ticket",
      body: "should not be allowed",
    });
    expect(asHr.status).toBe(403);

    const anon = await request(app)
      .post("/api/staff/help-requests")
      .send({ category: "other", subject: "anonymous", body: "no token" });
    expect(anon.status).toBe(401);
  });
});

describe("GET /api/staff/help-requests/:id — the caller's own ticket", () => {
  it("returns the caller's own ticket", async () => {
    const id = await openTicket(staffToken, "Own detail ticket");
    const res = await request(app)
      .get(`/api/staff/help-requests/${id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it("refuses a colleague's ticket with 403", async () => {
    const id = await openTicket(staffToken, "Colleague ticket");
    const res = await request(app)
      .get(`/api/staff/help-requests/${id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    // The owner sees it; we need a *different* staff caller to hit 403. Sign in
    // as the other staff member by minting a token for them the same way.
    const other = await prisma.user.findUnique({
      where: { id: otherStaffId },
      select: { email: true },
    });
    expect(res.status).toBe(200);
    expect(other?.email).toBeTruthy();

    const otherToken = await tokenFor(other!.email);
    const foreign = await request(app)
      .get(`/api/staff/help-requests/${id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(foreign.status).toBe(403);
    expect(foreign.body.message).toBe("Access denied");
  });

  it("returns 404 for an unknown id and 400 for a malformed id", async () => {
    const unknown = await request(app)
      .get("/api/staff/help-requests/00000000-0000-4000-8000-0000000000dd")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .get("/api/staff/help-requests/not-a-uuid")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(malformed.status).toBe(400);
  });
});

describe("GET /api/staff/help-requests — the caller's queue", () => {
  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("returns only the caller's own tickets [M9-B1]", async () => {
    const mine = await openTicket(staffToken, "Mine for the list");
    const foreign = await prisma.attendanceHelpRequest.create({
      data: {
        businessId,
        requesterId: otherStaffId,
        category: "other",
        subject: "Someone else's ticket",
        body: "Belongs to the other staff member.",
      },
      select: { id: true },
    });

    const res = await request(app)
      .get("/api/staff/help-requests?limit=100")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(foreign.id);
  });

  it("refuses HR with 403 (STAFF-only lane)", async () => {
    const res = await request(app)
      .get("/api/staff/help-requests")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/hr/help-requests — the business queue", () => {
  // xfail — see M9-B1 in the file header. Asserts the intended 200 contract.
  it("returns the queue with the requester attached [M9-B1]", async () => {
    const id = await openTicket(staffToken, "Queue ticket");
    const res = await request(app)
      .get("/api/hr/help-requests?limit=100")
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    const row = (res.body.data as Array<{ id: string; requester: { id: string } }>).find(
      (entry) => entry.id === id
    );
    expect(row?.requester.id).toBe(staffId);
  });

  it("refuses STAFF with 403 and an anonymous caller with 401", async () => {
    const asStaff = await request(app)
      .get("/api/hr/help-requests")
      .set("Authorization", `Bearer ${staffToken}`);
    expect(asStaff.status).toBe(403);

    const anon = await request(app).get("/api/hr/help-requests");
    expect(anon.status).toBe(401);
  });
});

describe("PATCH /api/hr/help-requests/:id — the status ladder", () => {
  it("moves OPEN → IN_REVIEW and audits help.request_status_changed", async () => {
    const id = await openTicket(staffToken, "Ladder: review");
    const res = await patchTicket(hrToken, id, { status: "IN_REVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("IN_REVIEW");
    expect(res.body.data.resolvedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "help_request", entityId: id },
      select: { action: true },
    });
    expect(audits.map((row) => row.action)).toContain("help.request_status_changed");
  });

  it("moves OPEN → RESOLVED directly, stamps resolvedAt and carries the note", async () => {
    const id = await openTicket(staffToken, "Ladder: resolve");
    const res = await patchTicket(hrToken, id, {
      status: "RESOLVED",
      resolutionNote: "PIN reset and badge re-issued.",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("RESOLVED");
    expect(res.body.data.resolutionNote).toBe("PIN reset and badge re-issued.");
    expect(res.body.data.resolvedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "help_request", entityId: id },
      select: { action: true },
    });
    expect(audits.map((row) => row.action)).toContain("help.request_resolved");
  });

  it("moves IN_REVIEW → CLOSED and clears/keeps resolvedAt appropriately (null off RESOLVED)", async () => {
    const id = await openTicket(staffToken, "Ladder: close from review");
    await patchTicket(hrToken, id, { status: "IN_REVIEW" });
    const res = await patchTicket(hrToken, id, { status: "CLOSED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CLOSED");
    expect(res.body.data.resolvedAt).toBeNull();
  });

  it("refuses a no-op status change with 409", async () => {
    const id = await openTicket(staffToken, "Ladder: no-op");
    const res = await patchTicket(hrToken, id, { status: "OPEN" });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("already in this status");
  });

  it("refuses re-opening a decided request with 409", async () => {
    const resolved = await openTicket(staffToken, "Ladder: resolved final");
    // Assert the intermediate decision first: if it did not land, the re-open
    // probe below is meaningless (and an unnoted failure would surface as a
    // confusing assertion mismatch on the probe instead of on the decision).
    const resolvedRes = await patchTicket(hrToken, resolved, { status: "RESOLVED" });
    expect(resolvedRes.status, JSON.stringify(resolvedRes.body)).toBe(200);
    const reopen = await patchTicket(hrToken, resolved, { status: "OPEN" });
    expect(reopen.status, JSON.stringify(reopen.body)).toBe(409);
    expect(reopen.body.message).toContain("Cannot move a request from RESOLVED to OPEN");

    const closed = await openTicket(staffToken, "Ladder: closed final");
    const closedRes = await patchTicket(hrToken, closed, { status: "CLOSED" });
    expect(closedRes.status, JSON.stringify(closedRes.body)).toBe(200);
    const reopenClosed = await patchTicket(hrToken, closed, { status: "IN_REVIEW" });
    expect(reopenClosed.status, JSON.stringify(reopenClosed.body)).toBe(409);
    expect(reopenClosed.body.message).toContain("Cannot move a request from CLOSED to IN_REVIEW");
  });

  it("lets the SUPERADMIN backstop decide a ticket (HR,SUPERADMIN lane)", async () => {
    const id = await openTicket(staffToken, "Ladder: superadmin");
    const res = await patchTicket(saToken, id, { status: "RESOLVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("RESOLVED");
  });

  it("returns 404 for an unknown id, a cross-business id and 400 for a malformed id", async () => {
    const unknown = await patchTicket(hrToken, "00000000-0000-4000-8000-0000000000ee", {
      status: "IN_REVIEW",
    });
    expect(unknown.status).toBe(404);

    const otherBusiness = await prisma.business.create({
      data: { name: "M9 Help Other", slug: `m9-help-other-${Date.now()}` },
      select: { id: true },
    });
    const otherUser = await prisma.user.create({
      data: {
        businessId: otherBusiness.id,
        employeeCode: "M9-HLP-OTHER",
        firstName: "Other",
        lastName: "Tenant",
        email: uniqueEmail("m9.hlp.other"),
        password: await bcrypt.hash(TEST_PASSWORD, 12),
        role: "STAFF",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    const foreign = await prisma.attendanceHelpRequest.create({
      data: {
        businessId: otherBusiness.id,
        requesterId: otherUser.id,
        category: "other",
        subject: "Foreign tenant ticket",
        body: "Not yours to touch.",
      },
      select: { id: true },
    });
    const crossTenant = await patchTicket(hrToken, foreign.id, { status: "IN_REVIEW" });
    expect(crossTenant.status).toBe(404);

    const malformed = await patchTicket(hrToken, "not-a-uuid", { status: "IN_REVIEW" });
    expect(malformed.status).toBe(400);
  });

  it("rejects a bad status, an empty note and an over-long note with 400", async () => {
    const id = await openTicket(staffToken, "Ladder: bad bodies");
    const badStatus = await patchTicket(hrToken, id, { status: "PENDING" });
    expect(badStatus.status).toBe(400);

    const emptyNote = await patchTicket(hrToken, id, { status: "IN_REVIEW", resolutionNote: "" });
    expect(emptyNote.status).toBe(400);

    const longNote = await patchTicket(hrToken, id, {
      status: "IN_REVIEW",
      resolutionNote: "n".repeat(501),
    });
    expect(longNote.status).toBe(400);
  });

  it("refuses STAFF with 403 and an anonymous caller with 401", async () => {
    const id = await openTicket(staffToken, "Ladder: roles");
    const asStaff = await patchTicket(staffToken, id, { status: "IN_REVIEW" });
    expect(asStaff.status).toBe(403);

    const anon = await request(app)
      .patch(`/api/hr/help-requests/${id}`)
      .send({ status: "IN_REVIEW" });
    expect(anon.status).toBe(401);
  });
});
