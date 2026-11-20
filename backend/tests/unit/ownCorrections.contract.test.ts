import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), attendanceFind: vi.fn(),
  business: vi.fn(), audit: vi.fn(), attendanceDetail: vi.fn(),
}));

vi.mock('../../config/prismaClient.js', () => ({
  default: {
    attendanceCorrection: { findMany: db.findMany, count: db.count, findFirst: db.findFirst },
    attendance: { findFirst: db.attendanceFind },
  },
}));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: db.business }));
vi.mock('../../utils/auditWriter.js', () => ({ writeAudit: db.audit }));
vi.mock('../../utils/logger.js', () => ({ auditLog: {}, logError: vi.fn() }));
vi.mock('../../controllers/attendanceDetailController.js', () => ({ getAttendanceById: db.attendanceDetail }));
vi.mock('../../controllers/attendanceController.js', () => ({
  clockIn: vi.fn(), clockOut: vi.fn(), getMyAttendance: vi.fn(), getAllAttendance: vi.fn(), dismissAlert: vi.fn(),
}));
vi.mock('../../middleware/kioskAuthMiddleware.js', () => ({
  default: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-test-role']) {
      res.sendStatus(401);
      return;
    }
    req.user = {
      userId: 'authenticated-requester', businessId: 'ignored-token-tenant',
      role: String(req.headers['x-test-role']), isActive: true, tokenVersion: 1,
      mustChangePassword: req.headers['x-test-forced'] === 'true',
    } as Request['user'];
    next();
  },
}));

const attendanceRoutes = (await import('../../routes/attendanceRoutes.js')).default;
const correctionRoutes = (await import('../../routes/correctionRoutes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendance/corrections', correctionRoutes);

const path = '/api/attendance/corrections';
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const foreignId = '33333333-3333-4333-8333-333333333333';
const missingId = '44444444-4444-4444-8444-444444444444';
const attendanceId = '55555555-5555-4555-8555-555555555555';
const businessId = 'caller-tenant';
const requestedById = 'authenticated-requester';
const date = '2026-11-03T00:00:00.000Z';

const ownRow = {
  id, businessId, requestedById, attendanceId, status: 'APPROVED', reviewTier: 'SAME_DAY',
  reason: 'The recorded punch was late.', decisionNote: 'Corrected.',
  requestedAt: date, decidedAt: date, createdAt: date,
  proposedClockIn: '2026-11-03T08:00:00.000Z', proposedClockOut: null,
  reviewedById: 'internal-reviewer', internalMarker: 'internal-only',
  attendance: { id: attendanceId, date, privateMarker: 'private-attendance' },
  originalValues: { clockIn: '2026-11-03T08:03:00.000Z', clockOut: null, privateMarker: 'private-original' },
  approvedValues: { clockIn: '2026-11-03T08:00:00.000Z', status: 'ON_TIME', privateMarker: 'private-approved' },
};
const rows = [
  ownRow,
  { ...ownRow, id: otherId, requestedById: 'different-requester' },
  { ...ownRow, id: foreignId, businessId: 'different-tenant' },
];

type Selection = { [key: string]: boolean | { select: Selection } };
type Query = { where: Record<string, unknown>; select: Selection };
function selectFields(row: Record<string, unknown>, selection: Selection): Record<string, unknown> {
  return Object.fromEntries(Object.entries(selection).filter(([, selected]) => selected).map(([key, selected]) => [
    key, typeof selected === 'object' && row[key] && typeof row[key] === 'object'
      ? selectFields(row[key] as Record<string, unknown>, selected.select)
      : row[key],
  ]));
}
function matchingRows(where: Query['where']) {
  return rows.filter(row => Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value));
}
const get = (suffix = '', role = 'HR') => request(app).get(path + suffix).set('x-test-role', role);

beforeEach(() => {
  vi.resetAllMocks();
  db.business.mockResolvedValue(businessId);
  db.findMany.mockImplementation(async ({ where, select, skip, take }: Query & { skip: number; take: number }) =>
    matchingRows(where).slice(skip, skip + take).map(row => selectFields(row, select)));
  db.count.mockImplementation(async ({ where }: Query) => matchingRows(where).length);
  db.findFirst.mockImplementation(async ({ where, select }: Query) => {
    const row = matchingRows(where)[0];
    return row ? selectFields(row, select) : null;
  });
  db.attendanceFind.mockResolvedValue(null);
  db.attendanceDetail.mockImplementation((_req: Request, res: Response) => res.json({ lane: 'attendance' }));
});

describe('own correction tracking API', () => {
  it('uses the requester and tenant for both paginated rows and count despite supplied scope fields', async () => {
    const result = await get().query({ status: 'APPROVED', page: 2, limit: 1, businessId: 'different-tenant', requestedById: 'different-requester' });
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.pagination).toEqual({ currentPage: 2, totalPages: 1, total: 1 });
    expect(result.body.data).toEqual([]);
    const where = { businessId, requestedById, status: 'APPROVED' };
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 1, take: 1 }));
    expect(db.count).toHaveBeenCalledWith({ where });
    expect(db.business).toHaveBeenCalledWith(requestedById);
    const firstPage = await get().query({ status: 'APPROVED' });
    expect(firstPage.body.data.map((row: { id: string }) => row.id)).toEqual([id]);
    expect(firstPage.body.data[0]).not.toHaveProperty('businessId');
    expect(firstPage.body.data[0]).not.toHaveProperty('reviewedById');
    expect(db.attendanceDetail).not.toHaveBeenCalled();
  });

  it('returns an empty list with zero counts and the established defaults', async () => {
    const result = await get().query({ status: 'WITHDRAWN' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, data: [], pagination: { currentPage: 1, totalPages: 0, total: 0 } });
  });

  it('preserves the accepted shared self-route access for Staff', async () => {
    expect((await get('', 'STAFF')).status).toBe(200);
    expect((await get('/' + id, 'STAFF')).status).toBe(200);
  });

  it('returns the selected own detail and strips internal fields from snapshots and attendance', async () => {
    const result = await get('/' + id);
    expect(result.status).toBe(200);
    expect(db.findFirst).toHaveBeenCalledOnce();
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id, businessId, requestedById } }));
    expect(result.body.data).toMatchObject({
      id, attendanceId, reason: ownRow.reason, decisionNote: ownRow.decisionNote,
      attendance: { id: attendanceId, date },
      proposedClockIn: ownRow.proposedClockIn, proposedClockOut: null,
      originalValues: { clockIn: ownRow.originalValues.clockIn, clockOut: null },
      approvedValues: { clockIn: ownRow.approvedValues.clockIn, status: 'ON_TIME' },
    });
    expect(Object.keys(result.body.data).sort()).toEqual([
      'id', 'attendanceId', 'status', 'reviewTier', 'reason', 'decisionNote', 'requestedAt', 'decidedAt',
      'createdAt', 'proposedClockIn', 'proposedClockOut', 'attendance', 'originalValues', 'approvedValues',
    ].sort());
    expect(JSON.stringify(result.body)).not.toMatch(/privateMarker|internalMarker|reviewedById|requestedById|businessId/);
    expect(db.audit).not.toHaveBeenCalled();
  });

  it('returns same-tenant other-requester 403 and the same 404 for foreign and absent records', async () => {
    const other = await get('/' + otherId);
    const foreign = await get('/' + foreignId);
    const missing = await get('/' + missingId);
    expect([other.status, foreign.status, missing.status]).toEqual([403, 404, 404]);
    expect(foreign.body).toEqual(missing.body);
    expect(other.body).not.toHaveProperty('data');
    expect(db.findFirst.mock.calls.map(([query]) => query.where.businessId)).toEqual(Array(6).fill(businessId));
    const probes = db.findFirst.mock.calls.filter(([query]) => !('requestedById' in query.where));
    expect(probes).toHaveLength(3);
    expect(probes.every(([query]) => Object.keys(query.select).length === 1 && query.select.id === true)).toBe(true);
  });

  it('uses the same refusal for a Staff caller reading another requester row', async () => {
    expect((await get('/' + otherId, 'STAFF')).status).toBe(403);
  });

  it('answers 400 when the caller account has no business and reads no rows', async () => {
    db.business.mockResolvedValue(null);
    const result = await get();
    expect(result.status).toBe(400);
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.count).not.toHaveBeenCalled();
  });

  it('returns null approved evidence for a rejected request and marks the response no-store', async () => {
    db.findFirst.mockResolvedValueOnce({
      id: otherId, attendanceId, status: 'REJECTED', reviewTier: 'SAME_DAY',
      reason: 'Not accepted.', decisionNote: null, requestedAt: date, decidedAt: null, createdAt: date,
      proposedClockIn: null, proposedClockOut: null,
      attendance: { id: attendanceId, date },
      originalValues: { clockIn: ownRow.originalValues.clockIn, clockOut: null },
      approvedValues: null,
    });
    const result = await get('/' + otherId);
    expect(result.status).toBe(200);
    expect(result.body.data.approvedValues).toBeNull();
    expect(result.body.data.status).toBe('REJECTED');
    expect(result.headers['cache-control']).toBe('no-store');
  });

  it('sanitises a malformed stored snapshot instead of echoing it', async () => {
    db.findFirst.mockResolvedValueOnce({
      id: otherId, attendanceId, status: 'SUBMITTED', reviewTier: 'ESCALATED',
      reason: 'Malformed fixture.', decisionNote: null, requestedAt: date, decidedAt: null, createdAt: date,
      proposedClockIn: null, proposedClockOut: null,
      attendance: { id: attendanceId, date },
      originalValues: ['unexpected', 'array'],
      approvedValues: { clockIn: 5, hoursWorked: 'many', status: null, extra: 'not-allowed' },
    });
    const result = await get('/' + otherId);
    expect(result.status).toBe(200);
    expect(result.body.data.originalValues).toBeNull();
    expect(result.body.data.approvedValues).toEqual({
      clockIn: null, clockOut: null, status: null, sessionStatus: null, closureReason: null, hoursWorked: null,
    });
    expect(JSON.stringify(result.body)).not.toContain('not-allowed');
  });

  it.each(['', '/' + id])('blocks unauthenticated, forced-password and Superadmin GET %s before persistence', async suffix => {
    expect((await request(app).get(path + suffix)).status).toBe(401);
    expect((await get(suffix).set('x-test-forced', 'true')).status).toBe(403);
    expect((await get(suffix, 'SUPERADMIN')).status).toBe(403);
    expect(db.business).not.toHaveBeenCalled();
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.findFirst).not.toHaveBeenCalled();
  });

  it('validates UUID, page, status and limit before persistence', async () => {
    expect((await get('/invalid')).status).toBe(400);
    expect((await get().query({ page: 0, limit: 101, status: 'UNKNOWN' })).status).toBe(400);
    expect((await get().query({ page: '100000000000000000000' })).status).toBe(400);
    expect(db.business).not.toHaveBeenCalled();
  });

  it('leaves the attendance detail route and existing submission roles in place', async () => {
    expect((await request(app).get('/api/attendance/' + attendanceId).set('x-test-role', 'HR')).body).toEqual({ lane: 'attendance' });
    const post = (role: string) => request(app).post(path).set('x-test-role', role).send({ attendanceId, reason: 'Correct this punch' });
    expect((await post('SUPERADMIN')).status).toBe(403);
    expect((await post('STAFF')).status).toBe(404);
    expect((await post('HR')).status).toBe(404);
    expect(db.attendanceFind).toHaveBeenCalledTimes(2);
    expect(db.attendanceFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: attendanceId, businessId, userId: requestedById },
    }));
  });
});
