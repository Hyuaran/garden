import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({db:vi.fn(),fetch:vi.fn()}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.db}));
import { POST } from './route';
const req=(idToken:unknown)=>new Request('http://localhost/api/liff/me',{method:'POST',body:JSON.stringify({idToken})});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('NEXT_PUBLIC_LIFF_SHIFT_ID','123-test');vi.stubGlobal('fetch',mocks.fetch);});
it('トークンなしは401、外部へ接続しない',async()=>{
  expect((await POST(req(null))).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.db).not.toHaveBeenCalled();
});
it('確認失敗は401、データベースへアクセスしない',async()=>{
  mocks.fetch.mockResolvedValue(new Response('{}',{status:400}));
  expect((await POST(req('invalid'))).status).toBe(401);expect(mocks.db).not.toHaveBeenCalled();
});
it.each([{aud:'other'},{iss:'evil'},{exp:0},{sub:null}])('認証結果の不整合は401 %j',async overrides=>{
  mocks.fetch.mockResolvedValue(Response.json({sub:'U1',aud:'123',iss:'https://access.line.me',exp:Date.now()/1000+100,...overrides}));
  expect((await POST(req('token'))).status).toBe(401);expect(mocks.db).not.toHaveBeenCalled();
});
it.each([null,{name:'山田',is_active:false},{name:'山田',is_active:true,line_link_source:'unfollowed'},{name:'山田',is_active:true}])('確認済みのIDで従業員を探す %j',async employee=>{
  mocks.fetch.mockResolvedValue(Response.json({sub:'U1',aud:'123',iss:'https://access.line.me',exp:Date.now()/1000+100}));
  const q={select:vi.fn(()=>q),eq:vi.fn(()=>q),is:vi.fn(()=>q),maybeSingle:vi.fn(async()=>({data:employee,error:null}))};
  mocks.db.mockReturnValue({from:()=>q});
  const r=await POST(req('token'));
  expect(q.eq).toHaveBeenCalledWith('line_user_id','U1');
  expect(r.status).toBe(employee?.is_active&&employee?.line_link_source!=='unfollowed'?200:403);
  expect(mocks.fetch.mock.calls[0][1].body.toString()).toContain('client_id=123');
});
