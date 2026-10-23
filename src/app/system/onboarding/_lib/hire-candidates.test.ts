import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextEmployeeNumber, parseHireInput, rosterPayload, type HireCandidate } from "./hire-candidates";
const mocks = vi.hoisted(()=>({server:vi.fn(),admin:vi.fn(),employees:vi.fn(),create:vi.fn(),records:vi.fn(),record:vi.fn(),sync:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/app/_lib/supabase/server",()=>({createServerClient:mocks.server}));
vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
vi.mock("@/app/root/_lib/kot-api",()=>({fetchKotHireEmployees:mocks.employees,createKotEmployee:mocks.create,fetchKotHireOptions:vi.fn()}));
vi.mock("@/lib/kintone/records",()=>({getAllRecords:mocks.records,createRecord:mocks.record}));
vi.mock("@/app/root/_lib/roster-sync.server",()=>({syncRootRoster:mocks.sync}));
import { ensureRoster, hireCandidate } from "./hire-candidates.server";
import { GET, POST } from "@/app/api/system/hire-candidates/route";
import { PATCH } from "@/app/api/system/hire-candidates/[id]/route";
import { POST as hire } from "@/app/api/system/hire-candidates/[id]/hire/route";
import { GET as options } from "@/app/api/system/hire-candidates/kot-options/route";
const candidate = ():HireCandidate=>({id:"candidate",last_name:"山田",first_name:"太郎",last_name_kana:"ヤマダ",first_name_kana:"タロウ",birthday:"2000-01-01",hire_date:"2026-10-24",gender:"male",employment_type:"アルバイト",company_id:"COMP-002",kot_division_code:"01",kot_type_code:"02",status:"hiring",employee_number:"1571",employee_id:null,kintone_roster_record_id:null,steps:{number:{done:true}}});
function dbFor(row:HireCandidate) {
 const db = {from:vi.fn(),rpc:vi.fn()};
 db.from.mockImplementation((table:string)=>{
  let patch:Record<string,unknown>|null=null;
  const q:Record<string,unknown> = {};
  for(const name of ["select","eq","is","in","or"]) q[name]=vi.fn(()=>q);
  q.update=vi.fn((values)=>{patch=values;return q;});
  const result=()=>{if(table==="system_hire_candidates"){if(patch)Object.assign(row,patch);return {data:{...row},error:null};}return {data:{company_name:"法人",employee_id:"EMP-1571",user_id:"auth"},error:null};};
  q.single=vi.fn(async()=>result());q.maybeSingle=vi.fn(async()=>result());
  q.then=(resolve:(r:unknown)=>void)=>Promise.resolve(result()).then(resolve);
  return q;
 });return db;
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("KOT_EMPLOYEE_CREATE_ENABLED","true");mocks.employees.mockResolvedValue([]);mocks.create.mockResolvedValue({});mocks.records.mockResolvedValue([]);mocks.record.mockResolvedValue({id:"42"});mocks.sync.mockResolvedValue({errors:[]});});
it("excludes test/external numbers and skips normalized KOT codes and reservations",()=>{
 expect(nextEmployeeNumber(["1570","9001","9997","9999","999991","abc",null],["01571"],["1572"])).toBe("1573");
 expect(()=>nextEmployeeNumber(["8999"],[])).toThrow();
});
it("rejects impossible dates and unknown employment types",()=>{expect(()=>parseHireInput({...candidate(),birthday:"2000-02-30"})).toThrow();expect(()=>parseHireInput({...candidate(),employment_type:"bad"})).toThrow();});
it("writes the roster fields consumed by the existing sync",()=>{expect(rosterPayload(candidate(),"法人")).toMatchObject({社員番号:{value:"1571"},打刻ID:{value:"1571"},生年月日:{value:"2000-01-01"},従業員ステータス:{value:"在籍中"},ドロップダウン_15:{value:"法人"}});});
it("stop switch makes no KOT request and keeps the reserved number",async()=>{
 vi.stubEnv("KOT_EMPLOYEE_CREATE_ENABLED","");const row=candidate(),db=dbFor(row);
 const result=await hireCandidate({db:db as never,userId:"admin"},row.id);
 expect(mocks.create).not.toHaveBeenCalled();expect(mocks.employees).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
 expect(result.employee_number).toBe("1571");expect(result.steps.kot.error).toContain("停止中");
});
it("resume uses the same number and recognizes an existing KOT employee",async()=>{
 const row=candidate(),db=dbFor(row);mocks.employees.mockResolvedValue([{code:"01571",lastName:"山田",firstName:"太郎"}]);
 const result=await hireCandidate({db:db as never,userId:"admin"},row.id);
 expect(db.rpc).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();expect(result.status).toBe("hired");expect(mocks.sync).toHaveBeenCalledWith({dryRun:false,recordIds:["42"]});
});
it("a failed KOT POST is invoked once and resume checks GET before a new POST",async()=>{
 const row=candidate(),db=dbFor(row);mocks.create.mockRejectedValueOnce(new Error("network"));
 await hireCandidate({db:db as never,userId:"admin"},row.id);expect(mocks.create).toHaveBeenCalledTimes(1);expect(row.steps.kot.done).toBe(false);
 mocks.employees.mockResolvedValue([{code:"1571",lastName:"山田",firstName:"太郎"}]);
 await hireCandidate({db:db as never,userId:"admin"},row.id);expect(mocks.create).toHaveBeenCalledTimes(1);expect(db.rpc).not.toHaveBeenCalled();
});
it("reuses a matching active roster record without POST",async()=>{
 mocks.records.mockResolvedValue([{従業員名_姓名:{value:"山田　太郎"},生年月日:{value:"2000-01-01"},社員番号:{value:"1571"},打刻ID:{value:"1571"},$id:{value:"21"}}]);
 expect(await ensureRoster(candidate(),"法人")).toBe("21");expect(mocks.record).not.toHaveBeenCalled();
});
it("explains roster token permission failures",async()=>{mocks.record.mockRejectedValue(new Error("kintone_403"));await expect(ensureRoster(candidate(),"法人")).rejects.toThrow("レコード追加");});
describe("authorization",()=>{
 it.each(["staff","admin","manager",null])("all endpoints reject %s before reading input",async role=>{
  const q={select:vi.fn(),eq:vi.fn(),is:vi.fn(),maybeSingle:vi.fn(async()=>({data:{garden_role:role},error:null}))};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.is.mockReturnValue(q);
  mocks.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:"user"}}})},from:()=>q});
  const req=new Request("http://localhost",{method:"POST",body:"{}"}),ctx={params:Promise.resolve({id:"id"})};
  for (const response of [await GET(),await POST(req),await PATCH(req,ctx),await hire(req,ctx),await options()]) expect(response.status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
 });
});

it("allocates once, persists before a stop, and never reallocates on resume",async()=>{
 vi.stubEnv("KOT_EMPLOYEE_CREATE_ENABLED","");const row=candidate();row.employee_number=null;row.steps={};row.status="planned";
 const db=dbFor(row);db.rpc.mockImplementation(async()=>{row.employee_number="1572";return {data:"1572",error:null};});
 await hireCandidate({db:db as never,userId:"admin"},row.id);await hireCandidate({db:db as never,userId:"admin"},row.id);
 expect(db.rpc).toHaveBeenCalledTimes(1);expect(row.employee_number).toBe("1572");expect(mocks.create).not.toHaveBeenCalled();
});
