import { beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
  update: vi.fn(), transaction: vi.fn(), business: vi.fn(), audit: vi.fn(),
  loggedResolution: vi.fn(), logError: vi.fn(),
}));
vi.mock('../../config/prismaClient.js', () => ({
  default: {
    attendanceHelpRequest: {
      findFirst: mocks.findFirst, findUnique: mocks.findUnique, findMany: mocks.findMany, count: mocks.count,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: mocks.business }));
vi.mock('../../utils/auditWriter.js', () => ({ writeAudit: mocks.audit }));
vi.mock('../../utils/logger.js', () => ({
  auditLog: { helpRequestResolved: mocks.loggedResolution },
  logError: mocks.logError,
}));
vi.mock('../../controllers/userController.js', () => ({
  default: { getAllUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), resetPin: vi.fn() },
}));
vi.mock('../../controllers/correctionController.js', () => ({
  listBusinessCorrections: vi.fn(), getBusinessCorrection: vi.fn(), decideCorrection: vi.fn(),
}));
vi.mock('../../middleware/authMiddleware.js', () => ({
  default: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-test-role']) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }
    req.user = {
      userId: 'test-reviewer', businessId: 'ignored-token-business', role: String(req.headers['x-test-role']),
      isActive: true, mustChangePassword: req.headers['x-test-forced'] === 'true', tokenVersion: 1,
    } as Request['user'];
    next();
  },
}));

const router = (await import('../../routes/hrRoutes.js')).default;
const app = express();
app.use(express.json());
app.use('/api/hr', router);
const base = '/api/hr/help-requests';
const id = '11111111-1111-4111-8111-111111111111';
const tenant = 'tenant-from-caller';
const row = {
  id, category: 'kiosk', subject: 'Scanner assistance', body: 'The camera could not read the badge.',
  status: 'OPEN', resolutionNote: null, resolvedAt: null,
  createdAt: '2026-11-04T10:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
  requester: { id: 'test-requester', firstName: 'Ama', lastName: 'Mensah', email: 'ama@example.test' },
};
const tx = { attendanceHelpRequest: { update: mocks.update } };
const read = (role = 'HR', key = id) => request(app).get(`${base}/${key}`).set('x-test-role', role);
const patch = (status: string, note?: string) => request(app).patch(`${base}/${id}`)
  .set('x-test-role', 'HR').send({ status, resolutionNote: note });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.business.mockResolvedValue(tenant);
  mocks.findFirst.mockResolvedValue(row);
  mocks.findUnique.mockResolvedValue({ id, businessId: tenant, status: 'OPEN' });
  mocks.findMany.mockResolvedValue([row]);
  mocks.count.mockResolvedValue(1);
  mocks.update.mockResolvedValue({ id, status: 'RESOLVED', resolutionNote: 'Fixed.', requesterId: 'test-requester' });
  mocks.transaction.mockImplementation(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
});

describe('HR Help direct read', () => {
  it.each(['HR', 'SUPERADMIN'])('uses the existing queue projection and caller tenant for %s', async role => {
    const queue = await request(app).get(base).set('x-test-role', role);
    const detail = await read(role).query({ businessId: 'forged' });
    expect(queue.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({ success: true, data: row });
    expect(mocks.business).toHaveBeenCalledWith('test-reviewer');
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id, businessId: tenant }, select: mocks.findMany.mock.calls[0][0].select,
    });
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('returns the same 404 for unknown and foreign IDs', async () => {
    mocks.findFirst.mockResolvedValue(null);
    const missing = await read();
    const foreign = await read('HR', '22222222-2222-4222-8222-222222222222');
    expect([missing.status, foreign.status]).toEqual([404, 404]);
    expect(missing.body).toEqual(foreign.body);
    expect(mocks.findFirst.mock.calls.map(([input]) => input.where.businessId)).toEqual([tenant, tenant]);
  });

  it('rejects STAFF, forced-password and unauthenticated users before persistence', async () => {
    expect((await read('STAFF')).status).toBe(403);
    expect((await read().set('x-test-forced', 'true')).status).toBe(403);
    expect((await request(app).get(`${base}/${id}`)).status).toBe(401);
    expect(mocks.business).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects invalid UUIDs before persistence', async () => {
    expect((await read('HR', 'invalid-key')).status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe('HR Help status updates', () => {
  it('updates only the observed tenant row and audits in the same transaction', async () => {
    expect((await patch('RESOLVED', 'Fixed.')).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, businessId: tenant, status: 'OPEN' },
      data: expect.objectContaining({ status: 'RESOLVED', resolutionNote: 'Fixed.' }),
    }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      businessId: tenant, entityId: id, action: 'help.request_resolved',
    }), tx);
    expect(mocks.loggedResolution).toHaveBeenCalledTimes(1);
  });

  it('returns 409 and emits no audit when a concurrent status change wins', async () => {
    mocks.update.mockRejectedValue({ code: 'P2025' });
    expect((await patch('RESOLVED')).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.loggedResolution).not.toHaveBeenCalled();
  });

  it('keeps the optional API note contract and leaves an omitted note unchanged', async () => {
    mocks.findUnique.mockResolvedValue({ id, businessId: tenant, status: 'IN_REVIEW' });
    expect((await patch('CLOSED')).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toEqual({ status: 'CLOSED', resolvedAt: null });
  });

  it('refuses terminal transitions and cross-tenant writes before transaction', async () => {
    mocks.findUnique.mockResolvedValueOnce({ id, businessId: tenant, status: 'RESOLVED' });
    mocks.findUnique.mockResolvedValueOnce({ id, businessId: 'foreign', status: 'OPEN' });
    expect((await patch('CLOSED')).status).toBe(409);
    expect((await patch('RESOLVED')).status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('does not misclassify an audit failure as a lost update', async () => {
    mocks.audit.mockRejectedValue({ code: 'P2025' });
    expect((await patch('RESOLVED')).status).toBe(500);
    expect(mocks.loggedResolution).not.toHaveBeenCalled();
  });
});
