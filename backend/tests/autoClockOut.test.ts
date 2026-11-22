/**
 * M9 Phase 1 — the automatic clock-out sweep (`jobs/autoClockOut.ts`, M6).
 *
 * `runAutoClockOut(prisma, businessId?)` is called directly (no HTTP, no
 * `JOB_TOKEN`), aimed at a dedicated business so the pass cannot disturb the
 * OPEN sessions other suites leave behind. Everything the sweep reads is on the
 * attendance row's frozen snapshots plus the effective policy version, so each
 * test seeds one row per rule and asserts the row's end state and the audit
 * row.
 *
 * `attendances_open_per_user_uq` is a partial unique index on
 * `(user_id) WHERE session_status = 'OPEN'` — one open session per employee —
 * so every OPEN row needs its own user. The pool below mints cheap users (they
 * never sign in; only the FK matters), which keeps the sweep deterministic.
 *
 * Concurrent runs are refused through the transaction-scoped advisory lock
 * `hashtext('attendpro:auto-clock-out')`; the lock test holds it from a second
 * transaction and expects the exported `JOB_LOCKED` sentinel.
 */
import { describe, it, expect, beforeAll } from "vitest";
import prisma from "../config/prismaClient.js";
import {
  runAutoClockOut,
  JOB_LOCKED,
  AUTO_CLOCK_OUT_JOB_ACTIONS,
} from "../jobs/autoClockOut.js";

const MS_MIN = 60_000;
const MS_HOUR = 60 * MS_MIN;
const MS_DAY = 24 * MS_HOUR;

const utcMidnightDaysFromNow = (days: number): Date => {
  const now = new Date();
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return new Date(base.getTime() + days * MS_DAY);
};

let bizId: string;
let flagBizId: string;
let defaultVersionId: string;
let off60VersionId: string;
let disabledVersionId: string;
const userPool: string[] = [];

let poolIndex = 0;
const nextUser = (): string => {
  const id = userPool[poolIndex];
  poolIndex += 1;
  if (!id) throw new Error("User pool exhausted — add more users in beforeAll");
  return id;
};

type SeedOverrides = {
  businessId?: string;
  userId?: string;
  date?: Date;
  clockIn?: Date;
  sessionStatus?: "OPEN" | "CLOSED";
  status?:
    | "OPEN_SESSION"
    | "CLOCK_OUT_MISSING"
    | "AUTO_CLOSED"
    | "REQUIRES_REVIEW"
    | "ON_TIME";
  shiftStartMinuteSnapshot?: number | null;
  shiftEndMinuteSnapshot?: number | null;
  shiftCrossesMidnightSnapshot?: boolean | null;
  policyVersionId?: string | null;
};

async function seedAttendance(overrides: SeedOverrides) {
  const date = overrides.date ?? utcMidnightDaysFromNow(-3);
  const clockIn = overrides.clockIn ?? new Date(date.getTime() + 9 * 60 * MS_MIN);
  return prisma.attendance.create({
    data: {
      businessId: overrides.businessId ?? bizId,
      userId: overrides.userId ?? nextUser(),
      date,
      clockIn,
      sessionStatus: overrides.sessionStatus ?? "OPEN",
      status: overrides.status ?? "OPEN_SESSION",
      hoursWorked: 0,
      shiftNameSnapshot: "M9 Job Shift",
      shiftStartMinuteSnapshot:
        overrides.shiftStartMinuteSnapshot === undefined
          ? 9 * 60
          : overrides.shiftStartMinuteSnapshot,
      shiftEndMinuteSnapshot:
        overrides.shiftEndMinuteSnapshot === undefined
          ? 17 * 60
          : overrides.shiftEndMinuteSnapshot,
      shiftCrossesMidnightSnapshot:
        overrides.shiftCrossesMidnightSnapshot === undefined
          ? false
          : overrides.shiftCrossesMidnightSnapshot,
      timezoneSnapshot: "UTC",
      policyVersionId:
        overrides.policyVersionId === undefined ? null : overrides.policyVersionId,
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  const biz = await prisma.business.create({
    data: { name: "M9 Auto Clock-Out", slug: `m9-job-${Date.now()}` },
    select: { id: true },
  });
  bizId = biz.id;

  const flagBiz = await prisma.business.create({
    data: { name: "M9 Job No Policy", slug: `m9-job-none-${Date.now()}` },
    select: { id: true },
  });
  flagBizId = flagBiz.id;

  // A pool of cheap users (never used to sign in; the FK is all the sweep sees).
  for (let i = 0; i < 12; i++) {
    const user = await prisma.user.create({
      data: {
        businessId: bizId,
        employeeCode: `M9-JOB-${Date.now()}-${i}`,
        firstName: "Job",
        lastName: `User${i}`,
        email: `m9.job.${Date.now()}.${i}@test.attendpro.com`,
        password: "not-a-real-hash",
        role: "STAFF",
        department: "Testing",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true },
    });
    userPool.push(user.id);
  }

  const effectiveFrom = new Date(Date.now() - MS_DAY);
  const versionDefaults = {
    effectiveFrom,
    effectiveTo: null,
    autoClockOutMaxOpenMinutes: 840,
  };

  // One policy per business when `shift_id IS NULL` (the partial unique index is
  // on `shift_id IS NULL`, so extra policies are impossible) — the three
  // behaviours live as versions of this single default policy instead. The
  // highest live version number is what rows with no `policyVersionId` resolve
  // to, so the enabled default is numbered 100.
  const policy = await prisma.workplacePolicy.create({
    data: { businessId: bizId, name: "M9 Job Default", isDefault: true },
    select: { id: true },
  });

  const defaultVersion = await prisma.policyVersion.create({
    data: {
      businessId: bizId,
      policyId: policy.id,
      versionNumber: 100,
      autoClockOutEnabled: true,
      autoClockOutOffsetMinutes: 0,
      autoClockOutBufferMinutes: 120,
      ...versionDefaults,
    },
    select: { id: true },
  });
  defaultVersionId = defaultVersion.id;

  const offVersion = await prisma.policyVersion.create({
    data: {
      businessId: bizId,
      policyId: policy.id,
      versionNumber: 2,
      autoClockOutEnabled: true,
      autoClockOutOffsetMinutes: null,
      autoClockOutBufferMinutes: 60,
      ...versionDefaults,
    },
    select: { id: true },
  });
  off60VersionId = offVersion.id;

  const disabledVersion = await prisma.policyVersion.create({
    data: {
      businessId: bizId,
      policyId: policy.id,
      versionNumber: 1,
      autoClockOutEnabled: false,
      autoClockOutOffsetMinutes: 0,
      autoClockOutBufferMinutes: 120,
      ...versionDefaults,
    },
    select: { id: true },
  });
  disabledVersionId = disabledVersion.id;

  expect(defaultVersionId).toBeTruthy();
});

describe("runAutoClockOut — the scheduled close", () => {
  it("closes an overdue scheduled session at shift end + offset, audited as SYSTEM", async () => {
    const date = utcMidnightDaysFromNow(-3);
    const row = await seedAttendance({ date });
    const endInstant = new Date(date.getTime() + 17 * 60 * MS_MIN);

    const counts = await runAutoClockOut(prisma, bizId);
    expect(counts).not.toBe(JOB_LOCKED);
    if (counts === JOB_LOCKED) return;

    const updated = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: {
        sessionStatus: true,
        status: true,
        closureReason: true,
        clockOut: true,
        hoursWorked: true,
      },
    });
    expect(updated?.sessionStatus).toBe("CLOSED");
    expect(updated?.status).toBe("AUTO_CLOSED");
    expect(updated?.closureReason).toBe("AUTO_CLOCK_OUT");
    expect(updated?.clockOut?.getTime()).toBe(endInstant.getTime());
    expect(updated?.hoursWorked).toBeCloseTo(8, 5);

    const audits = await prisma.auditLog.findMany({
      where: { entityType: "attendance", entityId: row.id },
      select: { action: true, actorType: true },
    });
    expect(audits).toContainEqual({
      action: "job.auto_clock_out_closed",
      actorType: "SYSTEM",
    });
  });
});

describe("runAutoClockOut — the leaves", () => {
  it("leaves a disabled-policy row exactly as it stands", async () => {
    const row = await seedAttendance({
      date: utcMidnightDaysFromNow(-3),
      policyVersionId: disabledVersionId,
    });

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { sessionStatus: true, status: true, clockOut: true },
    });
    expect(after?.sessionStatus).toBe("OPEN");
    expect(after?.status).toBe("OPEN_SESSION");
    expect(after?.clockOut).toBeNull();

    const audits = await prisma.auditLog.count({
      where: { entityId: row.id },
    });
    expect(audits).toBe(0);
  });

  it("waits when the shift end + offset has not passed yet", async () => {
    const row = await seedAttendance({ date: utcMidnightDaysFromNow(2) });

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { sessionStatus: true, status: true },
    });
    expect(after?.sessionStatus).toBe("OPEN");
    expect(after?.status).toBe("OPEN_SESSION");
  });

  it("closes a no-window row at clockIn + maxOpen once past the ceiling (R10)", async () => {
    const clockIn = new Date(Date.now() - 15 * MS_HOUR);
    const row = await seedAttendance({
      date: utcMidnightDaysFromNow(-1),
      clockIn,
      shiftStartMinuteSnapshot: null,
      shiftEndMinuteSnapshot: null,
      shiftCrossesMidnightSnapshot: null,
    });

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { sessionStatus: true, status: true, closureReason: true, clockOut: true, hoursWorked: true },
    });
    const expectedClose = new Date(clockIn.getTime() + 840 * MS_MIN);
    expect(after?.sessionStatus).toBe("CLOSED");
    expect(after?.status).toBe("AUTO_CLOSED");
    expect(after?.closureReason).toBe("AUTO_CLOCK_OUT");
    expect(after?.clockOut?.getTime()).toBe(expectedClose.getTime());
    expect(after?.hoursWorked).toBeCloseTo(14, 5);
  });

  it("leaves a no-window row inside the max-open patience window OPEN", async () => {
    const clockIn = new Date(Date.now() - 1 * MS_HOUR);
    const row = await seedAttendance({
      date: utcMidnightDaysFromNow(0),
      clockIn,
      shiftStartMinuteSnapshot: null,
      shiftEndMinuteSnapshot: null,
      shiftCrossesMidnightSnapshot: null,
    });

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { sessionStatus: true, clockOut: true },
    });
    expect(after?.sessionStatus).toBe("OPEN");
    expect(after?.clockOut).toBeNull();
  });

  it("falls back to the buffer when the offset is unset (decision 3)", async () => {
    const date = utcMidnightDaysFromNow(-3);
    const row = await seedAttendance({ date, policyVersionId: off60VersionId });
    const expectedClose = new Date(date.getTime() + 17 * 60 * MS_MIN + 60 * MS_MIN);

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { clockOut: true, status: true },
    });
    expect(after?.status).toBe("AUTO_CLOSED");
    expect(after?.clockOut?.getTime()).toBe(expectedClose.getTime());
  });

  it("never touches a session that is already CLOSED", async () => {
    const row = await seedAttendance({
      date: utcMidnightDaysFromNow(-3),
      sessionStatus: "CLOSED",
      status: "ON_TIME",
      clockIn: new Date(utcMidnightDaysFromNow(-3).getTime() + 9 * 60 * MS_MIN),
    });

    await runAutoClockOut(prisma, bizId);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { sessionStatus: true, status: true },
    });
    expect(after?.sessionStatus).toBe("CLOSED");
    expect(after?.status).toBe("ON_TIME");
  });
});

describe("runAutoClockOut — the flag branch (no resolvable policy)", () => {
  it("flags an open row REQUIRES_REVIEW once, when no policy version resolves", async () => {
    const row = await seedAttendance({
      businessId: flagBizId,
      userId: nextUser(),
      date: utcMidnightDaysFromNow(-3),
    });

    const first = await runAutoClockOut(prisma, flagBizId);
    expect(first).not.toBe(JOB_LOCKED);
    if (first === JOB_LOCKED) return;
    expect(first.flagged).toBe(1);
    expect(first.closed).toBe(0);
    expect(first.businesses).toBe(1);

    const after = await prisma.attendance.findUnique({
      where: { id: row.id },
      select: { status: true, sessionStatus: true, requiresReviewReason: true },
    });
    expect(after?.status).toBe("REQUIRES_REVIEW");
    expect(after?.sessionStatus).toBe("OPEN");
    expect(after?.requiresReviewReason).toContain("could not be determined");

    // A second pass skips the already-flagged row — no re-write, no re-audit.
    const second = await runAutoClockOut(prisma, flagBizId);
    expect(second).not.toBe(JOB_LOCKED);
    if (second === JOB_LOCKED) return;
    expect(second.flagged).toBe(0);

    const audits = await prisma.auditLog.findMany({
      where: { entityId: row.id, action: "job.auto_clock_out_flagged" },
      select: { action: true, actorType: true },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorType).toBe("SYSTEM");
  });
});

describe("runAutoClockOut — concurrency", () => {
  it("returns JOB_LOCKED while another run holds the advisory lock", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('attendpro:auto-clock-out'))::text AS held`;
        await gate;
      },
      { maxWait: 10_000, timeout: 60_000 }
    );

    try {
      // Let the holder take the lock before the sweep tries.
      await new Promise((resolve) => setTimeout(resolve, 400));
      const result = await runAutoClockOut(prisma, bizId);
      expect(result).toBe(JOB_LOCKED);
    } finally {
      release();
      await holder.catch(() => undefined);
    }
  });

  it("exposes the two job actions the status endpoint reads back", () => {
    expect(AUTO_CLOCK_OUT_JOB_ACTIONS).toEqual([
      "job.auto_clock_out_closed",
      "job.auto_clock_out_flagged",
    ]);
  });
});
