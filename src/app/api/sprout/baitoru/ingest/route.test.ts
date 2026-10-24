import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({ingest:vi.fn(),report:vi.fn()}));
vi.mock('@/lib/sprout/baitoru.server',()=>({ingestBaitoru:m.ingest,reportBaitoruFailure:m.report}));
import {POST} from './route';
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('RELAY_SECRET','secret');m.ingest.mockResolvedValue({ok:true});});
const request=(token:string,body:unknown)=>new Request('http://localhost/api/sprout/baitoru/ingest',{method:'POST',headers:{authorization:token},body:JSON.stringify(body)});
it('requires the relay bearer secret, including length and unset checks',async()=>{
 for(const token of ['', 'Bearer wrong','Bearer secret-too-long','Basic secret'])expect((await POST(request(token,{rows:[]}))).status).toBe(401);
 vi.stubEnv('RELAY_SECRET','');expect((await POST(request('Bearer ',{rows:[]}))).status).toBe(401);expect(m.ingest).not.toHaveBeenCalled();
});
it('validates CSV rows and dryRun without treating string false as live',async()=>{
 for(const body of [{rows:null},{rows:[null]},{rows:[{name:1}]},{rows:[],dryRun:'false'}])expect((await POST(request('Bearer secret',body))).status).toBe(400);
 expect(m.ingest).not.toHaveBeenCalled();
 expect((await POST(request('Bearer secret',{rows:[{'問合せNo':'1'}],dryRun:true}))).status).toBe(200);expect(m.ingest).toHaveBeenCalledWith([{'問合せNo':'1'}],true);
});
it('hides internal failures and returns 500',async()=>{
 m.ingest.mockRejectedValue(new Error('secret database details'));const r=await POST(request('Bearer secret',{rows:[]}));expect(r.status).toBe(500);expect(await r.text()).not.toContain('secret database');
});

it('accepts empty-row failure reports and rejects mixed or malformed reports',async()=>{
 m.report.mockResolvedValue({ok:true});
 expect((await POST(request('Bearer secret',{rows:[],error:'download failed'}))).status).toBe(200);
 expect(m.report).toHaveBeenCalledOnce();expect(m.ingest).not.toHaveBeenCalled();
 for(const body of [{rows:[],error:''},{rows:[],error:123},{rows:[{a:'b'}],error:'failed'},{rows:[],error:'failed',dryRun:true}])expect((await POST(request('Bearer secret',body))).status).toBe(400);
});
