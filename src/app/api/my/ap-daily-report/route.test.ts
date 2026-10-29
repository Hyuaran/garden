import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),admin:vi.fn(),send:vi.fn(),writes:[] as Record<string,unknown>[],sent:0}));
vi.mock('@/app/_lib/supabase/server',()=>({createServerClient:mocks.session}));
vi.mock('@/lib/supabase/admin',()=>({getSupabaseAdmin:mocks.admin}));
vi.mock('@/lib/chatwork/client',()=>({ChatworkClient:class {sendMessage=mocks.send;}}));
import { GET, POST } from './route';
const input={report_date:'2026-10-28',kind:'closer',start_time:'14:00',end_time:'21:00',work_minutes:420,count:4,month_total:7,reflection:'改善する',employee_id:'forged',calls:9999};
function query(data:unknown) { const q:Record<string,unknown>={}; for(const m of ['select','eq','is','gte','lte','lt','order']) q[m]=vi.fn(()=>q); q.maybeSingle=vi.fn(async()=>({data,error:null})); q.single=vi.fn(async()=>({data:{id:'R1'},error:null}));q.then=(resolve:(v:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve);return q; }
describe('AP日報 API（外部送信はモック）',()=>{
 beforeEach(()=>{
  mocks.writes=[];mocks.sent=0;mocks.admin.mockClear();
  vi.stubEnv('AP_DAILY_REPORT_CHATWORK_ROOM_ID','test-room');vi.stubEnv('CHATWORK_API_TOKEN','test-token');
  mocks.send.mockReset().mockResolvedValue({message_id:'M1'});
  mocks.session.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'U1'}}})},from:()=>query({employee_id:'E1',employee_number:'001',name:'谷本　花子',garden_role:'closer',is_active:true,deleted_at:null,termination_date:null})});
  mocks.admin.mockReturnValue({from:(table:string)=>{
    if(table==='root_employees') return query([{employee_id:'E1',name:'谷本　花子',filemaker_employee_name:'谷本',is_active:true}]);
    if(table==='system_attendance_punches') return query([{punch_type:'clock_in',punched_at:'2026-10-28T14:00:00+09:00'},{punch_type:'clock_out',punched_at:'2026-10-28T21:00:00+09:00'}]);
    const q=query(mocks.sent ? [{...input,sent_count:mocks.sent,auto_count:2,work_minutes:420}] : []);
    q.upsert=vi.fn((value:Record<string,unknown>)=>{mocks.writes.push(value);return q;});q.update=vi.fn((value:Record<string,unknown>)=>{mocks.writes.push(value);return q;});return q;
  },rpc:vi.fn(async()=>({data:{authorized:true,employee_metrics:[{employee_name:'谷本',call_count:195,effective_count:70,absent_count:52,away_count:99,prospect_count:17,acquired_count:2,toss_count:1}],metrics:[]},error:null}))});
 });
 it('本人の自動値と月の打刻を取得',async()=>{
   const response=await GET(new Request('http://localhost/api/my/ap-daily-report?date=2026-10-28'));
   const d=await response.json();expect(response.status).toBe(200);/* 留守＝away_count（担不の absent_count は使わない） */expect(d.auto).toMatchObject({calls:195,absent:99,prospect:17,closer:2,toss:1,work_minutes:420});expect(d.auto.effective_rate).toBeCloseTo(70/195*100);expect(d.monthMinutes).toBe(420);
 });
 it('改ざんした本人・コール値を無視し、訂正した獲得数を保存・送信',async()=>{
   const response=await POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(input)}));
   expect(response.status).toBe(200);expect(mocks.writes[0]).toMatchObject({employee_id:'E1',calls:195,count:4,auto_count:2});expect(mocks.send).toHaveBeenCalledWith('test-room',expect.stringContaining('本日獲得　4件'));expect(mocks.writes[1]).toMatchObject({sent_count:1,chatwork_message_id:'M1'});
 });
 it('2回目は訂正',async()=>{mocks.sent=1;await POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(input)}));expect(mocks.send).toHaveBeenCalledWith('test-room',expect.stringMatching(/^（訂正）/));});
 it('送信失敗は保存済みの200とchatwork_error、sent_countを増やさない',async()=>{
  mocks.send.mockRejectedValue(new Error('network'));const response=await POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(input)}));expect(response.status).toBe(200);expect((await response.json()).chatwork_error).toBeTruthy();expect(mocks.writes[0]).toBeDefined();expect(mocks.writes[1]).not.toHaveProperty('sent_count');
 });
 it('設定なしでは送らない',async()=>{vi.stubEnv('AP_DAILY_REPORT_CHATWORK_ROOM_ID','');const response=await POST(new Request('http://localhost',{method:'POST',body:JSON.stringify(input)}));expect((await response.json()).chatwork_error).toBe('Chatwork の設定がありません');expect(mocks.send).not.toHaveBeenCalled();});
 it('未ログインは取得・保存不可',async()=>{mocks.session.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await GET(new Request('http://localhost'))).status).toBe(401);expect((await POST(new Request('http://localhost',{method:'POST',body:'{}'}))).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();});
});
