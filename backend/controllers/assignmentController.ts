import { Request, Response } from "express";
import { Prisma } from "../generated/prisma/index.js";
import prisma from "../config/prismaClient.js";
import { auditLog } from "../utils/logger.js";
import { callerBusinessId } from "../utils/tenant.js";
import { businessDateAt, businessDateStart, nextBusinessDate } from "../utils/assignmentDates.js";

const assignmentSelect = {
  id: true, businessId: true, userId: true, shiftId: true, effectiveFrom: true,
  effectiveTo: true, assignedByUserId: true, createdAt: true,
} as const;
type Assignment = Prisma.ShiftAssignmentGetPayload<{ select: typeof assignmentSelect }>;
type Tx = Prisma.TransactionClient;

class Refusal extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const refuse = (status: number, message: string): never => { throw new Refusal(status, message); };
const nonempty = (row: Assignment): boolean => !row.effectiveTo || row.effectiveTo > row.effectiveFrom;
const overlap = (row: Assignment, start: Date, end: Date | null): boolean =>
  nonempty(row) && row.effectiveFrom < (end ?? new Date(8640000000000000)) &&
  (row.effectiveTo === null || row.effectiveTo > start);
const snapshot = (row: Assignment | null) => row && ({
  id: row.id, employeeId: row.userId, shiftId: row.shiftId,
  effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null,
});
const audit = async (tx: Tx, businessId: string, actor: string, action: string,
  entityId: string, reason: string, before: unknown, after: unknown): Promise<void> => {
  await tx.auditLog.create({ data: {
    businessId, actorType: "USER", actorUserId: actor, action, entityType: "assignment",
    entityId, reason, beforeValues: (before ?? {}) as Prisma.InputJsonValue,
    afterValues: after as Prisma.InputJsonValue,
  } });
};
const chainFor = (tx: Tx, businessId: string, employeeId: string) =>
  tx.shiftAssignment.findMany({
    where: { businessId, userId: employeeId }, select: assignmentSelect,
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
  });
const lockAndNow = async (tx: Tx, businessId: string, employeeId: string): Promise<Date> => {
  // The tenant proxy's set_config is the only lifecycle SQL before this lock.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('attendpro:assignment:' || ${businessId} || ':' || ${employeeId}, 0))`;
  const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return clock.now;
};
const activeEmployee = async (tx: Tx, businessId: string, employeeId: string) => {
  // Lock the tenant's employee row after the advisory lock, before locking the shift.
  // A concurrent admin deactivation must finish before this check or wait until commit.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE business_id = ${businessId} AND id = ${employeeId} FOR SHARE`;
  if (!locked.length) refuse(404, "Employee not found");
  const employee = await tx.user.findFirst({ where: { id: employeeId, businessId, isActive: true }, select: { id: true } });
  if (!employee) refuse(404, "Employee not found");
};
const activeShift = async (tx: Tx, businessId: string, shiftId: string) => {
  // Hold a row lock through the write so an isActive=false update cannot
  // commit between validation and inserting the assignment.
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM shifts WHERE business_id = ${businessId} AND id = ${shiftId} FOR SHARE`;
  if (!locked.length) refuse(404, "Shift not found");
  const shift = await tx.shift.findFirst({ where: { id: shiftId, businessId, isActive: true }, select: { id: true } });
  if (!shift) refuse(404, "Shift not found");
};
const timezoneFor = async (tx: Tx, businessId: string): Promise<string> => {
  const business = await tx.business.findFirst({ where: { id: businessId }, select: { timezone: true } });
  if (!business) throw new Refusal(404, "Business not found");
  return business.timezone;
};
const requestedStart = (date: string, zone: string, now: Date): Date => {
  const today = businessDateAt(now, zone);
  if (date < today) refuse(400, "Past business dates cannot be assigned");
  try { return date === today ? now : businessDateStart(date, zone); }
  catch { return refuse(400, "Invalid business date in business timezone"); }
};
const scopedUpdate = async (tx: Tx, businessId: string, row: Assignment, end: Date) => {
  const result = await tx.shiftAssignment.updateMany({
    where: { id: row.id, businessId, userId: row.userId }, data: { effectiveTo: end },
  });
  if (result.count !== 1) refuse(409, "Assignment changed; please retry");
};
const handleError = (error: unknown, res: Response): void => {
  if (error instanceof Refusal) { res.status(error.status).json({ success: false, message: error.message }); return; }
  // Prisma's PG adapter wraps SQLSTATE in varying nested causes.
  const codes = new Set<string>();
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  while (pending.length && visited.size < 32) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const record = current as Record<string, unknown>;
    for (const key of ["code", "originalCode"])
      if (typeof record[key] === "string") codes.add(record[key]);
    pending.push(record.cause, record.driverAdapterError, record.meta, record.originalCode);
  }
  // PrismaPg 6.19.3 can discard SQLSTATE from a model INSERT and only keep
  // it inside the unknown-request message. Match only the exact SQLSTATE
  // marker and never return or log the message (it contains row details).
  const adapterExclusion = error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes('QueryError(PostgresError { code: "23P01"');
  if (adapterExclusion || ["23P01", "23505", "P2002"].some((code) => codes.has(code))) {
    res.status(409).json({ success: false, message: "Assignment conflicts with an existing period" });
    return;
  }
  res.status(500).json({ success: false, message: "Server error" });
};
const context = async (req: Request) => {
  if (!req.user) throw new Refusal(401, "Authentication required");
  const businessId = await callerBusinessId(req.user.userId);
  if (!businessId) throw new Refusal(400, "Account has no business");
  return { businessId, actor: req.user.userId };
};

export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId, actor } = await context(req);
    const shiftId = String(req.params.id);
    const { employeeId, effectiveFrom, reason } = req.body as { employeeId: string; effectiveFrom: string; reason: string };
    const assignment = await prisma.$transaction(async (tx) => {
      const now = await lockAndNow(tx, businessId, employeeId);
      await activeEmployee(tx, businessId, employeeId);
      await activeShift(tx, businessId, shiftId);
      const start = requestedStart(effectiveFrom, await timezoneFor(tx, businessId), now);
      const chain = await chainFor(tx, businessId, employeeId);
      if (chain.some((row) => nonempty(row) && row.effectiveFrom.getTime() === start.getTime()))
        refuse(409, "An assignment already begins at this time");
      const predecessor = [...chain].reverse().find((row) => nonempty(row) && row.effectiveFrom < start) ?? null;
      if (chain.some((row) => overlap(row, start, null) && row.id !== predecessor?.id) ||
          chain.some((row) => nonempty(row) && row.effectiveFrom > start))
        refuse(409, "Assignment conflicts with an existing period");
      const closedPredecessor = predecessor && (predecessor.effectiveTo === null || predecessor.effectiveTo > start)
        ? predecessor : null;
      if (closedPredecessor)
        await scopedUpdate(tx, businessId, closedPredecessor, start);
      const created = await tx.shiftAssignment.create({
        data: { businessId, userId: employeeId, shiftId, effectiveFrom: start, assignedByUserId: actor },
        select: assignmentSelect,
      });
      if (start.getTime() === now.getTime())
        await tx.user.updateMany({ where: { id: employeeId, businessId }, data: { shiftId } });
      await audit(tx, businessId, actor, closedPredecessor ? "assignment.replaced" : "assignment.created",
        created.id, reason, snapshot(closedPredecessor), {
          ...snapshot(created), now: now.toISOString(),
          closedPredecessor: closedPredecessor
            ? { ...snapshot(closedPredecessor), effectiveTo: start.toISOString() } : null,
        });
      return created;
    });
    auditLog.assignmentCreated?.(actor, assignment.id, businessId);
    res.status(201).json({ success: true, data: assignment });
  } catch (error) { handleError(error, res); }
};

export const listAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId } = await context(req);
    const { employeeId, shiftId, status, search, from, to, page = 1, limit = 50 } = req.query as
      { employeeId?: string; shiftId?: string; status?: string; search?: string; from?: string; to?: string; page?: number; limit?: number };
    const zone = await prisma.business.findFirst({ where: { id: businessId }, select: { timezone: true } });
    if (!zone) throw new Refusal(404, "Business not found");
    const now = new Date();
    const where: Prisma.ShiftAssignmentWhereInput = {
      businessId, ...(employeeId ? { userId: employeeId } : {}), ...(shiftId ? { shiftId } : {}),
      ...(search ? { OR: [
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
        { user: { employeeCode: { contains: search, mode: "insensitive" } } },
        { shift: { name: { contains: search, mode: "insensitive" } } },
      ] } : {}),
      ...(from ? { effectiveFrom: { gte: businessDateStart(from, zone.timezone) } } : {}),
      ...(to ? { effectiveFrom: { lt: businessDateStart(nextBusinessDate(to), zone.timezone) } } : {}),
    };
    const rows = await prisma.shiftAssignment.findMany({ where, orderBy: { effectiveFrom: "desc" }, select: {
      ...assignmentSelect,
      user: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
      shift: { select: { id: true, name: true, startMinute: true, endMinute: true } },
    } });
    const decorated = rows.map((row) => {
      const state = row.effectiveTo && row.effectiveTo <= now || !nonempty(row) ? "ENDED" :
        row.effectiveFrom > now ? "FUTURE" : "CURRENT";
      return { ...row, status: state, isEffectiveNow: state === "CURRENT",
        effectiveFromBusinessDate: businessDateAt(row.effectiveFrom, zone.timezone),
        effectiveToBusinessDate: row.effectiveTo ? businessDateAt(row.effectiveTo, zone.timezone) : null };
    }).filter((row) => !status || row.status === status);
    const totalRecords = decorated.length;
    res.status(200).json({ success: true, data: decorated.slice((page - 1) * limit, page * limit),
      pagination: { currentPage: page, totalPages: Math.ceil(totalRecords / limit), totalRecords },
      meta: { businessTimezone: zone.timezone } });
  } catch (error) { handleError(error, res); }
};

export const rescheduleAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId, actor } = await context(req);
    const id = String(req.params.id);
    const { effectiveFrom, shiftId, reason } = req.body as { effectiveFrom?: string; shiftId?: string; reason: string };
    // Discovery only; target and chain are re-read after the employee lock.
    const discovered = await prisma.shiftAssignment.findFirst({ where: { id, businessId }, select: { userId: true } });
    if (!discovered) throw new Refusal(404, "Assignment not found");
    const result = await prisma.$transaction(async (tx) => {
      const now = await lockAndNow(tx, businessId, discovered.userId);
      await activeEmployee(tx, businessId, discovered.userId);
      const chain = await chainFor(tx, businessId, discovered.userId);
      const old = chain.find((row) => row.id === id);
      if (!old) throw new Refusal(404, "Assignment not found");
      if (!nonempty(old) || old.effectiveFrom <= now) refuse(400, "Only future assignments can be rescheduled");
      const nextShift = shiftId ?? old.shiftId;
      await activeShift(tx, businessId, nextShift);
      const start = effectiveFrom ? requestedStart(effectiveFrom, await timezoneFor(tx, businessId), now) : old.effectiveFrom;
      if (start <= now) refuse(400, "A rescheduled assignment must start in the future");
      if (old.effectiveTo && start >= old.effectiveTo) refuse(409, "Assignment conflicts with the next period");
      // Only a contiguous, non-empty row may cover a moved boundary; a gap stays a gap.
      const moved = start.getTime() !== old.effectiveFrom.getTime();
      const predecessor = moved
        ? chain.find((row) => row.id !== old.id && nonempty(row) &&
          row.effectiveTo?.getTime() === old.effectiveFrom.getTime()) ?? null
        : null;
      if (predecessor && (start <= predecessor.effectiveFrom || start <= now))
        refuse(409, "Assignment conflicts with the preceding period");
      // Compare the resulting intervals, not the old predecessor end: on a
      // backward move its old tail is removed before the successor is inserted.
      const otherRows = chain.filter((row) => row.id !== old.id && row.id !== predecessor?.id && nonempty(row));
      if (otherRows.some((row) => row.effectiveFrom.getTime() === start.getTime()))
        refuse(409, "An assignment already begins at this time");
      if (otherRows.some((row) => overlap(row, start, old.effectiveTo)) ||
          (predecessor && otherRows.some((row) => overlap(row, predecessor.effectiveFrom, start))))
        refuse(409, "Assignment conflicts with an existing period");
      await scopedUpdate(tx, businessId, old, old.effectiveFrom);
      if (predecessor) await scopedUpdate(tx, businessId, predecessor, start);
      const created = await tx.shiftAssignment.create({ data: {
        businessId, userId: old.userId, shiftId: nextShift, effectiveFrom: start,
        effectiveTo: old.effectiveTo, assignedByUserId: actor,
      }, select: assignmentSelect });
      await audit(tx, businessId, actor, "assignment.rescheduled", created.id, reason,
        { target: snapshot(old), ...(predecessor ? { predecessor: snapshot(predecessor) } : {}) },
        { target: snapshot({ ...old, effectiveTo: old.effectiveFrom }),
          ...(predecessor ? { predecessor: snapshot({ ...predecessor, effectiveTo: start }) } : {}),
          successor: snapshot(created) });
      return created;
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) { handleError(error, res); }
};

export const deactivateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { businessId, actor } = await context(req);
    const id = String(req.params.id);
    const { reason } = req.body as { reason: string };
    const discovered = await prisma.shiftAssignment.findFirst({ where: { id, businessId }, select: { userId: true } });
    if (!discovered) throw new Refusal(404, "Assignment not found");
    const result = await prisma.$transaction(async (tx) => {
      const now = await lockAndNow(tx, businessId, discovered.userId);
      await activeEmployee(tx, businessId, discovered.userId);
      const chain = await chainFor(tx, businessId, discovered.userId);
      const old = chain.find((row) => row.id === id);
      if (!old) throw new Refusal(404, "Assignment not found");
      if (!nonempty(old) || (old.effectiveTo !== null && old.effectiveTo <= now))
        refuse(400, "Assignment already closed");
      const future = old.effectiveFrom > now;
      if (future) {
        await scopedUpdate(tx, businessId, old, old.effectiveFrom);
        const predecessor = [...chain].reverse().find((row) => row.id !== id && nonempty(row) && row.effectiveFrom < old.effectiveFrom);
        const successor = chain.find((row) => row.id !== id && nonempty(row) && row.effectiveFrom > old.effectiveFrom);
        let restoredPredecessor: { before: ReturnType<typeof snapshot>; after: ReturnType<typeof snapshot> } | null = null;
        // Restore only its future tail; never reopen a period that was already
        // completed before this transaction (for example an earlier deactivation).
        if (predecessor && predecessor.effectiveTo && predecessor.effectiveTo > now &&
            predecessor.effectiveTo <= old.effectiveFrom) {
          const restoredEnd = successor?.effectiveFrom ?? null;
          const updated = await tx.shiftAssignment.updateMany({ where: { id: predecessor.id, businessId, userId: old.userId },
            data: { effectiveTo: restoredEnd } });
          if (updated.count !== 1) refuse(409, "Assignment changed; please retry");
          restoredPredecessor = { before: snapshot(predecessor),
            after: snapshot({ ...predecessor, effectiveTo: restoredEnd }) };
        }
        await audit(tx, businessId, actor, "assignment.cancelled", id, reason, snapshot(old),
          { cancelled: { ...snapshot(old), effectiveTo: old.effectiveFrom.toISOString() },
            restoredPredecessorId: restoredPredecessor?.after?.id ?? null,
            restoredUntil: restoredPredecessor?.after?.effectiveTo ?? null,
            restoredPredecessor, now: now.toISOString() });
      } else {
        const cancelledFuture = chain.filter((item) => nonempty(item) && item.effectiveFrom > now);
        for (const row of cancelledFuture)
          await scopedUpdate(tx, businessId, row, row.effectiveFrom);
        await scopedUpdate(tx, businessId, old, now);
        await tx.user.updateMany({ where: { id: old.userId, businessId }, data: { shiftId: null } });
        await audit(tx, businessId, actor, "assignment.deactivated", id, reason, snapshot(old),
          { closed: { ...snapshot(old), effectiveTo: now.toISOString() },
            cancelledFuture: cancelledFuture.map((row) => ({
              before: snapshot(row),
              after: { ...snapshot(row), effectiveTo: row.effectiveFrom.toISOString() },
            })) });
      }
      return { ...old, effectiveTo: future ? old.effectiveFrom : now };
    });
    auditLog.assignmentDeactivated?.(actor, result.id, businessId);
    res.status(200).json({ success: true, message: "Assignment closed", data: result });
  } catch (error) { handleError(error, res); }
};

export default { createAssignment, listAssignments, rescheduleAssignment, deactivateAssignment };
