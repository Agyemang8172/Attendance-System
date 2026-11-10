import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const m = vi.hoisted(() => ({
  business: vi.fn(), list: vi.fn(), count: vi.fn(), create: vi.fn(), find: vi.fn(), update: vi.fn(),
  created: vi.fn(), updated: vi.fn(), deactivated: vi.fn(),
}));
vi.mock('../../config/prismaClient.js', () => ({
  default: { shift: { findMany: m.list, count: m.count, create: m.create, findUnique: m.find, update: m.update } },
}));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: m.business }));
vi.mock('../../utils/logger.js', () => ({
  auditLog: { shiftCreated: m.created, shiftUpdated: m.updated, shiftDeactivated: m.deactivated },
}));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    const role = req.headers['x-test-role'];
    if (!role) { res.sendStatus(401); return; }
    req.user = {
      userId: 'reader-1', role: String(role), businessId: 'untrusted-token-tenant',
      mustChangePassword: req.headers['x-test-forced'] === 'true', isActive: true, tokenVersion: 1,
    } as Request['user'];
    next();
  },
}));

const router = (await import('../../routes/shiftRoutes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/business/shifts', router);

const base = '/api/business/shifts';
const id = '11111111-1111-4111-8111-111111111111';
const tenant = 'authorized-tenant';
const shift = {
  id, businessId: tenant, name: 'Night coverage', startMinute: 1320, endMinute: 360,
  crossesMidnight: true, isActive: true,
};
const list = (role = 'HR') => request(app).get(base).set('x-test-role', role);
const create = (role = 'SUPERADMIN', payload: Record<string, unknown> = {}) =>
  request(app).post(base).set('x-test-role', role).send({
    name: 'Night coverage', startMinute: 1320, endMinute: 360, crossesMidnight: true, ...payload,
  });

beforeEach(() => {
  vi.resetAllMocks();
  m.business.mockResolvedValue(tenant);
  m.list.mockResolvedValue([shift]);
  m.count.mockResolvedValue(1);
  m.create.mockResolvedValue(shift);
  m.find.mockResolvedValue(shift);
  m.update.mockResolvedValue(shift);
});

describe('shift definitions contract', () => {
  it.each(['HR', 'SUPERADMIN'])('filters and pages business shifts for %s', async (role) => {
    m.count.mockResolvedValue(23);
    const response = await list(role).query({ page: 2, limit: 10, search: ' night ', isActive: 'false', businessId: 'forged' });
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ currentPage: 2, totalPages: 3, totalRecords: 23 });
    const where = { businessId: tenant, isActive: false, name: { contains: 'night', mode: 'insensitive' } };
    expect(m.list).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 10, take: 10, orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }));
    expect(m.count).toHaveBeenCalledWith({ where });
    expect(m.business).toHaveBeenCalledWith('reader-1');
  });

  it('rejects bad list filters and unsafe paging before a database read', async () => {
    for (const query of [{ limit: 101 }, { page: 'not-a-page' }, { page: Number.MAX_SAFE_INTEGER },
      { isActive: 'maybe' }, { search: 'x'.repeat(101) }]) {
      expect((await list().query(query)).status).toBe(400);
    }
    expect(m.list).not.toHaveBeenCalled();
    expect(m.count).not.toHaveBeenCalled();
  });

  it('separates HR read, SA write and tenant gates', async () => {
    expect((await request(app).get(base)).status).toBe(401);
    expect((await list('STAFF')).status).toBe(403);
    expect((await create('HR')).status).toBe(403);
    expect(m.create).not.toHaveBeenCalled();
  });

  it('creates a trimmed cross-midnight shift with mirrored legacy times and an audit', async () => {
    const response = await create('SUPERADMIN', { name: ' Night coverage ' });
    expect(response.status).toBe(201);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId: tenant, name: 'Night coverage', startMinute: 1320, endMinute: 360,
        crossesMidnight: true, startTime: '22:00', endTime: '06:00', isActive: true,
      }),
    }));
    expect(m.created).toHaveBeenCalledWith('reader-1', id, tenant);
  });

  it('rejects contradictory overnight geometry and blank names on create', async () => {
    expect((await create('SUPERADMIN', { crossesMidnight: false })).status).toBe(400);
    expect((await create('SUPERADMIN', { startMinute: 480, endMinute: 1020, crossesMidnight: true })).status).toBe(400);
    expect((await create('SUPERADMIN', { name: '   ' })).status).toBe(400);
    expect((await create('SUPERADMIN', { startMinute: 480, endMinute: 480, crossesMidnight: false })).status).toBe(400);
    expect((await create('SUPERADMIN', { startMinute: 480, endMinute: 480, crossesMidnight: true })).status).toBe(201);
    expect(m.create).toHaveBeenCalledTimes(1);
  });

  it('rejects non-numeric minute input instead of reading it as midnight', async () => {
    for (const payload of [{ startMinute: null }, { startMinute: '' }, { startMinute: false },
      { startMinute: 'abc' }, { startMinute: '12.5' }, { startMinute: 1440 }]) {
      const response = await create('SUPERADMIN', payload);
      expect(response.status).toBe(400);
    }
    expect(m.create).not.toHaveBeenCalled();
    expect((await create('SUPERADMIN', { startMinute: '510' })).status).toBe(201);
  });

  it('reports unique name conflicts without changing shift history', async () => {
    m.create.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'P2002' }));
    const response = await create();
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/);
    expect(m.updated).not.toHaveBeenCalled();
  });

  it('merges partial time edits and refuses invalid geometry before a write', async () => {
    const invalid = await request(app).patch(`${base}/${id}`).set('x-test-role', 'SUPERADMIN')
      .send({ endMinute: 1380 });
    expect(invalid.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();

    const valid = await request(app).patch(`${base}/${id}`).set('x-test-role', 'SUPERADMIN')
      .send({ endMinute: 1380, crossesMidnight: false });
    expect(valid.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id }, data: { endMinute: 1380, crossesMidnight: false, startTime: '22:00', endTime: '23:00' },
    }));
    expect(m.updated).toHaveBeenCalledWith('reader-1', id, tenant);
  });

  it('rejects a blank edited name and trims the stored name', async () => {
    const blank = await request(app).patch(`${base}/${id}`).set('x-test-role', 'SUPERADMIN')
      .send({ name: '   ' });
    expect(blank.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();

    const trimmed = await request(app).patch(`${base}/${id}`).set('x-test-role', 'SUPERADMIN')
      .send({ name: '  Evening watch  ' });
    expect(trimmed.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id }, data: { name: 'Evening watch' },
    }));
  });

  it('deactivates without deleting records and preserves the row for inactive filtering', async () => {
    const response = await request(app).post(`${base}/${id}/deactivate`).set('x-test-role', 'SUPERADMIN');
    expect(response.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id }, data: { isActive: false } }));
    expect(m.deactivated).toHaveBeenCalledWith('reader-1', id, tenant);
    expect((await list().query({ isActive: 'false' })).status).toBe(200);
    expect(m.list.mock.calls.at(-1)?.[0].where).toEqual({ businessId: tenant, isActive: false });
  });

  it('does not write another tenant shift', async () => {
    m.find.mockResolvedValue({ ...shift, businessId: 'other-tenant' });
    expect((await request(app).post(`${base}/${id}/deactivate`).set('x-test-role', 'SUPERADMIN')).status).toBe(403);
    expect(m.update).not.toHaveBeenCalled();
  });
});
