import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({admin:vi.fn(),from:vi.fn(),insert:vi.fn(),update:vi.fn(),single:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/line/tags.server',()=>({requireLineAdmin:m.admin,checked:(r:{error:unknown})=>{if(r.error)throw r.error;return r;}}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:()=>({from:m.from})}));
import {GET,POST} from './route';
const id='11111111-1111-1111-1111-111111111111';
const req=(b:object)=>new Request('http://test',{method:'POST',body:JSON.stringify(b)});
beforeEach(()=>{
  vi.resetAllMocks();m.admin.mockResolvedValue({employee_id:'admin'});
  const q={select:()=>q,eq:m.eq,in:()=>q,order:async()=>({data:[],error:null}),single:m.single,then:(resolve:(v:object)=>void)=>resolve({error:null})};
  m.eq.mockReturnValue(q);m.single.mockResolvedValue({data:{id},error:null});
  m.insert.mockReturnValue(q);m.update.mockReturnValue(q);m.from.mockReturnValue({...q,insert:m.insert,update:m.update});
});
it('管理者以外は閲覧と変更ができない',async()=>{
  m.admin.mockResolvedValue(null);expect((await GET()).status).toBe(403);
  expect((await POST(req({action:'code'}))).status).toBe(403);expect(m.from).not.toHaveBeenCalled();
});
it('数字4けたの確認コードを24時間有効で保存する',async()=>{
  const now=Date.now();const r=await POST(req({action:'code',label:'A',room:'123',notify:false}));
  expect(r.status).toBe(200);const result=await r.json();expect(result.code).toMatch(/^G-\d{4}$/);
  const saved=m.insert.mock.calls[0][0];expect(saved).toMatchObject({account:'dev',label:'A',chatwork_room_id:'123',link_code:result.code});
  expect(Date.parse(saved.link_code_expires_at)-now).toBeGreaterThanOrEqual(86400000);
  expect(Date.parse(saved.link_code_expires_at)-now).toBeLessThan(86401000);
});
it('コード衝突時に作り直す',async()=>{
  m.single.mockResolvedValueOnce({error:{code:'23505'}});
  expect((await POST(req({action:'code',label:'A',room:'',notify:false}))).status).toBe(200);expect(m.insert).toHaveBeenCalledTimes(2);
});
it('名前・ルーム・オンオフを保存する',async()=>{
  expect((await POST(req({action:'save',id,label:'B',room:'456',notify:true}))).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({label:'B',chatwork_room_id:'456',notify_enabled:true});
});
it('数字以外のルームを拒否する',async()=>{
  expect((await POST(req({action:'code',label:'A',room:'123/x',notify:false}))).status).toBe(400);expect(m.insert).not.toHaveBeenCalled();
});
it('確認してから記録を外しコードと通知を無効にする',async()=>{
  expect((await POST(req({action:'remove',id}))).status).toBe(400);
  expect((await POST(req({action:'remove',id,confirm:true}))).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({active:false,notify_enabled:false,link_code:null,link_code_expires_at:null});
});
