import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),denied:vi.fn(),db:vi.fn(),sync:vi.fn()}));
vi.mock('@/app/system/mypage/_lib/submission-server',()=>({requireAdmin:mocks.admin}));
vi.mock('@/lib/auth/view-permission.server',()=>({systemViewResponse:mocks.denied}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.db}));
vi.mock('@/lib/line/richmenu.server',()=>({syncRichMenus:mocks.sync}));
import { GET, POST, PATCH, DELETE } from './route';
const context={params:Promise.resolve({employeeId:'E1'})};
let rows:Record<string,unknown>[];
beforeEach(()=>{
  vi.resetAllMocks();rows=[];mocks.admin.mockResolvedValue({employee_id:'A1'});mocks.denied.mockResolvedValue(null);mocks.sync.mockResolvedValue(undefined);
  mocks.db.mockReturnValue({from:(table:string)=>{
    const filters:Record<string,unknown>={};let op='read',payload:Record<string,unknown>={};
    const result=()=>{
      if(table==='root_employees')return {data:{employee_id:'E1'},error:null};
      let found=rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
      if(op==='insert'){found=[{id:'new',...payload}];rows.push(...found);}
      if(op==='update')found.forEach(r=>Object.assign(r,payload));
      if(op==='delete')rows=rows.filter(r=>!found.includes(r));
      return {data:found,error:null};
    };
    const q={select:()=>q,order:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},is:()=>q,maybeSingle:async()=>{const r=result();return {...r,data:Array.isArray(r.data)?r.data[0]??null:r.data};},insert:(p:Record<string,unknown>)=>{op='insert';payload=p;return q;},update:(p:Record<string,unknown>)=>{op='update';payload=p;return q;},delete:()=>{op='delete';return q;},then:(resolve:(r:unknown)=>void)=>resolve(result())};return q;
  }});
});
const request=(method:string,body:object)=>new Request('http://localhost/api/root/employees/E1/team-history',{method,body:JSON.stringify(body)});
it('編集権限がなければDBもLINEも操作しない',async()=>{
  mocks.admin.mockResolvedValue(null);
  for(const handler of [POST,PATCH,DELETE])expect((await handler(request('POST',{}),context)).status).toBe(403);
  expect(mocks.db).not.toHaveBeenCalled();expect(mocks.sync).not.toHaveBeenCalled();
});
it('閲覧権限がなければ履歴を返さない',async()=>{
  mocks.denied.mockResolvedValue(Response.json({}, {status:403}));
  expect((await GET(new Request('http://localhost'),context)).status).toBe(403);expect(mocks.db).not.toHaveBeenCalled();
});
it('所属を追加・修正・削除し、その社員だけLINEに反映する',async()=>{
  expect((await POST(request('POST',{effective_date:'2026-10-29',team:'新人チーム'}),context)).status).toBe(200);
  expect(rows[0]).toMatchObject({source:'garden',entered_by:'A1',employee_id:'E1'});
  expect((await PATCH(request('PATCH',{id:'new',effective_date:'2026-10-29',team:'小泉チーム'}),context)).status).toBe(200);
  expect(rows[0].team).toBe('小泉チーム');
  expect((await DELETE(request('DELETE',{id:'new'}),context)).status).toBe(200);expect(rows).toEqual([]);
  expect(mocks.sync).toHaveBeenCalledTimes(3);expect(mocks.sync).toHaveBeenLastCalledWith('E1');
});
it('Kintoneの行は修正も削除も拒否する',async()=>{
  rows=[{id:'k',employee_id:'E1',source:'kintone'}];
  expect((await PATCH(request('PATCH',{id:'k',effective_date:'2026-10-29',team:'所属なし'}),context)).status).toBe(403);
  expect((await DELETE(request('DELETE',{id:'k'}),context)).status).toBe(403);expect(mocks.sync).not.toHaveBeenCalled();
});
it('不正な入力は拒否する',async()=>{
  expect((await POST(request('POST',{effective_date:'2026-02-30',team:'新人チーム'}),context)).status).toBe(400);expect(mocks.db).not.toHaveBeenCalled();
});
