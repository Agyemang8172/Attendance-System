import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ ac: vi.fn(), af: vi.fn(), tc: vi.fn(), tf: vi.fn(), business: vi.fn(), audit: vi.fn(), log: vi.fn(), tenant: '11111111-1111-4111-8111-111111111111', actor: '22222222-2222-4222-8222-222222222222' }));
// All persistence/audit dependencies are replaced before importing the real report router.
vi.mock('../../config/prismaClient.js', () => ({ default: { attendance: { count: m.ac, findMany: m.af }, attendanceAttempt: { count: m.tc, findMany: m.tf } } }));
vi.mock('../../utils/tenant.js', () => ({ callerBusinessId: m.business }));
vi.mock('../../utils/auditWriter.js', () => ({ writeAudit: m.audit }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: m.log, warn: m.log, error: m.log }, logError: m.log }));
vi.mock('../../middleware/authMiddleware.js', () => ({ default: (req: Request,res: Response,next: NextFunction) => {
 if(!req.headers['x-test-role']) { res.status(401).json({message:'Authentication required'}); return; }
 req.user={userId:m.actor,businessId:'ignored-business',role:String(req.headers['x-test-role']),isActive:true,mustChangePassword:req.headers['x-test-forced']==='true',tokenVersion:1} as Request['user']; next();
} }));
const router=(await import('../../routes/reportRoutes.js')).default;
const app=express(); app.use('/api/reports',router);
const range={startDate:'2026-11-01',endDate:'2026-11-04',limit:12};
const employee={id:'internal-employee',firstName:'Ama',lastName:'Mensah',employeeCode:'EMP-042'};
const attendanceRows=(count:number)=>Array.from({length:count},(_,i)=>({id:`attendance-${i}`,date:new Date('2026-11-03T00:00:00Z'),status:'CLOCK_OUT_MISSING',sessionStatus:'OPEN',requiresReviewReason:'Recorded review reason',user:employee}));
const attemptRows=(count:number)=>Array.from({length:count},(_,i)=>({id:`attempt-${i}`,createdAt:new Date('2026-11-03T08:00:00Z'),action:'CLOCK_IN',outcome:'REJECTED',step:'LOCATION',reason:'Assessment unavailable',locationResult:i%2?'OUTSIDE':'UNKNOWN',employee:null,site:{id:'internal-site',name:'Reception'},kiosk:{id:'internal-device',label:'Front terminal'}}));
function data(a:number,t:number){const ar=attendanceRows(a),tr=attemptRows(t);m.ac.mockResolvedValue(a);m.tc.mockResolvedValue(t);m.af.mockImplementation(async({skip,take}:{skip:number;take:number})=>ar.slice(skip,skip+take));m.tf.mockImplementation(async({skip,take}:{skip:number;take:number})=>tr.slice(skip,skip+take));}
const read=(page=1,role='HR')=>request(app).get('/api/reports/exceptions').set('x-test-role',role).query({...range,page});
beforeEach(()=>{vi.clearAllMocks();m.business.mockResolvedValue(m.tenant);data(0,0);});
describe('Exceptions existing handler pagination with mocked persistence',()=>{
 it('reaches later attempt-only pages',async()=>{data(0,30);const r=await read(2);expect(r.status).toBe(200);expect(r.body.data.map((row:{id:string})=>row.id)).toEqual(Array.from({length:12},(_,i)=>`attempt-${i+12}`));expect(r.body.pagination).toEqual({currentPage:2,totalPages:3,total:30});expect(m.tf).toHaveBeenCalledWith(expect.objectContaining({skip:12,take:12}));});
 it('bounds final-page attempt take by remaining records',async()=>{data(0,30);const r=await read(3);expect(r.body.data).toHaveLength(6);expect(m.tf).toHaveBeenCalledWith(expect.objectContaining({skip:24,take:6}));});
 it('fills transition page attendance first then attempts',async()=>{data(15,20);const r=await read(2);expect(r.body.data.map((row:{id:string})=>row.id)).toEqual(['attendance-12','attendance-13','attendance-14',...Array.from({length:9},(_,i)=>`attempt-${i}`)]);expect(m.af).toHaveBeenCalledWith(expect.objectContaining({skip:12,take:3}));expect(m.tf).toHaveBeenCalledWith(expect.objectContaining({skip:0,take:9}));});
 it('covers each mixed source row exactly once over all pages',async()=>{data(5,30);const ids:string[]=[];for(let p=1;p<=3;p++){const r=await read(p);ids.push(...r.body.data.map((row:{id:string})=>row.id));}expect(ids).toEqual([...attendanceRows(5).map(r=>r.id),...attemptRows(30).map(r=>r.id)]);expect(new Set(ids).size).toBe(35);});
 it('does not query attempts for a full attendance page',async()=>{data(25,30);const r=await read();expect(r.body.data).toHaveLength(12);expect(m.tf).not.toHaveBeenCalled();});
 it.each([[0,0,1],[5,4,20]])('returns truthful empty/out-of-range %s/%s/%s',async(a,t,p)=>{data(a,t);const r=await read(p);expect(r.status).toBe(200);expect(r.body.data).toEqual([]);expect(r.body.pagination.total).toBe(a+t);expect(m.af).not.toHaveBeenCalled();expect(m.tf).not.toHaveBeenCalled();});
 it('keeps tenant predicates, bounds, source filters, order and nullable employee projection',async()=>{data(1,1);const r=await request(app).get('/api/reports/exceptions').set('x-test-role','HR').query({...range,businessId:'forged-business'});expect(r.status).toBe(200);expect(m.business).toHaveBeenCalledWith(m.actor);for(const fn of [m.ac,m.tc,m.af,m.tf])expect(fn.mock.calls[0][0].where.businessId).toBe(m.tenant);const bounds={gte:new Date('2026-11-01T00:00:00Z'),lt:new Date('2026-11-05T00:00:00Z')};expect(m.af.mock.calls[0][0].where.date).toEqual(bounds);expect(m.tf.mock.calls[0][0].where.createdAt).toEqual(bounds);expect(m.tf.mock.calls[0][0].where.locationResult).toEqual({in:['OUTSIDE','UNKNOWN']});expect(m.af.mock.calls[0][0].orderBy).toEqual([{date:'desc'},{clockIn:'desc'}]);expect(m.tf.mock.calls[0][0].orderBy).toEqual({createdAt:'desc'});expect(r.body.data[1]).toEqual(expect.objectContaining({kind:'ATTEMPT',employee:null,locationResult:'UNKNOWN',site:'Reception',kiosk:'Front terminal'}));expect(r.body.data[1]).not.toHaveProperty('attendanceId');expect(r.body.data[1]).not.toHaveProperty('checkInLat');expect(m.audit).not.toHaveBeenCalled();});
});
describe('Existing report route guards',()=>{
 it.each(['HR','SUPERADMIN'])('allows %s',async role=>{expect((await read(1,role)).status).toBe(200);});
 it('refuses STAFF before persistence',async()=>{expect((await read(1,'STAFF')).status).toBe(403);expect(m.business).not.toHaveBeenCalled();});
 it('refuses unauthenticated caller before persistence',async()=>{expect((await request(app).get('/api/reports/exceptions').query(range)).status).toBe(401);expect(m.business).not.toHaveBeenCalled();});
 it('refuses forced-password caller before persistence',async()=>{expect((await request(app).get('/api/reports/exceptions').set('x-test-role','HR').set('x-test-forced','true').query(range)).status).toBe(403);expect(m.business).not.toHaveBeenCalled();});
 it.each([{}, {startDate:'2026-11-04',endDate:'2026-11-01'}, {startDate:'2026-01-01',endDate:'2026-11-04'}, {...range,startDate:'wrong'}, {...range,page:0}, {...range,limit:101}])('rejects invalid query %j before persistence',async query=>{expect((await request(app).get('/api/reports/exceptions').set('x-test-role','HR').query(query)).status).toBe(400);expect(m.business).not.toHaveBeenCalled();});
 it('does not query records for a caller without business',async()=>{m.business.mockResolvedValue(null);expect((await read()).status).toBe(400);expect(m.ac).not.toHaveBeenCalled();});
});
