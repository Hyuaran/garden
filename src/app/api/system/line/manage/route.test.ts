import { beforeEach, expect,it,vi } from 'vitest';
import { createHmac } from 'node:crypto';
vi.mock('@/lib/line/richmenu.server',()=>({syncRichMenus:vi.fn(async()=>{}),applyRichMenus:vi.fn(async()=>{}),loadMenuSettings:vi.fn(async()=>({contacts:[],menus:[]}))}));
const mocks=vi.hoisted(()=>({admin:vi.fn(),load:vi.fn(),db:vi.fn(),quota:vi.fn(),push:vi.fn()}));
vi.mock('@/lib/line/tags.server',()=>({requireLineAdmin:mocks.admin,loadLineData:mocks.load,checked:(r:{error:unknown})=>{if(r.error)throw r.error;return r;}}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.db}));
vi.mock('@/lib/line/staff-client',()=>({getLineStaffQuota:mocks.quota,pushLineStaff:mocks.push}));
import { GET,POST } from './route';
beforeEach(()=>{vi.resetAllMocks();process.env.LINE_STAFF_CHANNEL_SECRET='test-secret';});
const request=(body:object)=>new Request('http://localhost/api/system/line/manage',{method:'POST',body:JSON.stringify(body)});
it('全権管理者以外のすべての入口を403にする',async()=>{
 mocks.admin.mockResolvedValue(null);
 expect((await GET()).status).toBe(403);
 for(const action of ['tag','member','team','contact','applyMenus','greeting','test','preview','send'])expect((await POST(request({action}))).status).toBe(403);
 expect(mocks.db).not.toHaveBeenCalled();expect(mocks.push).not.toHaveBeenCalled();
});
it('確認時に人数と残り通数を返し、送信をしない',async()=>{
 mocks.admin.mockResolvedValue({employee_id:'admin'});
 const e={employee_id:'1',employee_number:'0001',name:'山田',is_active:true,line_user_id:'U1',hire_date:null,termination_date:null,line_link_source:'self'};
 mocks.load.mockResolvedValue({employees:[e,{...e,employee_id:'2',line_user_id:null}],tags:[],members:[]});
 mocks.quota.mockResolvedValue({remaining:10});
 mocks.db.mockReturnValue({from:()=>({insert:()=>({select:()=>({single:async()=>({data:{id:'draft'},error:null})})})})});
 const r=await POST(request({action:'preview',title:'連絡',body:'本文',tagIds:[]}));
 expect(r.status).toBe(200);expect(await r.json()).toMatchObject({people:[e],remaining:10,id:'draft'});expect(mocks.quota).toHaveBeenCalledTimes(1);expect(mocks.push).not.toHaveBeenCalled();
});
it('残り通数が足りなければ確認を止める',async()=>{
 mocks.admin.mockResolvedValue({employee_id:'admin'});mocks.db.mockReturnValue({});
 mocks.load.mockResolvedValue({employees:[{employee_id:'1',is_active:true,line_user_id:'U1'}],tags:[],members:[]});mocks.quota.mockResolvedValue({remaining:0});
 expect((await POST(request({action:'preview',title:'題',body:'文',tagIds:[]}))).status).toBe(400);expect(mocks.push).not.toHaveBeenCalled();
});
it('確認した人に500人ずつ送り、同じ確認からは二度送らない',async()=>{
 mocks.admin.mockResolvedValue({employee_id:'admin'});
 const employees=Array.from({length:1001},(_,i)=>({employee_id:String(i),line_user_id:`U${i}`,is_active:true}));
 mocks.load.mockResolvedValue({employees,tags:[],members:[]});mocks.push.mockResolvedValue(undefined);
 let claimed=false; const updates:object[]=[];
 mocks.db.mockReturnValue({from:()=>({update:(row:object)=>{updates.push(row);const query={eq:()=>query,is:()=>query,select:async()=>{const data=claimed?[]:[{id:'draft'}];claimed=true;return {data,error:null};},then:(resolve:(r:object)=>void)=>resolve({data:null,error:null})};return query;}})});
 const expires=Date.now()+60000;const content=JSON.stringify({ids:employees.map(e=>e.line_user_id).sort(),title:'題',body:'文',tagIds:[],actor:'admin'});
 const signature=createHmac('sha256','test-secret').update(content+'draft'+expires).digest('hex');
 const body={action:'send',title:'題',body:'文',tagIds:[],id:'draft',expires,signature};
 expect((await POST(request(body))).status).toBe(200);
 expect(mocks.push.mock.calls.map(c=>c[0].length)).toEqual([500,500,1]);
 expect(updates).toContainEqual({sent_count:1001,failed_count:0});
 expect((await POST(request(body))).status).toBe(400);expect(mocks.push).toHaveBeenCalledTimes(3);
});
