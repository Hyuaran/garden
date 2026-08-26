import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/app/system/mypage/_lib/mypage-profile.server",()=>({buildMyPageProfile:async(row:Record<string,unknown>)=>({name:row.name,nameKana:row.name_kana,employeeNumber:row.employee_number,employmentType:row.employment_type,birthday:row.birthday,email:row.email,gardenRole:row.garden_role,bankName:"みどり銀行",branchName:"庭園支店",commuteDailyAllowance:800,commuteMonthlyCap:20000,mynaSubmitted:true})}));
import { POST } from "./route";

const employee = { id:"employee-1",name:"社員A", name_kana:"シャインエー", employee_number:"001", employment_type:"正社員", birthday:"1980-08-13", email:"a@example.com", garden_role:"staff",commute_daily_allowance:800,commute_monthly_cap:20000 };
function client(options: { user?: boolean; employee?: typeof employee | null; error?: boolean } = {}) {
  const calls: unknown[][] = [];
  const query = { select(){return this}, eq(...args:unknown[]){calls.push(args);return this}, is(...args:unknown[]){calls.push(args);return this}, maybeSingle:async()=>({data:options.employee===undefined?employee:options.employee,error:options.error?{message:"private detail"}:null}) };
  return { calls, auth:{getUser:vi.fn().mockResolvedValue({data:{user:options.user===false?null:{id:"logged-in-user"}}})}, from:vi.fn(()=>query) };
}
const request = (body: unknown) => new Request("http://localhost/api/system/mypage/unlock", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });

describe("POST /api/system/mypage/unlock", () => {
  beforeEach(() => mocks.createServerClient.mockReset());
  it("returns only the authenticated employee profile for the correct MMDD", async () => {
    const db = client(); mocks.createServerClient.mockResolvedValue(db);
    const response = await POST(request({ code:"0813", employeeId:"OTHER", userId:"OTHER" }));
    expect(response.status).toBe(200);
    const payload=await response.json();expect(payload).toEqual({ ok:true, profile:{ name:"社員A", nameKana:"シャインエー", employeeNumber:"001", employmentType:"正社員", birthday:"1980-08-13", email:"a@example.com", gardenRole:"staff",bankName:"みどり銀行",branchName:"庭園支店",commuteDailyAllowance:800,commuteMonthlyCap:20000,mynaSubmitted:true } });
    expect(JSON.stringify(payload)).not.toMatch(/account_number|account_holder|my_number|123456789012/);
    expect(db.calls).toContainEqual(["user_id", "logged-in-user"]);
    expect(db.calls).not.toContainEqual(expect.arrayContaining(["OTHER"]));
  });
  it("returns ok false for a wrong MMDD", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    expect(await (await POST(request({code:"0814"}))).json()).toEqual({ok:false});
  });
  it("rejects malformed input and unauthenticated callers", async () => {
    expect((await POST(request({code:"813"}))).status).toBe(400);
    mocks.createServerClient.mockResolvedValue(client({user:false}));
    expect((await POST(request({code:"0813"}))).status).toBe(401);
  });
  it("requires an active non-deleted employee", async () => {
    const db = client({employee:null}); mocks.createServerClient.mockResolvedValue(db);
    expect((await POST(request({code:"0813"}))).status).toBe(409);
    expect(db.calls).toContainEqual(["is_active", true]);
    expect(db.calls).toContainEqual(["deleted_at", null]);
  });
  it("does not expose database errors", async () => {
    mocks.createServerClient.mockResolvedValue(client({error:true}));
    const response = await POST(request({code:"0813"}));
    expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain("private detail");
  });
});
