import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks=vi.hoisted(()=>({notice:vi.fn(),admin:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/relay/monitor.server",()=>({sendGardenNotice:mocks.notice}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { FM_FILES, overallStatus, resultState, requestFilemakerAccount, agentWork, applyAgentResults, reconcileRequest, checkFilemakerRequests, notificationKind, type AccountRequest, type FileState } from "./filemaker-accounts.server";
import { initialPassword } from "@/lib/initial-password";
import { GET, POST } from "@/app/api/system/filemaker-accounts/agent/route";
import { GET as cron } from "@/app/api/system/filemaker-accounts/cron/route";
const id="12345678-1234-4234-8234-123456789012";
const at="2026-10-27T00:00:00.000Z";
const roster={lastName:"山田",firstName:"太郎",lastNameKana:"ヤマダ",firstNameKana:"タロウ",employmentType:"正社員",employeeNumber:"1571",hireDate:"2026-10-27"};
function files(status:FileState["status"]){return Object.fromEntries(FM_FILES.map(k=>[k,{status,at}])) as AccountRequest["files"];}
function row():AccountRequest{return {id,hire_candidate_id:"candidate",account_name:"山田　太郎",files:files("waiting"),status:"waiting",failure_notified_at:null,stuck_notified_at:null,updated_at:at};}
// Small PostgREST double that actually applies filters and conditional updates.
function database(requests:AccountRequest[]=[row()]){
 const updates=vi.fn();
 const data:Record<string,Record<string,unknown>[]>={system_filemaker_account_requests:requests,system_hire_candidates:[{id:"candidate",status:"hired",last_name:"山田",first_name:"太郎",last_name_kana:"ヤマダ",first_name_kana:"タロウ",employment_type:"正社員",employee_number:"1571",hire_date:"2026-10-27",birthday:"2000-02-03",employee_id:"EMP",checklist:{nda_sent:{checked_at:at,checked_by:"human"}}}],root_employees:[{id:"uuid",employee_id:"EMP"}]};
 const db={from:(name:string)=>{
  let patch:Record<string,unknown>|undefined,insert:Record<string,unknown>|undefined,single=false;
  const filters:((r:Record<string,unknown>)=>boolean)[]=[];
  const q={select:()=>q,order:()=>q,limit:()=>q,
   eq:(key:string,value:unknown)=>{filters.push(r=>typeof r[key]==="object"?JSON.stringify(r[key])===value:r[key]===value);return q;},
   in:(key:string,values:unknown[])=>{filters.push(r=>values.includes(r[key]));return q;},
   is:(key:string,value:unknown)=>{filters.push(r=>{const [column,field]=key.split("->");return ((r[column] as Record<string,unknown>|null)?.[field]??null)===value;});return q;},
   or:(expression:string)=>{
    const match=expression.match(/^status\.in\.\(waiting,sent,failed\),and\(status\.eq\.done,updated_at\.gte\.(.+)\)$/);
    if(!match)throw new Error(`Unexpected filter: ${expression}`);
    filters.push(r=>["waiting","sent","failed"].includes(String(r.status))||(r.status==="done"&&String(r.updated_at)>=match[1]));return q;
   },
   update:(value:Record<string,unknown>)=>{updates(name,value);patch=value;return q;},insert:(value:Record<string,unknown>)=>{insert=value;return q;},
   single:()=>{single=true;return q;},maybeSingle:()=>{single=true;return q;},
   then:(resolve:(value:unknown)=>unknown)=>{
    if(insert)data[name].push({id,...insert});
    const found=data[name].filter(r=>filters.every(f=>f(r)));
    if(patch)found.forEach(r=>Object.assign(r,patch));
    return Promise.resolve({data:structuredClone(single?found[0]??null:found),error:null}).then(resolve);
   }};return q;
 }};
 return {db:db as unknown as SupabaseClient,data,updates};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("RELAY_SECRET","secret");vi.stubEnv("CRON_SECRET","cron");mocks.notice.mockResolvedValue(undefined);});
it("completes roster immediately with employee ID and preserves success",async()=>{
 const r=row();const {db}=database([r]);
 await applyAgentResults(db,[{id,file:"roster",step:"sent"}]);
 expect(r.files.roster.status).toBe("sent");
 await applyAgentResults(db,[{id,file:"roster",step:"checked",fmStatus:"1573"}]);
 expect(r.files.roster).toMatchObject({status:"done",fm_status:"1573"});
 await applyAgentResults(db,[{id,file:"roster",step:"checked",error:"late failure"}]);
 expect(r.files.roster.status).toBe("done");
 expect((await agentWork(db)).jobs[0]).not.toHaveProperty("roster");
});
it("queues roster on completed legacy requests and accepts results without prior GET",async()=>{
 const r={...row(),status:"done" as const,files:files("done")};
 delete (r.files as Partial<AccountRequest["files"]>).roster;
 expect(overallStatus(r.files)).toBe("waiting");
 const {db}=database([r]);
 expect((await agentWork(db)).jobs).toEqual([{id,accountName:r.account_name,password:"gd0203",files:["roster"],roster}]);
 await applyAgentResults(db,[{id,file:"roster",step:"checked",fmStatus:"1571"}]);
 expect(r.files.roster).toMatchObject({status:"done",fm_status:"1571"});
});
it.each(["employee_number","last_name_kana","first_name_kana"])("fails invalid roster %s while allowing accounts",async field=>{
 const r=row();const {db,data}=database([r]);data.system_hire_candidates[0][field]="";
 const work=await agentWork(db);
 expect(r.files.roster).toMatchObject({status:"failed",error:"入社情報（社員番号・カナ）を確認してください"});
 expect(work.jobs[0].files).toEqual(["eigyo","shain","call"]);
 expect(work.jobs[0]).not.toHaveProperty("roster");
});
it.each([["waiting","waiting"],["sent","sent"],["failed","failed"],["done","done"]] as const)("aggregates %s",(state,expected)=>expect(overallStatus(files(state))).toBe(expected));
it("prioritizes failures over sent and requires all three done",()=>{
 const f=files("done");f.call={status:"sent",at};expect(overallStatus(f)).toBe("sent");f.shain={status:"failed",at};expect(overallStatus(f)).toBe("failed");
});
it.each([["0","done"],["1702","failed"],["","sent"],["pending","sent"]] as const)("interprets FM status %s",(fmStatus,expected)=>{
 const state=resultState({status:"sent",at},{id,file:"call",step:"checked",fmStatus});expect(state.status).toBe(expected);
 if(fmStatus==="1702")expect(state.error).toBe("エラー 1702");
});
it("preserves success and reports ODBC failures",()=>{
 expect(resultState({status:"done",at},{id,file:"call",step:"sent"}).status).toBe("done");
 expect(resultState({status:"waiting",at},{id,file:"call",step:"checked",error:"ODBC"})).toMatchObject({status:"failed",error:"ODBC"});
});
it.each([["2000-02-03","gd0203"],["1990-12-31","gd1231"],[null,null]])("uses shared roster password for %s",(birthday,password)=>expect(initialPassword(birthday)).toBe(password));
it("retries only unfinished files, keeps notice markers and stores no password",async()=>{
 const r=row();r.files.eigyo={status:"done",at};r.failure_notified_at=at;r.status="failed";
 const {db,data}=database([r]);await requestFilemakerAccount(db,"candidate","admin");
 expect(r.files.eigyo.status).toBe("done");expect(r.files.call.status).toBe("waiting");expect(r.failure_notified_at).toBe(at);
 expect(data.system_filemaker_account_requests[0]).toMatchObject({employee_id:"EMP",requested_by:"admin",account_name:"山田　太郎"});
 expect(JSON.stringify(data.system_filemaker_account_requests)).not.toContain("gd0203");
 data.system_hire_candidates[0].status="planned";await expect(requestFilemakerAccount(db,"candidate","admin")).rejects.toThrow("入社済み");
});
it("produces jobs and checks and generates password only for the response",async()=>{
 const r=row();r.files.call={status:"sent",at};const {db}=database([r]);
 expect(await agentWork(db)).toEqual({jobs:[{id,accountName:"山田　太郎",password:"gd0203",files:["eigyo","shain","roster"],roster}],checks:[{id,files:["call"]}]});
});
it.each(["missing birthday","not hired"])("isolates invalid candidate work: %s",async(reason)=>{
 const invalid=row();invalid.files.call={status:"sent",at};
 const valid={...row(),id:"valid-request",hire_candidate_id:"valid-candidate"};
 const {db,data}=database([invalid,valid]);
 data.system_hire_candidates.push({...data.system_hire_candidates[0],id:"valid-candidate"});
 if(reason==="missing birthday")data.system_hire_candidates[0].birthday=null;
 else data.system_hire_candidates[0].status="planned";
 const work=await agentWork(db);
 expect(work.jobs).toContainEqual({id:"valid-request",accountName:valid.account_name,password:"gd0203",files:FM_FILES,roster});
 expect(work.jobs.filter(j=>j.id===id)).toEqual(reason==="missing birthday"?[{id,accountName:invalid.account_name,password:"",files:["roster"],roster}]:[]);
 expect(work.checks).toEqual([{id,files:["call"]}]);
 expect(invalid.status).toBe("failed");
 for(const file of ["eigyo","shain"] as const)expect(invalid.files[file]).toMatchObject({status:"failed",error:"入社情報（誕生日）を確認してください"});
 expect(invalid.files.call.status).toBe("sent");
 expect(mocks.notice).toHaveBeenCalledTimes(1);
 expect(invalid.failure_notified_at).not.toBeNull();
});
it("checks active requests and only done requests updated within two days",async()=>{
 const now=Date.now();
 const requests=(["waiting","sent","failed","done","done","done"] as const).map((status,i)=>({
  ...row(),id:`request-${i}`,hire_candidate_id:`candidate-${i}`,status,files:files(status),
  updated_at:new Date(now-(i===4?2*24*60*60_000:i===5?2*24*60*60_000+1:24*60*60_000)).toISOString(),
 }));
 const {db,data}=database(requests);
 for(let i=3;i<6;i++)data.system_hire_candidates.push({...data.system_hire_candidates[0],id:`candidate-${i}`});
 const date=vi.spyOn(Date,"now").mockReturnValue(now);
 try{
  expect(await checkFilemakerRequests(db)).toEqual({ok:true,checked:5});
  expect(data.system_hire_candidates.find(c=>c.id==="candidate-3")?.checklist).toHaveProperty("filemaker_added");
  expect(data.system_hire_candidates.find(c=>c.id==="candidate-4")?.checklist).toHaveProperty("filemaker_added");
  expect(data.system_hire_candidates.find(c=>c.id==="candidate-5")?.checklist).not.toHaveProperty("filemaker_added");
 }finally{date.mockRestore();}
});
it("does not update a manually checked checklist",async()=>{
 const r={...row(),status:"done" as const,files:files("done")};
 const {db,data,updates}=database([r]);
 const checklist={nda_sent:{checked_at:at,checked_by:"human"},filemaker_added:{checked_at:at,checked_by:"manual"}};
 data.system_hire_candidates[0].checklist=checklist;
 await reconcileRequest(db,id);
 expect(data.system_hire_candidates[0].checklist).toEqual(checklist);
 expect(updates).not.toHaveBeenCalled();
});
it("notifies a failure once, preserves it across retry, merges checklist and recovers once",async()=>{
 const {db,data}=database();const failure={id,file:"shain" as const,step:"checked" as const,fmStatus:"1702"};
 await applyAgentResults(db,[failure]);await applyAgentResults(db,[failure]);
 expect(mocks.notice).toHaveBeenCalledTimes(1);expect(mocks.notice.mock.calls[0][0]).toContain("社員情報：エラー 1702");
 await requestFilemakerAccount(db,"candidate","admin");
 await applyAgentResults(db,FM_FILES.map(file=>({id,file,step:"checked",fmStatus:"0"})));
 await reconcileRequest(db,id);
 expect(mocks.notice).toHaveBeenCalledTimes(2);expect(mocks.notice.mock.calls[1][0]).toContain("作れました");
 expect(data.system_hire_candidates[0].checklist).toMatchObject({nda_sent:{checked_by:"human"},filemaker_added:{checked_by:"自動（FileMaker）"}});
});
it("detects 30 minutes per pending file, not the last poll, and sends once",async()=>{
 const r=row();r.updated_at=new Date().toISOString();const {db}=database([r]);
 expect(notificationKind(r,Date.parse(at)+29*60_000)).toBeNull();
 expect(notificationKind(r,Date.parse(at)+31*60_000)).toBe("stuck");
 await reconcileRequest(db,id);await reconcileRequest(db,id);expect(mocks.notice).toHaveBeenCalledTimes(1);
});
it("releases notification marker when delivery throws",async()=>{
 const r=row();r.status="failed";r.files.shain={status:"failed",at,error:"ODBC"};const {db}=database([r]);
 mocks.notice.mockRejectedValueOnce(new Error("network"));await reconcileRequest(db,id);expect(r.failure_notified_at).toBeNull();
 await reconcileRequest(db,id);expect(mocks.notice).toHaveBeenCalledTimes(2);
});
it("claims a notification once across concurrent reconciliation",async()=>{
 const r=row();r.status="failed";r.files.shain={status:"failed",at,error:"ODBC"};const {db}=database([r]);
 await Promise.all([reconcileRequest(db,id),reconcileRequest(db,id)]);
 expect(mocks.notice).toHaveBeenCalledTimes(1);
});
it("does not starve queued work behind old failures",async()=>{
 const failed=Array.from({length:60},(_,i)=>({...row(),id:String(i),status:"failed" as const,files:files("failed")}));
 const {db}=database([...failed,row()]);
 expect((await agentWork(db)).jobs).toHaveLength(1);
});
it("rejects unauthenticated GET, POST and cron before database access",async()=>{
 expect((await GET(new Request("https://example.test"))).status).toBe(401);
 expect((await POST(new Request("https://example.test",{method:"POST"}))).status).toBe(401);
 expect((await cron(new Request("https://example.test"))).status).toBe(401);
 expect(mocks.admin).not.toHaveBeenCalled();
});
it("serves GET shape with no-store and accepts validated POST results",async()=>{
 const {db,data}=database();mocks.admin.mockReturnValue(db);
 const headers={Authorization:"Bearer secret"};
 const response=await GET(new Request("https://example.test",{headers}));
 expect(response.headers.get("cache-control")).toBe("no-store");expect((await response.json()).jobs[0]).toMatchObject({password:"gd0203",roster});
 const post=(results:unknown)=>POST(new Request("https://example.test",{method:"POST",headers,body:JSON.stringify({results})}));
 expect((await post([{id,file:"call",step:"sent"}])).status).toBe(200);
 expect(data.system_filemaker_account_requests[0].status).toBe("sent");
 expect((await post([{id,file:"unknown",step:"sent"}])).status).toBe(400);
});
