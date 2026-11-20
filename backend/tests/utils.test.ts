/**
 * M9 Phase 1 — Unit tests for the pure/boundary helpers.
 *
 * Covers `statusEngine` (EARLY / ON_TIME / LATE / OPEN_SESSION and the
 * clock-out missing flag), `shiftWindow` (scheduled end instants including the
 * overnight +1 day branch, and the shared hours divisor), `location`
 * (INSIDE / OUTSIDE + near-miss / UNKNOWN under the R1 accuracy and staleness
 * bounds), `tenant` (the caller's business resolution) and `auditWriter` (the
 * durable row's actor derivation and JSON snapshot columns).
 *
 * The three pure modules need no database; the last two reach the local
 * database the same way every other suite does, through `tests/fixtures.ts`
 * and `config/prismaClient.ts`. Rows this file writes are tagged with an
 * action unique to this suite and deleted in `afterAll`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  evaluateClockInStatus,
  evaluateClockOutStatus,
} from "../utils/statusEngine.js";
import {
  resolveShiftEndInstant,
  minutesBetween,
  hoursBetween,
} from "../utils/shiftWindow.js";
import {
  assessLocation,
  haversineDistanceMeters,
  LOCATION_STALENESS_MS,
  LOCATION_ACCURACY_MAX_METERS,
} from "../utils/location.js";
import { callerBusinessId } from "../utils/tenant.js";
import { writeAudit } from "../utils/auditWriter.js";
import prisma from "../config/prismaClient.js";
import {
  ensureTestAccounts,
  TEST_STAFF_EMAIL as STAFF_EMAIL,
} from "./fixtures.js";

/** A UTC instant on a fixed date; only the minute-of-day matters to the engine. */
const at = (hour: number, minute: number): Date =>
  new Date(Date.UTC(2026, 0, 15, hour, minute));

const DAY_SHIFT = { startMinute: 9 * 60, endMinute: 17 * 60, crossesMidnight: false };
const NIGHT_SHIFT = { startMinute: 22 * 60, endMinute: 6 * 60, crossesMidnight: true };
/** A shift whose start is just before midnight, to exercise the modular wrap. */
const LATE_NIGHT_SHIFT = { startMinute: 23 * 60 + 55, endMinute: 5 * 60, crossesMidnight: true };

describe("statusEngine.evaluateClockInStatus", () => {
  const policy = { graceEarlyMinutes: 10, graceLateMinutes: 10 };

  it("answers OPEN_SESSION when there is no shift or no policy to judge by", () => {
    expect(evaluateClockInStatus(at(9, 0), null, policy)).toBe("OPEN_SESSION");
    expect(evaluateClockInStatus(at(9, 0), DAY_SHIFT, null)).toBe("OPEN_SESSION");
    expect(evaluateClockInStatus(at(9, 0), null, null)).toBe("OPEN_SESSION");
  });

  it("classifies a punch beyond the early grace as EARLY", () => {
    // 08:45 is 15 minutes before a 09:00 start, past a 10-minute early grace.
    expect(evaluateClockInStatus(at(8, 45), DAY_SHIFT, policy)).toBe("EARLY");
  });

  it("classifies a punch inside the early grace as ON_TIME", () => {
    // Exactly on the grace boundary is inside it (<= comparison).
    expect(evaluateClockInStatus(at(8, 50), DAY_SHIFT, policy)).toBe("ON_TIME");
    expect(evaluateClockInStatus(at(9, 0), DAY_SHIFT, policy)).toBe("ON_TIME");
  });

  it("classifies a punch inside the late grace as ON_TIME and beyond it as LATE", () => {
    expect(evaluateClockInStatus(at(9, 10), DAY_SHIFT, policy)).toBe("ON_TIME");
    expect(evaluateClockInStatus(at(9, 11), DAY_SHIFT, policy)).toBe("LATE");
  });

  it("treats a zero early grace as EARLY for any pre-start punch", () => {
    const noGrace = { graceEarlyMinutes: 0, graceLateMinutes: 0 };
    expect(evaluateClockInStatus(at(8, 59), DAY_SHIFT, noGrace)).toBe("EARLY");
    expect(evaluateClockInStatus(at(9, 0), DAY_SHIFT, noGrace)).toBe("ON_TIME");
    expect(evaluateClockInStatus(at(9, 1), DAY_SHIFT, noGrace)).toBe("LATE");
  });

  it("measures across midnight with modular arithmetic", () => {
    const wrapPolicy = { graceEarlyMinutes: 5, graceLateMinutes: 5 };
    // 23:50 is 5 minutes before a 23:55 start — inside the early grace.
    expect(evaluateClockInStatus(at(23, 50), LATE_NIGHT_SHIFT, wrapPolicy)).toBe("ON_TIME");
    // 23:45 is 10 minutes before: EARLY, not "almost 24 hours late".
    expect(evaluateClockInStatus(at(23, 45), LATE_NIGHT_SHIFT, wrapPolicy)).toBe("EARLY");
    // 00:02 is 7 minutes after the start: LATE past a 5-minute late grace.
    expect(evaluateClockInStatus(at(0, 2), LATE_NIGHT_SHIFT, wrapPolicy)).toBe("LATE");
  });
});

describe("statusEngine.evaluateClockOutStatus", () => {
  it("leaves the status alone when there is no shift", () => {
    expect(evaluateClockOutStatus(at(23, 0), "ON_TIME", null)).toBe("ON_TIME");
  });

  it("flags a same-day session that clocks out past the shift end", () => {
    expect(evaluateClockOutStatus(at(18, 0), "ON_TIME", DAY_SHIFT)).toBe("CLOCK_OUT_MISSING");
    expect(evaluateClockOutStatus(at(16, 0), "ON_TIME", DAY_SHIFT)).toBe("ON_TIME");
  });

  it("keeps an overnight shift's opening-evening departure as-is", () => {
    // 22:30 is after the 22:00 start: the shift is still in progress.
    expect(evaluateClockOutStatus(at(22, 30), "ON_TIME", NIGHT_SHIFT)).toBe("ON_TIME");
  });

  it("tolerates an overnight clock-out up to the end minute and flags beyond it", () => {
    // 05:00 is before the 06:00 end: still inside the shift.
    expect(evaluateClockOutStatus(at(5, 0), "ON_TIME", NIGHT_SHIFT)).toBe("ON_TIME");
    // 06:00 is the end boundary: still inside.
    expect(evaluateClockOutStatus(at(6, 0), "ON_TIME", NIGHT_SHIFT)).toBe("ON_TIME");
    // 07:00 is past the end and still before the start: no proper clock-out.
    expect(evaluateClockOutStatus(at(7, 0), "ON_TIME", NIGHT_SHIFT)).toBe("CLOCK_OUT_MISSING");
  });
});

describe("shiftWindow.resolveShiftEndInstant", () => {
  const date = new Date(Date.UTC(2026, 0, 15));

  it("resolves a same-day shift end on the record's own date", () => {
    const instant = resolveShiftEndInstant({
      date,
      shiftStartMinuteSnapshot: 540,
      shiftEndMinuteSnapshot: 1020,
      shiftCrossesMidnightSnapshot: false,
      timezoneSnapshot: null,
    });
    expect(instant?.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("adds a day for an explicit overnight shift", () => {
    const instant = resolveShiftEndInstant({
      date,
      shiftStartMinuteSnapshot: 1320,
      shiftEndMinuteSnapshot: 360,
      shiftCrossesMidnightSnapshot: true,
      timezoneSnapshot: null,
    });
    expect(instant?.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("derives the overnight flag when end is at or before start and the flag is absent", () => {
    const derived = resolveShiftEndInstant({
      date,
      shiftStartMinuteSnapshot: 1320,
      shiftEndMinuteSnapshot: 360,
      shiftCrossesMidnightSnapshot: null,
      timezoneSnapshot: null,
    });
    expect(derived?.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });

  it("treats an end equal to the start as overnight when the flag is absent", () => {
    const instant = resolveShiftEndInstant({
      date,
      shiftStartMinuteSnapshot: 600,
      shiftEndMinuteSnapshot: 600,
      shiftCrossesMidnightSnapshot: null,
      timezoneSnapshot: null,
    });
    expect(instant?.toISOString()).toBe("2026-01-16T10:00:00.000Z");
  });

  it("returns null when the end minute is missing", () => {
    expect(
      resolveShiftEndInstant({
        date,
        shiftStartMinuteSnapshot: 540,
        shiftEndMinuteSnapshot: null,
        shiftCrossesMidnightSnapshot: false,
        timezoneSnapshot: null,
      })
    ).toBeNull();
  });

  it("returns null when the overnight question is ambiguous", () => {
    // End minute present but neither the start minute nor the cross flag.
    expect(
      resolveShiftEndInstant({
        date,
        shiftStartMinuteSnapshot: null,
        shiftEndMinuteSnapshot: 360,
        shiftCrossesMidnightSnapshot: null,
        timezoneSnapshot: null,
      })
    ).toBeNull();
  });

  it("trusts a present overnight flag even without the start minute", () => {
    const instant = resolveShiftEndInstant({
      date,
      shiftStartMinuteSnapshot: null,
      shiftEndMinuteSnapshot: 360,
      shiftCrossesMidnightSnapshot: true,
      timezoneSnapshot: null,
    });
    expect(instant?.toISOString()).toBe("2026-01-16T06:00:00.000Z");
  });
});

describe("shiftWindow.minutesBetween / hoursBetween", () => {
  it("measures whole-minute distances", () => {
    expect(minutesBetween(at(9, 0), at(10, 30))).toBe(90);
  });

  it("uses the punch path's exact hours divisor", () => {
    expect(hoursBetween(at(9, 0), at(10, 0))).toBe(1);
    expect(hoursBetween(at(9, 0), at(10, 30))).toBeCloseTo(1.5, 10);
    // The divisor is (ms / 1000 / 60 / 60): reproduce it literally.
    const from = at(9, 0);
    const to = at(17, 36);
    expect(hoursBetween(from, to)).toBe((to.getTime() - from.getTime()) / (1000 * 60 * 60));
  });
});

describe("location.assessLocation (R1 bounds)", () => {
  const site = { latitude: 0, longitude: 0, radiusMeters: 100 };

  it("returns INSIDE for the site centre", () => {
    const result = assessLocation(site, { latitude: 0, longitude: 0 });
    expect(result.result).toBe("INSIDE");
    expect(result.nearMiss).toBe(false);
    expect(result.distanceMeters).toBeCloseTo(0, 6);
  });

  it("returns INSIDE within the radius", () => {
    // ~89 m from the centre at the equator.
    const result = assessLocation(site, { latitude: 0, longitude: 0.0008 });
    expect(result.result).toBe("INSIDE");
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.distanceMeters).toBeLessThanOrEqual(100);
  });

  it("flags OUTSIDE within the near-miss margin as a near miss", () => {
    // ~100.1 m: just past a 100 m fence, inside the 25 m near-miss margin.
    const result = assessLocation(site, { latitude: 0, longitude: 0.0009 });
    expect(result.result).toBe("OUTSIDE");
    expect(result.nearMiss).toBe(true);
  });

  it("returns OUTSIDE without a near miss well past the margin", () => {
    const result = assessLocation(site, { latitude: 0, longitude: 0.002 });
    expect(result.result).toBe("OUTSIDE");
    expect(result.nearMiss).toBe(false);
  });

  it("never guesses without a position", () => {
    const result = assessLocation(site, null);
    expect(result.result).toBe("UNKNOWN");
    expect(result.distanceMeters).toBeNull();
  });

  it("returns UNKNOWN when no site is paired", () => {
    expect(assessLocation(null, { latitude: 0, longitude: 0 }).result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for an unusable geo-fence", () => {
    expect(
      assessLocation({ latitude: 0, longitude: 0, radiusMeters: 0 }, { latitude: 0, longitude: 0 })
        .result
    ).toBe("UNKNOWN");
  });

  it("returns UNKNOWN for implausible or missing coordinates", () => {
    expect(assessLocation(site, { latitude: 95, longitude: 0 }).result).toBe("UNKNOWN");
    expect(assessLocation(site, { latitude: 0, longitude: 190 }).result).toBe("UNKNOWN");
    expect(assessLocation(site, { longitude: 0 }).result).toBe("UNKNOWN");
  });

  it("treats poor accuracy as UNKNOWN, never OUTSIDE", () => {
    expect(assessLocation(site, { latitude: 0, longitude: 0, accuracyMeters: 0 }).result).toBe(
      "UNKNOWN"
    );
    expect(
      assessLocation(site, { latitude: 0, longitude: 0, accuracyMeters: LOCATION_ACCURACY_MAX_METERS + 1 })
        .result
    ).toBe("UNKNOWN");
    // Exactly the ceiling is still plausible.
    expect(
      assessLocation(site, { latitude: 0, longitude: 0, accuracyMeters: LOCATION_ACCURACY_MAX_METERS })
        .result
    ).toBe("INSIDE");
  });

  it("treats a stale capture as UNKNOWN", () => {
    const stale = new Date(Date.now() - LOCATION_STALENESS_MS - 1000);
    expect(assessLocation(site, { latitude: 0, longitude: 0, capturedAt: stale }).result).toBe(
      "UNKNOWN"
    );
    const fresh = new Date(Date.now() - 1000);
    expect(assessLocation(site, { latitude: 0, longitude: 0, capturedAt: fresh }).result).toBe(
      "INSIDE"
    );
  });

  it("returns UNKNOWN for a future or unparseable capture time", () => {
    expect(
      assessLocation(site, { latitude: 0, longitude: 0, capturedAt: new Date(Date.now() + 5000) })
        .result
    ).toBe("UNKNOWN");
    expect(
      assessLocation(site, { latitude: 0, longitude: 0, capturedAt: "not-a-date" }).result
    ).toBe("UNKNOWN");
  });

  it("computes a symmetric great-circle distance", () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 0.01 };
    expect(haversineDistanceMeters(a, a)).toBeCloseTo(0, 6);
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(haversineDistanceMeters(b, a), 6);
    // ~1113 m for 0.01 degrees of longitude at the equator.
    expect(haversineDistanceMeters(a, b)).toBeGreaterThan(1100);
    expect(haversineDistanceMeters(a, b)).toBeLessThan(1120);
  });
});

describe("tenant.callerBusinessId", () => {
  let staffId: string;
  let staffBusinessId: string;

  beforeAll(async () => {
    await ensureTestAccounts();
    const staff = await prisma.user.findUnique({
      where: { email: STAFF_EMAIL },
      select: { id: true, businessId: true },
    });
    if (!staff) throw new Error("Test staff account missing");
    staffId = staff.id;
    staffBusinessId = staff.businessId;
  });

  it("resolves the caller's own business", async () => {
    await expect(callerBusinessId(staffId)).resolves.toBe(staffBusinessId);
  });

  it("returns null for an account that does not exist", async () => {
    await expect(
      callerBusinessId("00000000-0000-0000-0000-0000000000ff")
    ).resolves.toBeNull();
  });
});

describe("auditWriter.writeAudit", () => {
  const ACTION = "m9.test.audit_writer";
  let businessId: string;
  let userId: string;

  beforeAll(async () => {
    await ensureTestAccounts();
    const staff = await prisma.user.findUnique({
      where: { email: STAFF_EMAIL },
      select: { id: true, businessId: true },
    });
    if (!staff) throw new Error("Test staff account missing");
    userId = staff.id;
    businessId = staff.businessId;
  });

  // No cleanup: `audit_logs` is append-only by database trigger, so a durable
  // audit row is exactly what the endpoint is supposed to leave behind.

  it("derives USER as the actor for a user action", async () => {
    await writeAudit({
      businessId,
      action: ACTION,
      entityType: "test",
      entityId: "user-actor",
      userId,
      reason: "user actor",
    });
    const row = await prisma.auditLog.findFirst({ where: { action: ACTION, entityId: "user-actor" } });
    expect(row?.actorType).toBe("USER");
    expect(row?.actorUserId).toBe(userId);
    expect(row?.reason).toBe("user actor");
  });

  it("derives KIOSK as the actor whenever a kiosk id rides the entry", async () => {
    await writeAudit({
      businessId,
      action: ACTION,
      entityType: "test",
      entityId: "kiosk-actor",
      kioskId: "kiosk-m9-test",
    });
    const row = await prisma.auditLog.findFirst({ where: { action: ACTION, entityId: "kiosk-actor" } });
    expect(row?.actorType).toBe("KIOSK");
    expect(row?.actorKioskId).toBe("kiosk-m9-test");
  });

  it("honours the explicit SYSTEM override for background rows", async () => {
    await writeAudit({
      businessId,
      action: ACTION,
      entityType: "test",
      entityId: "system-actor",
      userId,
      actorType: "SYSTEM",
    });
    const row = await prisma.auditLog.findFirst({ where: { action: ACTION, entityId: "system-actor" } });
    expect(row?.actorType).toBe("SYSTEM");
  });

  it("persists the optional before/after JSON snapshots", async () => {
    await writeAudit({
      businessId,
      action: ACTION,
      entityType: "test",
      entityId: "snapshots",
      userId,
      beforeValues: { value: "before" },
      afterValues: { value: "after" },
    });
    const row = await prisma.auditLog.findFirst({ where: { action: ACTION, entityId: "snapshots" } });
    expect(row?.beforeValues).toEqual({ value: "before" });
    expect(row?.afterValues).toEqual({ value: "after" });
  });

  it("leaves reason null when the caller omits it", async () => {
    await writeAudit({
      businessId,
      action: ACTION,
      entityType: "test",
      entityId: "no-reason",
      userId,
    });
    const row = await prisma.auditLog.findFirst({ where: { action: ACTION, entityId: "no-reason" } });
    expect(row?.reason).toBeNull();
  });
});
