import { expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("./hire-candidates.server",()=>({HireError:class extends Error {constructor(message:string,public status=400){super(message);}}}));
vi.mock("@/lib/line/staff-client",()=>({pushLineStaff:vi.fn()}));
import { createLineCode,codeHash,checkHireLine } from "./hire-line.server";
import { pushLineStaff } from "@/lib/line/staff-client";
function context(result="ok") {
 const saved=vi.fn(async(_values:Record<string,unknown>)=>({error:null})),rpc=vi.fn(async()=>({data:result,error:null}));
 const db={rpc,from:(table:string)=>{
  const q={select:()=>q,eq:()=>q,is:()=>q,upsert:saved,delete:()=>q,
   single:async()=>({data:table==="root_employees"?{line_user_id:"line"}:{status:"hired",employee_id:"employee",checklist:Object.fromEntries(["contract_signed","nda_signed","emergency_signed"].map(k=>[k,{checked_at:"now",checked_by:"admin"}]))}}),
   maybeSingle:async()=>({data:{salt:"salt"}}),then:(resolve:(value:unknown)=>void)=>Promise.resolve({error:null}).then(resolve)};
  return q;
 }};
 return {context:{db:db as never,userId:"admin"},saved,rpc};
}
it("creates six digits, a salted hash and a 24 hour expiry; resend invalidates the digest",()=>{
 const now=Date.now();const first=createLineCode(),second=createLineCode();
 expect(first.code).toMatch(/^\d{6}$/);expect(first.code_hash).toMatch(/^[a-f0-9]{64}$/);
 expect(first.code_hash).not.toBe(first.code);expect(codeHash(first.salt,first.code)).toBe(first.code_hash);
 expect(Date.parse(first.expires_at)-now).toBeGreaterThanOrEqual(86400000);
 expect(Date.parse(first.expires_at)-now).toBeLessThan(86401000);
 expect(codeHash(second.salt,first.code)).not.toBe(first.code_hash);
});
it("rejects test sending after only two signatures before sending LINE",async()=>{
 const q={select:vi.fn(),eq:vi.fn(),single:vi.fn(async()=>({data:{status:"hired",checklist:{contract_signed:{checked_at:"now",checked_by:"u"},nda_signed:{checked_at:"now",checked_by:"u"}}}}))};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);
 await expect(checkHireLine({db:{from:()=>q} as never,userId:"u"},"c",{action:"send"})).rejects.toMatchObject({status:409});
 expect(pushLineStaff).not.toHaveBeenCalled();
});
it("sends the exact text but persists only salt/hash/expiry",async()=>{
 const c=context();vi.mocked(pushLineStaff).mockResolvedValueOnce(undefined);
 expect(await checkHireLine(c.context,"c",{action:"send"})).toEqual({sent:true});
 const [,message]=vi.mocked(pushLineStaff).mock.calls.at(-1)!;
 expect(message).toMatch(/^Garden からのテスト送信です。\n確認コード：\d{6}$/);
 const stored=c.saved.mock.calls[0][0] as Record<string,unknown>;
 const code=message.slice(-6);
 expect(stored).not.toHaveProperty("code");expect(stored.code_hash).toBe(codeHash(String(stored.salt),code));expect(stored.attempts).toBe(0);
});
it.each(["コードが違います（あと 4 回）","コードが違います（あと 0 回）。もう一度送ってください","期限が切れました。もう一度送ってください","確認回数を超えました。もう一度送ってください"])("returns the atomic verifier result: %s",async result=>{
 const c=context(result);await expect(checkHireLine(c.context,"c",{action:"verify",code:"000001"})).rejects.toMatchObject({message:result,status:409});
 expect(c.rpc).toHaveBeenCalledWith("verify_hire_line_code",{candidate_id:"c",digest:codeHash("salt","000001"),actor:"admin"});
});
it("marks confirmation only on successful verification",async()=>{
 const c=context();expect(await checkHireLine(c.context,"c",{action:"verify",code:"258945"})).toEqual({verified:true});
});
it("translates LINE errors to Japanese",async()=>{
 const c=context();vi.mocked(pushLineStaff).mockRejectedValueOnce(new Error("line_staff:http 403"));
 await expect(checkHireLine(c.context,"c",{action:"send"})).rejects.toMatchObject({message:expect.stringContaining("LINE に送信できませんでした"),status:503});
});
