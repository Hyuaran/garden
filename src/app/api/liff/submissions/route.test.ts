import {beforeEach, expect, it, vi} from 'vitest';
const m=vi.hoisted(()=>({verify:vi.fn(),db:vi.fn(),create:vi.fn()}));
vi.mock('@/lib/line/liff-verify.server',()=>({verifyLiffEmployee:m.verify}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:m.db}));
vi.mock('@/app/system/mypage/_lib/create-submission.server',()=>({createSubmission:m.create}));
import {GET,POST} from './route';
const req=(body:unknown)=>new Request('http://localhost/api/liff/submissions',{method:'POST',headers:{Authorization:'Bearer token'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();m.verify.mockResolvedValue({employee_id:'E1',name:'山田 太郎',employee_number:'1'});});
it.each([401,403])('auth failure %i stops storage',async status=>{
 m.verify.mockResolvedValue(Response.json({}, {status}));
 expect((await POST(req({submission_type:'bank_account'}))).status).toBe(status);expect(m.db).not.toHaveBeenCalled();
});
it('lists only own two types, newest ten',async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),limit:vi.fn().mockResolvedValue({data:[],error:null})};m.db.mockReturnValue({from:()=>q});
 const r=await GET(new Request('http://localhost/api/liff/submissions',{headers:{Authorization:'Bearer token'}}));
 expect(r.status).toBe(200);expect(q.eq).toHaveBeenCalledWith('employee_id','E1');expect(q.in).toHaveBeenCalledWith('submission_type',['commute_route','bank_account']);expect(q.order).toHaveBeenCalledWith('created_at',{ascending:false});expect(q.limit).toHaveBeenCalledWith(10);expect(m.verify).toHaveBeenCalledWith('token');
});
it('rejects other types before saving',async()=>{expect((await POST(req({submission_type:'nda'}))).status).toBe(400);expect(m.create).not.toHaveBeenCalled();});
it('shared limiter rejects the sixth request',async()=>{
 const rpc=vi.fn().mockResolvedValue({data:true,error:null});rpc.mockResolvedValueOnce({data:false,error:null});m.db.mockReturnValue({rpc});
 const r=await POST(req({submission_type:'commute_route'}));expect(r.status).toBe(429);expect((await r.json()).error).toBe('少し時間をおいてから送信してください');expect(m.create).not.toHaveBeenCalled();
});
it.each(['commute_route','bank_account'])('delegates %s to the mypage save function',async type=>{
 m.db.mockReturnValue({rpc:vi.fn().mockResolvedValue({data:true,error:null})});m.create.mockResolvedValue(Response.json({ok:true},{status:201}));
 expect((await POST(req({submission_type:type,payload:{station:'駅'}}))).status).toBe(201);
 expect(m.create).toHaveBeenCalledWith(expect.objectContaining({employee_id:'E1'}),{type,payload:{station:'駅'}});
});
it('fails closed if the limiter is unavailable',async()=>{m.db.mockReturnValue({rpc:vi.fn().mockResolvedValue({error:{message:'offline'}})});expect((await POST(req({submission_type:'bank_account'}))).status).toBe(503);expect(m.create).not.toHaveBeenCalled();});
