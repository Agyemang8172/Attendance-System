import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import app from "../server.js";
import prisma from "../config/prismaClient.js";
import { businessDateAt, businessDateStart, nextBusinessDate } from "../utils/assignmentDates.js";

// Every row belongs to a disposable tenant. Audit entries are append-only, so
// its business is deliberately retained while all deletable fixture rows are removed.
const tag = randomUUID();
const zone = "America/New_York";
const reason = (label: string) => `P11 lifecycle ${tag} ${label}`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let businessId: string;
let actorId: string;
let employeeId: string;
let token: string;
let shifts: string[] = [];
let assignmentIds: string[] = [];

const day = (offset: number) => {
  let date = businessDateAt(new Date(), zone);
  for (let n = 0; n < offset; n++) date = nextBusinessDate(date);
  return date;
};
const yesterday = () => new Date(Date.parse(`${day(0)}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
const createShift = async (active = true): Promise<string> => {
  const shift = await prisma.shift.create({ data: { businessId, name: `P11 ${tag} ${shifts.length}`,
    startMinute: 480, endMinute: 1020, startTime: "08:00", endTime: "17:00", isActive: active } });
  shifts.push(shift.id);
  return shift.id;
};
const createEmployee = async (active = true, tenantId = businessId): Promise<string> => {
  const employee = await prisma.user.create({ data: { businessId: tenantId, employeeCode: `P11-${randomUUID().slice(0, 12)}`,
    firstName: "Lifecycle", lastName: "Tester", email: `p11-${randomUUID()}@test.attendpro.local`,
    password: await bcrypt.hash("devos123", 4), role: "STAFF", isActive: active, mustChangePassword: false } });
  return employee.id;
};
const post = async (shiftId: string, employee: string, date: string, why: string) => {
  const response = await request(app).post(`/api/business/shifts/${shiftId}/assignments`).set(auth(token))
    .send({ employeeId: employee, effectiveFrom: date, reason: why });
  if (response.status === 201) assignmentIds.push(response.body.data.id);
  return response;
};
const patch = async (id: string, data: Record<string, unknown>) => {
  const response = await request(app).patch(`/api/business/assignments/${id}`).set(auth(token)).send(data);
  if (response.status === 200) assignmentIds.push(response.body.data.id);
  return response;
};
const cancel = (id: string, why: string) => request(app).delete(`/api/business/assignments/${id}`)
  .set(auth(token)).send({ reason: why });
const stored = (id: string) => prisma.shiftAssignment.findUniqueOrThrow({ where: { id } });
const auditFor = (why: string) => prisma.auditLog.findMany({ where: { businessId, reason: why } });

beforeAll(async () => {
  const business = await prisma.business.create({ data: { slug: `p11-${tag}`, name: `P11 lifecycle ${tag}`, timezone: zone } });
  businessId = business.id;
  const admin = await prisma.user.create({ data: { businessId, employeeCode: `P11A-${tag.slice(0, 10)}`,
    firstName: "Lifecycle", lastName: "Admin", email: `p11-admin-${tag}@test.attendpro.local`,
    password: await bcrypt.hash("devos123", 4), role: "SUPERADMIN", mustChangePassword: false } });
  actorId = admin.id;
  employeeId = await createEmployee();
  const login = await request(app).post("/api/auth/login").send({ email: admin.email, password: "devos123" });
  expect(login.status).toBe(200);
  token = login.body.token;
});

afterAll(async () => {
  // Never remove audit evidence. All deletes below are restricted to this run's tenant.
  if (!businessId) return;
  await prisma.shiftAssignment.deleteMany({ where: { businessId } });
  await prisma.user.updateMany({ where: { businessId }, data: { shiftId: null } });
  await prisma.shift.deleteMany({ where: { businessId } });
  // The append-only audit trigger also forbids ON DELETE SET NULL of the actor.
  // Keep the test actor as durable audit provenance; remove only disposable staff.
  await prisma.user.deleteMany({ where: { businessId, id: { not: actorId } } });
  await prisma.user.update({ where: { id: actorId }, data: { isActive: false } });
});

describe("assignment lifecycle on isolated PostgreSQL", () => {
  it("starts a future row at business midnight without moving the compatibility pointer", async () => {
    const shift = await createShift();
    const why = reason("future create");
    const created = await post(shift, employeeId, day(5), why);
    expect(created.status).toBe(201);
    expect(created.body.data.effectiveFrom).toBe(businessDateStart(day(5), zone).toISOString());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employeeId } })).shiftId).toBeNull();
    expect(await auditFor(why)).toEqual([expect.objectContaining({ action: "assignment.created",
      actorUserId: actorId, reason: why, entityId: created.body.data.id })]);
  });

  it("uses the transaction instant for today and moves the pointer", async () => {
    const employee = await createEmployee();
    const shift = await createShift();
    const before = new Date();
    const created = await post(shift, employee, day(0), reason("today create"));
    expect(created.status).toBe(201);
    expect(new Date(created.body.data.effectiveFrom).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(new Date(created.body.data.effectiveFrom).getTime()).toBeLessThanOrEqual(Date.now());
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(shift);
    expect((await post(shift, employee, yesterday(), reason("past"))).status).toBe(400);
  });

  it("replaces a current period without rewriting its start or moving the pointer for a future change", async () => {
    const employee = await createEmployee();
    const firstShift = await createShift();
    const nextShift = await createShift();
    const first = await post(firstShift, employee, day(0), reason("initial current"));
    expect(first.status).toBe(201);
    const before = await stored(first.body.data.id);
    const why = reason("replace later");
    const next = await post(nextShift, employee, day(7), why);
    expect(next.status).toBe(201);
    expect((await stored(before.id)).effectiveFrom).toEqual(before.effectiveFrom);
    expect((await stored(before.id)).effectiveTo).toEqual(businessDateStart(day(7), zone));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(firstShift);
    const list = await request(app).get(`/api/business/assignments?employeeId=${employee}`).set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.data.find((row: { id: string }) => row.id === before.id).status).toBe("CURRENT");
    expect(list.body.data.find((row: { id: string }) => row.id === next.body.data.id).status).toBe("FUTURE");
    expect(await auditFor(why)).toEqual([expect.objectContaining({ action: "assignment.replaced", actorUserId: actorId, reason: why })]);
  });

  it("cancels a future tail into [F,F), restores its predecessor and excludes it from CURRENT", async () => {
    const employee = await createEmployee();
    const first = await post(await createShift(), employee, day(0), reason("tail first"));
    const future = await post(await createShift(), employee, day(9), reason("tail future"));
    expect(first.status).toBe(201);
    expect(future.status).toBe(201);
    const why = reason("cancel tail");
    expect((await cancel(future.body.data.id, why)).status).toBe(200);
    const cancelled = await stored(future.body.data.id);
    expect(cancelled.effectiveTo).toEqual(cancelled.effectiveFrom);
    expect((await stored(first.body.data.id)).effectiveTo).toBeNull();
    expect(await auditFor(why)).toEqual([expect.objectContaining({ afterValues: expect.objectContaining({
      restoredPredecessorId: first.body.data.id, restoredUntil: null,
      restoredPredecessor: {
        before: expect.objectContaining({ id: first.body.data.id, effectiveTo: cancelled.effectiveFrom.toISOString() }),
        after: expect.objectContaining({ id: first.body.data.id, effectiveTo: null }),
      }, now: expect.any(String),
    }) })]);
    const current = await request(app).get(`/api/business/assignments?employeeId=${employee}&status=CURRENT`).set(auth(token));
    expect(current.status).toBe(200);
    expect(current.body.data.map((row: { id: string }) => row.id)).toEqual([first.body.data.id]);
    const staff = await prisma.user.findUniqueOrThrow({ where: { id: employee }, select: { email: true } });
    const login = await request(app).post("/api/auth/login").send({ email: staff.email, password: "devos123" });
    expect(login.status).toBe(200);
    const schedule = await request(app).get(`/api/staff/schedule?startDate=${day(9)}&endDate=${day(9)}`)
      .set(auth(login.body.token));
    expect(schedule.status).toBe(200);
    expect(schedule.body.data.map((row: { id: string }) => row.id)).toEqual([first.body.data.id]);
    expect(await auditFor(why)).toEqual([expect.objectContaining({ action: "assignment.cancelled", actorUserId: actorId, reason: why })]);
  });

  it("deactivates a current assignment and cancels its future row in one durable audit", async () => {
    const employee = await createEmployee();
    const currentShift = await createShift();
    const futureShift = await createShift();
    const current = await post(currentShift, employee, day(0), reason("deactivate initial"));
    const future = await post(futureShift, employee, day(10), reason("deactivate future"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const beforeCurrent = await stored(current.body.data.id);
    const beforeFuture = await stored(future.body.data.id);
    const why = reason("deactivate current and future");
    const closed = await cancel(beforeCurrent.id, why);
    expect(closed.status).toBe(200);
    const afterCurrent = await stored(beforeCurrent.id);
    const afterFuture = await stored(beforeFuture.id);
    expect(afterCurrent.effectiveTo!.getTime()).toBeGreaterThanOrEqual(beforeCurrent.effectiveFrom.getTime());
    expect(afterCurrent.effectiveTo!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(afterFuture.effectiveFrom).toEqual(beforeFuture.effectiveFrom);
    expect(afterFuture.effectiveTo).toEqual(beforeFuture.effectiveFrom);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBeNull();
    expect(await auditFor(why)).toEqual([expect.objectContaining({
      action: "assignment.deactivated", actorUserId: actorId, entityId: beforeCurrent.id,
      beforeValues: { id: beforeCurrent.id, employeeId: employee, shiftId: currentShift,
        effectiveFrom: beforeCurrent.effectiveFrom.toISOString(), effectiveTo: beforeCurrent.effectiveTo!.toISOString() },
      afterValues: { closed: { id: beforeCurrent.id, employeeId: employee, shiftId: currentShift,
        effectiveFrom: beforeCurrent.effectiveFrom.toISOString(), effectiveTo: afterCurrent.effectiveTo!.toISOString() },
      cancelledFuture: [{
        before: { id: beforeFuture.id, employeeId: employee, shiftId: futureShift,
          effectiveFrom: beforeFuture.effectiveFrom.toISOString(), effectiveTo: null },
        after: { id: beforeFuture.id, employeeId: employee, shiftId: futureShift,
          effectiveFrom: beforeFuture.effectiveFrom.toISOString(), effectiveTo: beforeFuture.effectiveFrom.toISOString() },
      }] },
    })]);
  });

  it("PUT account deactivation closes current and future assignments, clears the pointer and audits both changes", async () => {
    const employee = await createEmployee();
    const currentShift = await createShift();
    const futureShift = await createShift();
    const current = await post(currentShift, employee, day(0), reason("PUT current"));
    const future = await post(futureShift, employee, day(10), reason("PUT future"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const beforeCurrent = await stored(current.body.data.id);
    const beforeFuture = await stored(future.body.data.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(currentShift);
    const auditCount = await prisma.auditLog.count({ where: { businessId } });
    const started = new Date();
    const response = await request(app).put(`/api/users/${employee}`).set(auth(token)).send({ isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
    const closed = await stored(beforeCurrent.id);
    const cancelled = await stored(beforeFuture.id);
    expect(closed.effectiveFrom).toEqual(beforeCurrent.effectiveFrom);
    expect(closed.effectiveTo!.getTime()).toBeGreaterThanOrEqual(started.getTime());
    expect(closed.effectiveTo!.getTime()).toBeLessThanOrEqual(Date.now());
    expect(cancelled.effectiveFrom).toEqual(beforeFuture.effectiveFrom);
    expect(cancelled.effectiveTo).toEqual(beforeFuture.effectiveFrom);
    const account = await prisma.user.findUniqueOrThrow({ where: { id: employee } });
    expect(account.isActive).toBe(false);
    expect(account.shiftId).toBeNull();
    const audits = await prisma.auditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 2 });
    expect(await prisma.auditLog.count({ where: { businessId } })).toBe(auditCount + 2);
    expect(audits).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "user.updated", actorUserId: actorId, entityId: employee }),
      expect.objectContaining({ action: "assignment.deactivated", actorUserId: actorId, entityId: beforeCurrent.id,
        reason: "Employee account deactivated",
        beforeValues: { assignments: [
          { id: beforeCurrent.id, employeeId: employee, shiftId: currentShift,
            effectiveFrom: beforeCurrent.effectiveFrom.toISOString(), effectiveTo: beforeCurrent.effectiveTo!.toISOString() },
          { id: beforeFuture.id, employeeId: employee, shiftId: futureShift,
            effectiveFrom: beforeFuture.effectiveFrom.toISOString(), effectiveTo: null },
        ] },
        afterValues: { now: closed.effectiveTo!.toISOString(), assignments: [
          { id: closed.id, employeeId: employee, shiftId: currentShift,
            effectiveFrom: closed.effectiveFrom.toISOString(), effectiveTo: closed.effectiveTo!.toISOString() },
          { id: cancelled.id, employeeId: employee, shiftId: futureShift,
            effectiveFrom: cancelled.effectiveFrom.toISOString(), effectiveTo: cancelled.effectiveTo!.toISOString() },
        ] },
      }),
    ]));
  });

  it("DELETE after completed current and future grants closes both and audits the target employee", async () => {
    const employee = await createEmployee();
    const currentShift = await createShift();
    const futureShift = await createShift();
    const current = await post(currentShift, employee, day(0), reason("DELETE current"));
    const future = await post(futureShift, employee, day(10), reason("DELETE future"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const beforeCurrent = await stored(current.body.data.id);
    const beforeFuture = await stored(future.body.data.id);
    expect(beforeCurrent.effectiveTo).toEqual(beforeFuture.effectiveFrom);
    expect(beforeFuture.effectiveTo).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(currentShift);

    const started = new Date();
    const response = await request(app).delete(`/api/users/${employee}`).set(auth(token));
    const completed = new Date();
    expect(response.status).toBe(200);
    const account = await prisma.user.findUniqueOrThrow({ where: { id: employee } });
    const closed = await stored(beforeCurrent.id);
    const cancelled = await stored(beforeFuture.id);
    expect(account.isActive).toBe(false);
    expect(account.shiftId).toBeNull();
    expect(closed.effectiveFrom).toEqual(beforeCurrent.effectiveFrom);
    expect(closed.effectiveTo!.getTime()).toBeGreaterThanOrEqual(started.getTime());
    expect(closed.effectiveTo!.getTime()).toBeLessThanOrEqual(completed.getTime());
    expect(cancelled.effectiveFrom).toEqual(beforeFuture.effectiveFrom);
    expect(cancelled.effectiveTo).toEqual(beforeFuture.effectiveFrom);

    const assignmentAudits = await prisma.auditLog.findMany({ where: {
      businessId, action: "assignment.deactivated", entityId: beforeCurrent.id,
    } });
    const userAudits = await prisma.auditLog.findMany({ where: {
      businessId, action: "user.deactivated", entityId: employee,
    } });
    const snapshot = (row: typeof beforeCurrent) => ({ id: row.id, employeeId: employee, shiftId: row.shiftId,
      effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null });
    expect(assignmentAudits).toEqual([expect.objectContaining({
      actorUserId: actorId, entityType: "assignment", reason: "Employee account deactivated",
      beforeValues: { assignments: [snapshot(beforeCurrent), snapshot(beforeFuture)] },
      afterValues: { now: closed.effectiveTo!.toISOString(), assignments: [snapshot(closed), snapshot(cancelled)] },
    })]);
    expect(userAudits).toEqual([expect.objectContaining({ actorUserId: actorId, entityType: "user" })]);
  });

  it("rolls back PUT account deactivation when its assignment audit insert fails", async () => {
    const employee = await createEmployee();
    const currentShift = await createShift();
    const current = await post(currentShift, employee, day(0), reason("PUT rollback current"));
    const future = await post(await createShift(), employee, day(10), reason("PUT rollback future"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const before = await prisma.shiftAssignment.findMany({ where: { businessId, userId: employee }, orderBy: { effectiveFrom: "asc" } });
    const account = await prisma.user.findUniqueOrThrow({ where: { id: employee } });
    expect(account.shiftId).toBe(currentShift);
    const auditCount = await prisma.auditLog.count({ where: { businessId } });
    const name = `p11_account_fail_${randomUUID().replace(/-/g, "")}`;
    // Isolated test database only; fail just this account's assignment audit.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.business_id = TG_ARGV[0] AND NEW.action = 'assignment.deactivated'
        AND NEW.entity_id = TG_ARGV[1] THEN RAISE EXCEPTION 'P11 account audit injection'; END IF;
        RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION "${name}"('${businessId}', '${current.body.data.id}')`);
      const refused = await request(app).put(`/api/users/${employee}`).set(auth(token)).send({ isActive: false });
      expect(refused.status).toBe(500);
      expect(refused.body).toEqual({ success: false, message: "Server error" });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: employee } })).toEqual(account);
      expect(await prisma.shiftAssignment.findMany({ where: { businessId, userId: employee }, orderBy: { effectiveFrom: "asc" } })).toEqual(before);
      expect(await prisma.auditLog.count({ where: { businessId } })).toBe(auditCount);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON audit_logs`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
  });

  it("restores only the predecessor-to-successor boundary when cancelling a middle future link", async () => {
    const employee = await createEmployee();
    const a = await post(await createShift(), employee, day(0), reason("middle predecessor"));
    expect(a.status).toBe(201);
    const middleStart = businessDateStart(day(6), zone);
    const successorStart = businessDateStart(day(12), zone);
    await prisma.shiftAssignment.update({ where: { id: a.body.data.id }, data: { effectiveTo: middleStart } });
    const middle = await prisma.shiftAssignment.create({ data: { businessId, userId: employee,
      shiftId: await createShift(), assignedByUserId: actorId, effectiveFrom: middleStart, effectiveTo: successorStart } });
    assignmentIds.push(middle.id);
    const successor = await prisma.shiftAssignment.create({ data: { businessId, userId: employee,
      shiftId: await createShift(), assignedByUserId: actorId, effectiveFrom: successorStart } });
    assignmentIds.push(successor.id);
    expect((await cancel(middle.id, reason("middle cancellation"))).status).toBe(200);
    expect((await stored(middle.id)).effectiveTo).toEqual(middleStart);
    expect((await stored(a.body.data.id)).effectiveTo).toEqual(successorStart);
    expect((await stored(successor.id)).effectiveTo).toBeNull();
  });

  it("appends a later future successor without moving today's pointer", async () => {
    const employee = await createEmployee();
    const firstShift = await createShift();
    const secondShift = await createShift();
    const first = await post(firstShift, employee, day(8), reason("future first"));
    expect(first.status).toBe(201);
    const second = await post(secondShift, employee, day(16), reason("future successor"));
    expect(second.status).toBe(201);
    expect((await stored(first.body.data.id)).effectiveTo).toEqual(businessDateStart(day(16), zone));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBeNull();
  });

  it("creates a new assignment after an ended period without replacing that period", async () => {
    const employee = await createEmployee();
    const first = await post(await createShift(), employee, day(0), reason("ended first"));
    expect(first.status).toBe(201);
    expect((await cancel(first.body.data.id, reason("ended close"))).status).toBe(200);
    const completed = await stored(first.body.data.id);
    const why = reason("created after completion");
    const next = await post(await createShift(), employee, day(8), why);
    expect(next.status).toBe(201);
    expect(await stored(completed.id)).toEqual(completed);
    expect(await auditFor(why)).toEqual([expect.objectContaining({
      action: "assignment.created", entityId: next.body.data.id, actorUserId: actorId, reason: why,
    })]);
  });

  it("cancels a future row after a completed predecessor without claiming to restore it", async () => {
    const employee = await createEmployee();
    const first = await post(await createShift(), employee, day(0), reason("completed predecessor"));
    expect(first.status).toBe(201);
    expect((await cancel(first.body.data.id, reason("complete predecessor"))).status).toBe(200);
    const completed = await stored(first.body.data.id);
    const future = await post(await createShift(), employee, day(8), reason("after completed predecessor"));
    expect(future.status).toBe(201);
    const why = reason("cancel after completion");
    expect((await cancel(future.body.data.id, why)).status).toBe(200);
    expect(await stored(completed.id)).toEqual(completed);
    expect((await stored(future.body.data.id)).effectiveTo).toEqual(businessDateStart(day(8), zone));
    expect(await auditFor(why)).toEqual([expect.objectContaining({
      action: "assignment.cancelled", actorUserId: actorId, entityId: future.body.data.id,
      beforeValues: expect.objectContaining({ id: future.body.data.id, effectiveTo: null }),
      afterValues: expect.objectContaining({
        cancelled: expect.objectContaining({ id: future.body.data.id,
          effectiveTo: businessDateStart(day(8), zone).toISOString() }),
        restoredPredecessorId: null, restoredUntil: null, restoredPredecessor: null,
        now: expect.any(String),
      }),
    })]);
  });

  it("extends and shortens a contiguous predecessor for future amendments without moving today's pointer", async () => {
    const employee = await createEmployee();
    const currentShift = await createShift();
    const futureShift = await createShift();
    const current = await post(currentShift, employee, day(0), reason("amend current"));
    const future = await post(futureShift, employee, day(12), reason("amend future"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const beforeCurrent = await stored(current.body.data.id);
    const beforeFuture = await stored(future.body.data.id);
    expect((await patch(current.body.data.id, { effectiveFrom: day(14), reason: reason("current edit") })).status).toBe(400);
    const forwardReason = reason("amend forward");
    const forward = await patch(future.body.data.id, { effectiveFrom: day(14), reason: forwardReason });
    expect(forward.status).toBe(200);
    const afterForward = await stored(current.body.data.id);
    const cancelledFuture = await stored(beforeFuture.id);
    const forwardSuccessor = await stored(forward.body.data.id);
    expect(afterForward.effectiveFrom).toEqual(beforeCurrent.effectiveFrom);
    expect(afterForward.effectiveTo).toEqual(businessDateStart(day(14), zone));
    expect(cancelledFuture.effectiveTo).toEqual(beforeFuture.effectiveFrom);
    expect(forwardSuccessor.effectiveFrom).toEqual(afterForward.effectiveTo);
    expect(forwardSuccessor.effectiveTo).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(currentShift);
    const currentInOldGap = await request(app).get(`/api/business/assignments?employeeId=${employee}&status=CURRENT`).set(auth(token));
    expect(currentInOldGap.status).toBe(200);
    expect(currentInOldGap.body.data.map((row: { id: string }) => row.id)).toEqual([beforeCurrent.id]);
    const staff = await prisma.user.findUniqueOrThrow({ where: { id: employee }, select: { email: true } });
    const login = await request(app).post("/api/auth/login").send({ email: staff.email, password: "devos123" });
    expect(login.status).toBe(200);
    const throughOldGap = await request(app).get(`/api/staff/schedule?startDate=${day(12)}&endDate=${day(13)}`)
      .set(auth(login.body.token));
    expect(throughOldGap.status).toBe(200);
    expect(throughOldGap.body.data.map((row: { id: string }) => row.id)).toEqual([beforeCurrent.id]);
    expect(await auditFor(forwardReason)).toEqual([expect.objectContaining({
      action: "assignment.rescheduled", actorUserId: actorId, entityId: forwardSuccessor.id, reason: forwardReason,
      beforeValues: {
        target: { id: beforeFuture.id, employeeId: employee, shiftId: futureShift,
          effectiveFrom: beforeFuture.effectiveFrom.toISOString(), effectiveTo: null },
        predecessor: { id: beforeCurrent.id, employeeId: employee, shiftId: currentShift,
          effectiveFrom: beforeCurrent.effectiveFrom.toISOString(), effectiveTo: beforeCurrent.effectiveTo!.toISOString() },
      },
      afterValues: {
        target: { id: cancelledFuture.id, employeeId: employee, shiftId: futureShift,
          effectiveFrom: cancelledFuture.effectiveFrom.toISOString(), effectiveTo: cancelledFuture.effectiveTo!.toISOString() },
        predecessor: { id: afterForward.id, employeeId: employee, shiftId: currentShift,
          effectiveFrom: afterForward.effectiveFrom.toISOString(), effectiveTo: afterForward.effectiveTo!.toISOString() },
        successor: { id: forwardSuccessor.id, employeeId: employee, shiftId: futureShift,
          effectiveFrom: forwardSuccessor.effectiveFrom.toISOString(), effectiveTo: null },
      },
    })]);
    const backwardReason = reason("amend backward");
    const backward = await patch(forwardSuccessor.id, { effectiveFrom: day(13), reason: backwardReason });
    expect(backward.status).toBe(200);
    const afterBackward = await stored(beforeCurrent.id);
    const backwardSuccessor = await stored(backward.body.data.id);
    expect(afterBackward.effectiveFrom).toEqual(beforeCurrent.effectiveFrom);
    expect(afterBackward.effectiveTo).toEqual(businessDateStart(day(13), zone));
    expect((await stored(forwardSuccessor.id)).effectiveTo).toEqual(forwardSuccessor.effectiveFrom);
    expect(backwardSuccessor.effectiveFrom).toEqual(afterBackward.effectiveTo);
    expect(backwardSuccessor.effectiveTo).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(currentShift);
    expect(await auditFor(backwardReason)).toEqual([expect.objectContaining({
      action: "assignment.rescheduled", beforeValues: expect.objectContaining({
        predecessor: expect.objectContaining({ id: beforeCurrent.id, effectiveTo: afterForward.effectiveTo!.toISOString() }),
        target: expect.objectContaining({ id: forwardSuccessor.id, effectiveTo: null }),
      }),
      afterValues: expect.objectContaining({
        predecessor: expect.objectContaining({ id: beforeCurrent.id, effectiveTo: afterBackward.effectiveTo!.toISOString() }),
        target: expect.objectContaining({ id: forwardSuccessor.id, effectiveTo: forwardSuccessor.effectiveFrom.toISOString() }),
        successor: expect.objectContaining({ id: backwardSuccessor.id, effectiveFrom: backwardSuccessor.effectiveFrom.toISOString() }),
      }),
    })]);
    expect((await patch(backward.body.data.id, { effectiveFrom: day(0), reason: reason("overlap") })).status).toBe(400);
  });

  it("keeps an unscheduled gap when future history has no contiguous predecessor", async () => {
    const employee = await createEmployee();
    const oldShift = await createShift();
    const first = await post(oldShift, employee, day(0), reason("gap first"));
    expect(first.status).toBe(201);
    expect((await cancel(first.body.data.id, reason("gap close"))).status).toBe(200);
    const completed = await stored(first.body.data.id);
    const future = await post(await createShift(), employee, day(12), reason("gap future"));
    expect(future.status).toBe(201);
    // Simulate a legacy pointer lagging behind the dated history; it must not fill the gap.
    await prisma.user.update({ where: { id: employee }, data: { shiftId: oldShift } });
    const why = reason("gap amendment");
    const moved = await patch(future.body.data.id, { effectiveFrom: day(14), reason: why });
    expect(moved.status).toBe(200);
    expect(await stored(completed.id)).toEqual(completed);
    expect((await stored(future.body.data.id)).effectiveTo).toEqual(businessDateStart(day(12), zone));
    expect((await stored(moved.body.data.id)).effectiveFrom).toEqual(businessDateStart(day(14), zone));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(oldShift);
    const current = await request(app).get(`/api/business/assignments?employeeId=${employee}&status=CURRENT`).set(auth(token));
    expect(current.status).toBe(200);
    expect(current.body.data).toEqual([]);
    const staff = await prisma.user.findUniqueOrThrow({ where: { id: employee }, select: { email: true } });
    const login = await request(app).post("/api/auth/login").send({ email: staff.email, password: "devos123" });
    expect(login.status).toBe(200);
    const schedule = await request(app).get(`/api/staff/schedule?startDate=${day(13)}&endDate=${day(13)}`)
      .set(auth(login.body.token));
    expect(schedule.status).toBe(200);
    expect(schedule.body.data).toEqual([]);
    expect(await auditFor(why)).toEqual([expect.objectContaining({
      action: "assignment.rescheduled", beforeValues: { target: expect.objectContaining({ id: future.body.data.id }) },
      afterValues: { target: expect.objectContaining({ id: future.body.data.id }),
        successor: expect.objectContaining({ id: moved.body.data.id }) },
    })]);
  });

  it("reschedules a middle future row without overlapping or moving its later successor", async () => {
    const employee = await createEmployee();
    const first = await post(await createShift(), employee, day(0), reason("amend middle first"));
    const middle = await post(await createShift(), employee, day(12), reason("amend middle target"));
    expect(first.status).toBe(201);
    expect(middle.status).toBe(201);
    const successorStart = businessDateStart(day(20), zone);
    await prisma.shiftAssignment.update({ where: { id: middle.body.data.id }, data: { effectiveTo: successorStart } });
    const successor = await prisma.shiftAssignment.create({ data: { businessId, userId: employee,
      shiftId: await createShift(), assignedByUserId: actorId, effectiveFrom: successorStart } });
    assignmentIds.push(successor.id);
    const moved = await patch(middle.body.data.id, { effectiveFrom: day(14), reason: reason("amend middle forward") });
    expect(moved.status).toBe(200);
    expect((await stored(first.body.data.id)).effectiveTo).toEqual(businessDateStart(day(14), zone));
    expect((await stored(middle.body.data.id)).effectiveTo).toEqual(businessDateStart(day(12), zone));
    expect((await stored(moved.body.data.id)).effectiveTo).toEqual(successorStart);
    expect((await stored(successor.id)).effectiveFrom).toEqual(successorStart);
    expect((await stored(successor.id)).effectiveTo).toBeNull();
    expect((await patch(moved.body.data.id, { effectiveFrom: day(20), reason: reason("amend into successor") })).status).toBe(409);
  });

  it("serializes two competing writes into one success and one conflict", async () => {
    const employee = await createEmployee();
    const shift = await createShift();
    const [left, right] = await Promise.all([
      post(shift, employee, day(18), reason("race left")),
      post(shift, employee, day(18), reason("race right")),
    ]);
    expect([left.status, right.status].sort()).toEqual([201, 409]);
    expect(await prisma.shiftAssignment.count({ where: { businessId, userId: employee } })).toBe(1);
  });

  it("maps a real exclusion violation after the HTTP precheck to a safe conflict and rolls back", async () => {
    const employee = await createEmployee();
    const shift = await createShift();
    const why = reason("database exclusion race");
    const name = `p11_exclude_${randomUUID().replace(/-/g, "")}`;
    // The recursive insert creates a finite conflicting interval only for this employee.
    // Both inserts roll back when the actual GiST exclusion constraint rejects the outer insert.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.user_id = TG_ARGV[0] AND pg_trigger_depth() = 1 THEN
          INSERT INTO shift_assignments (id, business_id, user_id, shift_id, effective_from, effective_to, assigned_by_user_id)
          VALUES (gen_random_uuid()::text, NEW.business_id, NEW.user_id, NEW.shift_id,
            NEW.effective_from, NEW.effective_from + interval '1 hour', NEW.assigned_by_user_id);
        END IF;
        RETURN NEW;
      END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON shift_assignments
        FOR EACH ROW EXECUTE FUNCTION "${name}"('${employee}')`);
      const refused = await post(shift, employee, day(28), why);
      expect(JSON.stringify(refused.body)).not.toMatch(/23P01|shift_assignments|constraint|index|INSERT INTO|tstzrange/i);
      expect(await prisma.shiftAssignment.count({ where: { businessId, userId: employee } })).toBe(0);
      expect(await auditFor(why)).toEqual([]);
      expect(refused.status).toBe(409);
      expect(refused.body).toEqual({ success: false, message: "Assignment conflicts with an existing period" });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON shift_assignments`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
  });

  it("rolls back a PATCH predecessor, target and successor when its audit insert fails", async () => {
    const employee = await createEmployee();
    const current = await post(await createShift(), employee, day(0), reason("patch rollback predecessor"));
    const future = await post(await createShift(), employee, day(10), reason("patch rollback target"));
    expect(current.status).toBe(201);
    expect(future.status).toBe(201);
    const before = await prisma.shiftAssignment.findMany({ where: { businessId, userId: employee }, orderBy: { effectiveFrom: "asc" } });
    const pointer = (await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId;
    const auditCount = await prisma.auditLog.count({ where: { businessId } });
    const why = reason("patch audit failure");
    const name = `p11_patch_fail_${randomUUID().replace(/-/g, "")}`;
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reason = TG_ARGV[0] AND NEW.business_id = TG_ARGV[1] THEN
        RAISE EXCEPTION 'P11 PATCH audit injection'; END IF;
        RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION "${name}"('${why}', '${businessId}')`);
      const refused = await patch(future.body.data.id, { effectiveFrom: day(12), reason: why });
      expect(refused.status).toBe(500);
      expect(refused.body).toEqual({ success: false, message: "Server error" });
      expect(await prisma.shiftAssignment.findMany({ where: { businessId, userId: employee }, orderBy: { effectiveFrom: "asc" } })).toEqual(before);
      expect(await stored(current.body.data.id)).toEqual(before[0]);
      expect(await stored(future.body.data.id)).toEqual(before[1]);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(pointer);
      expect(await prisma.auditLog.count({ where: { businessId } })).toBe(auditCount);
      expect(await auditFor(why)).toEqual([]);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON audit_logs`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
  });

  it("cannot PATCH another tenant's future assignment or alter its audit trail", async () => {
    const foreignBusiness = await prisma.business.create({ data: { slug: `p11-patch-${randomUUID()}`, name: `P11 foreign patch ${tag}` } });
    const foreignEmployee = await createEmployee(true, foreignBusiness.id);
    const foreignShift = await prisma.shift.create({ data: { businessId: foreignBusiness.id,
      name: `Foreign patch ${tag}`, startMinute: 480, endMinute: 1020, startTime: "08:00", endTime: "17:00" } });
    try {
      const target = await prisma.shiftAssignment.create({ data: { businessId: foreignBusiness.id,
        userId: foreignEmployee, shiftId: foreignShift.id, effectiveFrom: businessDateStart(day(20), "UTC") } });
      const auditCount = await prisma.auditLog.count({ where: { businessId: foreignBusiness.id } });
      const ownAuditCount = await prisma.auditLog.count({ where: { businessId } });
      const refused = await patch(target.id, { effectiveFrom: day(22), reason: reason("foreign patch") });
      expect([403, 404]).toContain(refused.status);
      expect(JSON.stringify(refused.body)).not.toMatch(/foreign patch|shift_assignments|SELECT|constraint/i);
      expect(await stored(target.id)).toEqual(target);
      expect(await prisma.shiftAssignment.count({ where: { businessId: foreignBusiness.id, userId: foreignEmployee } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { businessId: foreignBusiness.id } })).toBe(auditCount);
      expect(await prisma.auditLog.count({ where: { businessId } })).toBe(ownAuditCount);
    } finally {
      await prisma.shiftAssignment.deleteMany({ where: { businessId: foreignBusiness.id, userId: foreignEmployee } });
      await prisma.shift.delete({ where: { id: foreignShift.id } });
      await prisma.user.delete({ where: { id: foreignEmployee } });
      await prisma.business.delete({ where: { id: foreignBusiness.id } });
    }
  });

  it("does not leave an effective assignment after competing HTTP grant and deactivation", async () => {
    const shift = await createShift();
    for (const ordering of ["deactivation first", "grant first"] as const) {
      const employee = await createEmployee();
      const deleteCall = () => request(app).delete(`/api/users/${employee}`).set(auth(token)).timeout(8000).then((r) => r);
      const grantCall = () => request(app).post(`/api/business/shifts/${shift}/assignments`)
        .set(auth(token)).send({ employeeId: employee, effectiveFrom: day(0), reason: reason(`HTTP race ${ordering}`) })
        .timeout(8000).then((r) => { if (r.status === 201) assignmentIds.push(r.body.data.id); return r; });
      // Stagger the launches while keeping both HTTP calls in flight. Avoid a
      // synthetic business-row lock: it reverses normal lock order and deadlocks.
      const winner = ordering === "deactivation first" ? deleteCall() : grantCall();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const follower = ordering === "deactivation first" ? grantCall() : deleteCall();
      const [first, second] = await Promise.race([
        Promise.all([winner, follower]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("HTTP race timed out")), 10000)),
      ]);
      const [grant, deleted] = ordering === "grant first" ? [first, second] : [second, first];
      expect(deleted.status).toBe(200);
      expect([201, 404]).toContain(grant.status);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: employee } });
      expect(user.isActive).toBe(false);
      const rows = await prisma.shiftAssignment.findMany({ where: { businessId, userId: employee } });
      if (grant.status === 404) expect(rows).toEqual([]);
      expect(rows.every((row) => row.effectiveFrom <= user.updatedAt)).toBe(true);
      // A successful grant *before* deactivation is historical, but must be
      // closed at deactivation; it is not a post-deactivation grant.
      expect(rows.filter((row) => row.effectiveFrom <= new Date() &&
        (row.effectiveTo === null || row.effectiveTo > new Date()))).toEqual([]);
    }
  }, 30000);

  it("blocks a concurrent shift deactivation while PostgreSQL holds FOR SHARE", async () => {
    const shiftId = await createShift();
    let release!: () => void;
    let acquired!: () => void;
    const holding = new Promise<void>((resolve) => { release = resolve; });
    const locked = new Promise<void>((resolve) => { acquired = resolve; });
    const reader = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shifts WHERE business_id = ${businessId} AND id = ${shiftId} FOR SHARE`;
      acquired();
      await holding;
    });
    await locked;
    let updated = false;
    const writer = prisma.shift.update({ where: { id: shiftId }, data: { isActive: false } })
      .then(() => { updated = true; });
    try {
      // The attached .then starts the Prisma query while the row lock is held.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(updated).toBe(false);
    } finally {
      release();
      await Promise.all([reader, writer]);
    }
    expect(updated).toBe(true);
    expect((await prisma.shift.findUniqueOrThrow({ where: { id: shiftId } })).isActive).toBe(false);
  });

  it("blocks a concurrent employee deactivation while PostgreSQL holds FOR SHARE", async () => {
    const employee = await createEmployee();
    let release!: () => void;
    let acquired!: () => void;
    const holding = new Promise<void>((resolve) => { release = resolve; });
    const locked = new Promise<void>((resolve) => { acquired = resolve; });
    const reader = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE business_id = ${businessId} AND id = ${employee} FOR SHARE`;
      acquired();
      await holding;
    });
    await locked;
    let updated = false;
    const writer = prisma.user.update({ where: { id: employee }, data: { isActive: false } })
      .then(() => { updated = true; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(updated).toBe(false);
    } finally {
      release();
      await Promise.all([reader, writer]);
    }
    expect(updated).toBe(true);
    expect((await post(await createShift(), employee, day(22), reason("inactive after lock"))).status).toBe(404);
  });

  it("rolls back the predecessor close and pointer when its audit insert fails", async () => {
    const employee = await createEmployee();
    const initialShift = await createShift();
    const replacementShift = await createShift();
    const first = await post(initialShift, employee, day(0), reason("rollback initial"));
    expect(first.status).toBe(201);
    const prior = await stored(first.body.data.id);
    const why = reason("audit injection");
    const name = `p11_audit_fail_${tag.replace(/-/g, "")}`;
    // Isolated test database only; TG_ARGV scopes this trigger to one unique reason.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.reason = TG_ARGV[0] THEN RAISE EXCEPTION 'P11 audit injection'; END IF;
      RETURN NEW; END $$`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE INSERT ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION "${name}"('${why}')`);
      const refused = await post(replacementShift, employee, day(0), why);
      expect(refused.status).toBe(500);
      expect(await stored(prior.id)).toEqual(prior);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: employee } })).shiftId).toBe(initialShift);
      expect(await prisma.shiftAssignment.count({ where: { businessId, userId: employee } })).toBe(1);
      expect(await auditFor(why)).toEqual([]);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON audit_logs`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${name}"()`);
    }
  });

  it("refuses foreign and inactive employee/shift before writing rows", async () => {
    const shift = await createShift();
    const inactiveShift = await createShift(false);
    const inactiveEmployee = await createEmployee(false);
    expect((await post(inactiveShift, employeeId, day(25), reason("inactive shift"))).status).toBe(404);
    expect((await post(shift, inactiveEmployee, day(25), reason("inactive employee"))).status).toBe(404);
    const foreignBusiness = await prisma.business.create({ data: { slug: `p11-foreign-${tag}`, name: `P11 foreign ${tag}` } });
    try {
      const foreignId = await createEmployee(true, foreignBusiness.id);
      const foreignShift = await prisma.shift.create({ data: { businessId: foreignBusiness.id,
        name: `Foreign ${tag}`, startMinute: 480, endMinute: 1020, startTime: "08:00", endTime: "17:00" } });
      expect((await post(shift, foreignId, day(25), reason("foreign employee"))).status).toBe(404);
      expect((await post(foreignShift.id, employeeId, day(25), reason("foreign shift"))).status).toBe(404);
    } finally {
      await prisma.shift.deleteMany({ where: { businessId: foreignBusiness.id } });
      await prisma.user.deleteMany({ where: { businessId: foreignBusiness.id } });
      await prisma.business.delete({ where: { id: foreignBusiness.id } });
    }
    expect(await prisma.shiftAssignment.count({ where: { businessId, userId: inactiveEmployee } })).toBe(0);
  });
});

describe("business-date conversion at DST boundaries", () => {
  it("uses the earliest midnight on both sides of the New York spring and autumn transitions", () => {
    expect(businessDateStart("2026-03-08", zone).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(businessDateStart("2026-03-09", zone).toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(businessDateStart("2026-11-01", zone).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(businessDateStart("2026-11-02", zone).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
