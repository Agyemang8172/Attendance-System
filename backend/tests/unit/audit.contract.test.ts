import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  auditCount: vi.fn(),
  auditFindFirst: vi.fn(),
  attendanceFind: vi.fn(),
  correctionFindMany: vi.fn(),
  revisionFindMany: vi.fn(),
  business: vi.fn(),
}));

vi.mock('../../config/prismaClient.js', () => ({
  default: {
    auditLog: { findMany: db.auditFindMany, count: db.auditCount, findFirst: db.auditFindFirst },
    attendance: { findFirst: db.attendanceFind },
    attendanceCorrection: { findMany: db.correctionFindMany },
    attendanceCorrectionRevision: { findMany: db.revisionFindMany },
  },
}));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: db.business }));
vi.mock('../../utils/logger.js', () => ({ logError: vi.fn() }));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-test-role']) {
      res.sendStatus(401);
      return;
    }
    req.user = {
      userId: 'authenticated-reader',
      businessId: 'ignored-token-tenant',
      role: String(req.headers['x-test-role']),
      isActive: true,
      tokenVersion: 1,
      mustChangePassword: req.headers['x-test-forced'] === 'true',
    } as Request['user'];
    next();
  },
}));

const auditRoutes = (await import('../../routes/auditRoutes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/audit', auditRoutes);

const businessId = 'caller-tenant';
const attendanceId = '11111111-1111-4111-8111-111111111111';
const correctionId = '22222222-2222-4222-8222-222222222222';
const auditId = '33333333-3333-4333-8333-333333333333';
const createdAt = new Date('2026-11-06T10:00:00.000Z');

const auditRow = {
  id: auditId,
  businessId,
  actorType: 'USER',
  actorUserId: 'reader-1',
  actorKioskId: null,
  action: 'attendance.recorded',
  entityType: 'attendance',
  entityId: null,
  beforeValues: { clockIn: null },
  afterValues: { clockIn: '2026-11-06T08:00:00.000Z' },
  reason: 'Punch recorded',
  createdAt,
  actor: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng', email: 'ama@example.test', role: 'STAFF' },
};

const correctionRow = {
  id: correctionId,
  attendanceId,
  reason: 'The clock-in was wrong.',
  requestedAt: createdAt,
  reviewTier: 'SAME_DAY',
  proposedClockIn: '2026-11-06T07:55:00.000Z',
  proposedClockOut: null,
  originalValues: { clockIn: '2026-11-06T08:00:00.000Z' },
  approvedValues: null,
  status: 'SUBMITTED',
  decisionNote: null,
  decidedAt: null,
  createdAt,
  requestedBy: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng', email: 'ama@example.test' },
  reviewedBy: null,
  attendance: { id: attendanceId, date: createdAt, user: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng' } },
};

const trailAuditRow = {
  id: auditId,
  actorType: 'USER',
  actorUserId: 'reader-1',
  actorKioskId: null,
  action: 'correction.submitted',
  entityType: 'correction',
  entityId: correctionId,
  reason: 'Employee submitted a correction',
  createdAt,
  actor: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng' },
};

const list = (query = '', role = 'HR') =>
  request(app).get('/api/audit' + query).set('x-test-role', role);
const trail = (id = attendanceId, role = 'HR') =>
  request(app).get('/api/audit/corrections/' + id).set('x-test-role', role);
const one = (id = auditId, role = 'HR') =>
  request(app).get('/api/audit/' + id).set('x-test-role', role);

beforeEach(() => {
  vi.resetAllMocks();
  db.business.mockResolvedValue(businessId);
  db.auditFindMany.mockResolvedValue([auditRow]);
  db.auditCount.mockResolvedValue(1);
  db.auditFindFirst.mockResolvedValue(auditRow);
  db.attendanceFind.mockResolvedValue({ id: attendanceId });
  db.correctionFindMany.mockResolvedValue([correctionRow]);
  db.revisionFindMany.mockResolvedValue([]);
});

describe('GET /api/audit — role scope and filters', () => {
  it('refuses an anonymous caller and a STAFF caller', async () => {
    expect((await request(app).get('/api/audit')).status).toBe(401);
    expect((await list('', 'STAFF')).status).toBe(403);
  });

  it('keeps the HR scope separate from the free-text search', async () => {
    const res = await list('?search=clock&page=1&limit=12');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const where = db.auditFindMany.mock.calls[0][0].where as {
      businessId: string;
      OR?: unknown;
      AND: Array<{ OR: Array<Record<string, unknown>> }>;
    };
    expect(where.businessId).toBe(businessId);
    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([
        { action: { startsWith: 'attendance.' } },
        { action: { startsWith: 'correction.' } },
        { action: { startsWith: 'pin.' } },
        { action: 'hr.reset_pin' },
      ])
    );
    expect(where.AND[1].OR).toEqual(
      expect.arrayContaining([{ action: { contains: 'clock', mode: 'insensitive' } }])
    );
  });

  it('does not apply the HR scope to a SUPERADMIN read', async () => {
    const res = await list('?search=clock', 'SUPERADMIN');
    expect(res.status).toBe(200);
    const where = db.auditFindMany.mock.calls[0][0].where as { AND?: unknown };
    expect(where.AND).toBeUndefined();
  });

  it('turns ISO date filters into an inclusive gte/lte range', async () => {
    const res = await list('?startDate=2026-11-01T00:00:00.000Z&endDate=2026-11-07T23:59:59.999Z');
    expect(res.status).toBe(200);
    const where = db.auditFindMany.mock.calls[0][0].where as { createdAt: { gte: Date; lte: Date } };
    expect(where.createdAt.gte).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(where.createdAt.lte).toEqual(new Date('2026-11-07T23:59:59.999Z'));
  });

  it('rejects a date-only filter, a reversed range and an absurd page', async () => {
    expect((await list('?startDate=2026-11-01')).status).toBe(400);
    expect((await list('?startDate=2026-11-07T00:00:00.000Z&endDate=2026-11-01T00:00:00.000Z')).status).toBe(400);
    expect((await list('?page=9007199254740991')).status).toBe(400);
  });

  it('returns nullable entity ids, actor detail and the reason unchanged', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      id: auditId,
      action: 'attendance.recorded',
      entityType: 'attendance',
      entityId: null,
      reason: 'Punch recorded',
      actor: { firstName: 'Ama', lastName: 'Boateng', role: 'STAFF' },
    });
    expect(res.body.pagination).toMatchObject({ currentPage: 1, totalPages: 1, totalRecords: 1 });
  });

  it('blocks a caller that still owes a password change', async () => {
    const res = await request(app).get('/api/audit').set('x-test-role', 'HR').set('x-test-forced', 'true');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/audit/corrections/:attendanceId — the trail', () => {
  it('refuses anonymous and STAFF callers and a malformed id', async () => {
    expect((await request(app).get('/api/audit/corrections/' + attendanceId)).status).toBe(401);
    expect((await trail(attendanceId, 'STAFF')).status).toBe(403);
    expect((await trail('not-a-uuid')).status).toBe(400);
  });

  it('nests revisions and audit rows under each correction with no-store', async () => {
    db.revisionFindMany.mockResolvedValue([
      {
        id: 'revision-1',
        correctionId,
        revisionNo: 1,
        action: 'PROPOSED',
        valuesBefore: { clockIn: '2026-11-06T08:00:00.000Z' },
        valuesAfter: { clockIn: '2026-11-06T07:55:00.000Z' },
        reason: 'Initial request',
        createdAt,
        actor: { id: 'reader-1', firstName: 'Ama', lastName: 'Boateng' },
      },
    ]);
    db.auditFindMany.mockResolvedValue([trailAuditRow]);

    const res = await trail();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(correctionId);
    expect(res.body.data[0].attendanceCorrectionRevisions[0].id).toBe('revision-1');
    expect(res.body.data[0].audits[0]).toMatchObject({
      id: auditId,
      action: 'correction.submitted',
      actor: { firstName: 'Ama', lastName: 'Boateng' },
    });
    expect(db.attendanceFind).toHaveBeenCalledWith({
      where: { id: attendanceId, businessId },
      select: { id: true },
    });
  });

  it('returns an empty array when the record has no corrections', async () => {
    db.correctionFindMany.mockResolvedValue([]);
    const res = await trail();
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns the same 404 for an unknown or cross-tenant record', async () => {
    db.attendanceFind.mockResolvedValue(null);
    const res = await trail();
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Attendance record not found');
  });
});

describe('GET /api/audit/:id — one entry', () => {
  it('hides an HR entry outside the supervised subset', async () => {
    db.auditFindFirst.mockResolvedValue({ ...auditRow, action: 'user.updated' });
    const res = await one();
    expect(res.status).toBe(404);
  });

  it('lets HR read a correction entry and SUPERADMIN read any entry', async () => {
    db.auditFindFirst.mockResolvedValue({ ...auditRow, action: 'correction.decided' });
    const hr = await one();
    expect(hr.status).toBe(200);
    expect(hr.headers['cache-control']).toBe('no-store');

    db.auditFindFirst.mockResolvedValue({ ...auditRow, action: 'user.updated' });
    const sa = await one(auditId, 'SUPERADMIN');
    expect(sa.status).toBe(200);
  });
});
