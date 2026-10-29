import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),db:vi.fn(),person:{employee_id:'1',name:'宮永 ひかり',is_active:true,hire_date:null,termination_date:null,line_contact_url:'https://line.me/old'},assigned:false,updates:[] as {table:string;values:unknown}[]}));
vi.mock('@/lib/line/tags.server',()=>({requireLineAdmin:mocks.admin,loadLineData:vi.fn(),checked:<T extends {error:unknown}>(r:T)=>{if(r.error)throw r.error;return r;}}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.db}));
vi.mock('@/lib/line/richmenu.server',()=>({applyRichMenus:vi.fn(),loadMenuSettings:vi.fn(),syncRichMenus:vi.fn()}));
import { POST } from './route';
beforeEach(()=>{
 mocks.admin.mockResolvedValue({employee_id:'admin'});mocks.assigned=false;mocks.updates=[];
 mocks.db.mockReturnValue({from:(table:string)=>{
  const q={select:()=>q,eq:()=>q,is:()=>q,single:async()=>({data:mocks.person,error:null}),update:(values:unknown)=>{mocks.updates.push({table,values});return q;},then:(resolve:(r:unknown)=>void)=>resolve({error:null,data:table==='system_line_contact'&&mocks.assigned?[{key:'miyanaga'}]:[]})};return q;
 }});
});
const post=(body:object)=>POST(new Request('http://localhost/api/system/line/manage',{method:'POST',body:JSON.stringify(body)}));
it('全権管理者以外は保存できない',async()=>{mocks.admin.mockResolvedValue(null);expect((await post({action:'employeeContact',employeeId:'1',url:'https://line.me/new'})).status).toBe(403);expect(mocks.updates).toHaveLength(0);});
it('追加と変更は名簿の同じ項目に保存する',async()=>{
 expect((await post({action:'employeeContact',employeeId:'1',url:' https://line.me/new '})).status).toBe(200);
 expect(mocks.updates).toEqual([{table:'root_employees',values:{line_contact_url:'https://line.me/new'}}]);
});
it('担当中の人を外せず、担当でなければ外せる',async()=>{
 mocks.assigned=true;
 const blocked=await post({action:'employeeContact',employeeId:'1',url:''});
 expect(blocked.status).toBe(400);expect((await blocked.json()).error).toContain('先にリッチメニュータブ');expect(mocks.updates).toHaveLength(0);
 mocks.assigned=false;expect((await post({action:'employeeContact',employeeId:'1',url:''})).status).toBe(200);
 expect(mocks.updates[0]).toEqual({table:'root_employees',values:{line_contact_url:''}});
});
it('不正なリンクと旧役割へのリンク保存を拒否する',async()=>{
 expect((await post({action:'employeeContact',employeeId:'1',url:'https://example.com/'})).status).toBe(400);
 expect((await post({action:'contact',key:'miyanaga',url:'https://line.me/new'})).status).toBe(400);
 expect(mocks.updates).toHaveLength(0);
});
it('役割は人へ割り当て、空にも戻せる',async()=>{
 expect((await post({action:'assignment',key:'office',employeeId:'1'})).status).toBe(200);
 expect(mocks.updates[0]).toMatchObject({table:'system_line_contact',values:{employee_id:'1'}});
 expect((await post({action:'assignment',key:'office',employeeId:null})).status).toBe(200);
 expect(mocks.updates[1]).toMatchObject({values:{employee_id:null}});
 expect((await post({action:'assignment',key:'guest_home',employeeId:'1'})).status).toBe(400);
});
