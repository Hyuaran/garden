import { beforeEach,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({row:{} as Record<string,unknown>,request:vi.fn(),context:vi.fn()}));
vi.mock("@/app/system/onboarding/_lib/hire-candidates.server",()=>({HireError:class extends Error{constructor(message:string,public status=400){super(message);}},hireResponse:async(action:(c:unknown)=>Promise<unknown>)=>{try{return Response.json(await action(m.context()));}catch(e){return Response.json({error:(e as Error).message},{status:(e as {status?:number}).status??400});}}}));
vi.mock("@/app/system/onboarding/_lib/filemaker-accounts.server",()=>({requestFilemakerAccount:m.request,reconcileRequest:vi.fn()}));
import { POST } from "./route";
const signatures=Object.fromEntries(["contract_signed","nda_signed","emergency_signed"].map(k=>[k,{checked_at:"now",checked_by:"admin"}]));
beforeEach(()=>{vi.clearAllMocks();m.request.mockResolvedValue({status:"waiting"});const q={select:()=>q,eq:()=>q,single:async()=>({data:m.row,error:null})};m.context.mockReturnValue({db:{from:()=>q},userId:"admin"});});
it.each([{},signatures])("rejects FileMaker without verified LINE",async checklist=>{
 m.row={status:"hired",checklist};const res=await POST(new Request("http://localhost"),{params:Promise.resolve({id:"c"})});expect(res.status).toBe(409);expect(m.request).not.toHaveBeenCalled();
});
it("accepts signed documents plus an audited LINE skip",async()=>{
 m.row={status:"hired",checklist:{...signatures,line_skipped:{checked_at:"now",checked_by:"admin"}}};
 expect((await POST(new Request("http://localhost"),{params:Promise.resolve({id:"c"})})).status).toBe(200);expect(m.request).toHaveBeenCalledOnce();
});
