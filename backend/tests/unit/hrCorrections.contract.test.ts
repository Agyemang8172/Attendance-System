import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const m = vi.hoisted(() => ({
  first: vi.fn(), unique: vi.fn(), list: vi.fn(), total: vi.fn(), decide: vi.fn(),
  attendance: vi.fn(), apply: vi.fn(), maxRevision: vi.fn(), revision: vi.fn(),
  otherHr: vi.fn(), transaction: vi.fn(), business: vi.fn(), audit: vi.fn(), logged: vi.fn(),
}));
vi.mock('../../config/prismaClient.js', () => ({
  default: {
    attendanceCorrection: { findFirst: m.first, findMany: m.list, count: m.total },
    $transaction: m.transaction,
  },
}));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: m.business }));
vi.mock('../../utils/auditWriter.js', () => ({ writeAudit: m.audit }));
vi.mock('../../utils/logger.js', () => ({ auditLog: { correctionDecided: m.logged }, logError: vi.fn() }));
vi.mock('../../controllers/userController.js', () => ({
  default: { getAllUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), resetPin: vi.fn() },
}));
vi.mock('../../controllers/helpRequestController.js', () => ({
  getBusinessHelpRequest: vi.fn(), listBusinessHelpRequests: vi.fn(), updateHelpRequest: vi.fn(),
}));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-test-role']) {
      res.sendStatus(401);
      return;
    }
    req.user = {
      userId: 'test-reviewer', businessId: 'ignored-token-business',
      role: String(req.headers['x-test-role']), mustChangePassword: req.headers['x-test-forced'] === 'true',
      isActive: true, tokenVersion: 1,
    } as Request['user'];
    next();
  },
}));

const router = (await import('../../routes/hrRoutes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/hr', router);
const base = '/api/hr/corrections';
const id = '11111111-1111-4111-8111-111111111111';
const attendanceId = '22222222-2222-4222-8222-222222222222';
const tenant = 'caller-tenant';
const clockIn = new Date('2026-11-03T08:00:00Z');
const clockOut = new Date('2026-11-03T16:00:00Z');
const proposedClockIn = new Date('2026-11-03T07:55:00Z');
const attendance = {
  id: attendanceId, userId: 'test-requester', clockIn, clockOut,
  sessionStatus: 'CLOSED', status: 'ON_TIME', closureReason: 'CLOCK_OUT', hoursWorked: 8,
  shiftStartMinuteSnapshot: null, shiftEndMinuteSnapshot: null, shiftCrossesMidnightSnapshot: null,
  graceEarlyMinutesSnapshot: null, graceLateMinutesSnapshot: null,
};
const correction = {
  id, attendanceId, businessId: tenant, requestedById: 'test-requester', status: 'SUBMITTED',
  reviewTier: 'SAME_DAY', proposedClockIn, proposedClockOut: null,
  originalValues: { clockIn: clockIn.toISOString(), clockOut: clockOut.toISOString(), hoursWorked: 8 },
};
const approvedValues = { clockIn: proposedClockIn.toISOString(), clockOut: clockOut.toISOString() };
const detailRow = { id, attendanceId, status: 'APPROVED', approvedValues };
const tx = {
  attendance: { findUnique: m.attendance, updateMany: m.apply },
  attendanceCorrection: { findFirst: m.first, findUnique: m.unique, updateMany: m.decide },
  attendanceCorrectionRevision: { aggregate: m.maxRevision, create: m.revision },
  user: { count: m.otherHr },
};
let committedAttendanceWrites: unknown[];
const read = (role = 'HR', key = id) => request(app).get(`${base}/${key}`).set('x-test-role', role);
const patch = (role = 'HR', extras: Record<string, unknown> = {}) =>
  request(app).patch(`${base}/${id}/decision`).set('x-test-role', role).send({ decision: 'APPROVED', ...extras });

beforeEach(() => {
  vi.resetAllMocks();
  committedAttendanceWrites = [];
  m.business.mockResolvedValue(tenant);
  m.first.mockResolvedValue(correction);
  m.list.mockResolvedValue([]);
  m.total.mockResolvedValue(0);
  m.unique.mockResolvedValue(detailRow);
  m.attendance.mockResolvedValue(attendance);
  m.decide.mockResolvedValue({ count: 1 });
  m.maxRevision.mockResolvedValue({ _max: { revisionNo: 1 } });
  m.otherHr.mockResolvedValue(1);
  m.transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => {
    const pending: unknown[] = [];
    m.apply.mockImplementation(async ({ data }: { data: unknown }) => {
      pending.push(data);
      return { count: 1 };
    });
    const result = await work(tx);
    committedAttendanceWrites.push(...pending);
    return result;
  });
});

describe('correction reviewer detail', () => {
  it.each(['HR', 'SUPERADMIN'])('selects correction evidence only in the caller tenant for %s', async role => {
    m.first.mockResolvedValue(detailRow);
    expect((await request(app).get(base).set('x-test-role', role)).status).toBe(200);
    const result = await read(role).query({ businessId: 'forged' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, data: detailRow });
    expect(m.first).toHaveBeenCalledWith({
      where: { id, businessId: tenant },
      select: { ...m.list.mock.calls[0][0].select, approvedValues: true },
    });
    expect(m.business).toHaveBeenCalledWith('test-reviewer');
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not distinguish absent and foreign IDs', async () => {
    m.first.mockResolvedValue(null);
    const missing = await read();
    const foreign = await read('HR', attendanceId);
    expect([missing.status, foreign.status]).toEqual([404, 404]);
    expect(missing.body).toEqual(foreign.body);
    expect(m.first.mock.calls.map(([query]) => query.where.businessId)).toEqual([tenant, tenant]);
  });

  it('blocks unauthenticated, staff, forced-password, and invalid-ID requests before persistence', async () => {
    expect((await request(app).get(`${base}/${id}`)).status).toBe(401);
    expect((await read('STAFF')).status).toBe(403);
    expect((await read().set('x-test-forced', 'true')).status).toBe(403);
    expect((await read('HR', 'not-a-uuid')).status).toBe(400);
    expect(m.first).not.toHaveBeenCalled();
    expect(m.business).not.toHaveBeenCalled();
  });
});

describe('correction decision integrity', () => {
  it('guards observed clock-in and worked hours and records the winning change', async () => {
    expect((await patch()).status).toBe(200);
    expect(m.apply).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: attendanceId, clockIn, clockOut, hoursWorked: 8 }),
    }));
    expect(committedAttendanceWrites).toHaveLength(1);
    expect(m.revision).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ entityId: id, businessId: tenant }), tx);
  });

  it('rolls back a buffered attendance write when the correction decision guard loses', async () => {
    m.decide.mockResolvedValue({ count: 0 });
    expect((await patch()).status).toBe(409);
    expect(m.apply).toHaveBeenCalledTimes(1);
    expect(committedAttendanceWrites).toEqual([]);
    expect(m.revision).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.logged).not.toHaveBeenCalled();
  });

  it('returns 409 on observed drift before any mutation', async () => {
    m.attendance.mockResolvedValue({ ...attendance, clockIn: proposedClockIn });
    expect((await patch()).status).toBe(409);
    expect(m.apply).not.toHaveBeenCalled();
    expect(m.decide).not.toHaveBeenCalled();
  });

  it('refuses a self decision and a withdrawn record', async () => {
    m.first.mockResolvedValueOnce({ ...correction, requestedById: 'test-reviewer' });
    expect((await patch('SUPERADMIN')).status).toBe(403);
    m.first.mockResolvedValueOnce({ ...correction, status: 'WITHDRAWN' });
    expect((await patch()).status).toBe(409);
    expect(m.apply).not.toHaveBeenCalled();
    expect(m.decide).not.toHaveBeenCalled();
  });

  it('keeps escalated decisions gated by the current reviewer lane', async () => {
    m.first.mockResolvedValue({ ...correction, reviewTier: 'ESCALATED' });
    m.otherHr.mockResolvedValue(0);
    expect((await patch()).status).toBe(403);
    expect((await patch('SUPERADMIN')).status).toBe(403);
    const response = await patch('SUPERADMIN', {
      backstopCondition: 'EXPLICIT_HANDOFF', backstopReason: 'Another reviewer requested the handoff.',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.escalation).toEqual({ type: 'SUPERADMIN_BACKSTOP', condition: 'EXPLICIT_HANDOFF' });
  });
});
