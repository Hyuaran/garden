import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
import { resolveAttendanceEmployee } from "./auth";

function client(options: { user?: boolean; employee?: object | null; error?: boolean } = {}) {
  const calls: unknown[][] = [];
  const query = { select(){return this}, eq(...args:unknown[]){calls.push(args);return this}, is(...args:unknown[]){calls.push(args);return this}, maybeSingle:async()=>({data:options.employee===undefined?{employee_id:"EMP-0001",name:"社員A",garden_role:"staff"}:options.employee,error:options.error?{message:"detail"}:null}) };
  return { calls, auth:{getUser:vi.fn().mockResolvedValue({data:{user:options.user===false?null:{id:"user-uuid"}}})}, from:vi.fn(()=>query) };
}
describe("resolveAttendanceEmployee",()=>{
  beforeEach(()=>mocks.createServerClient.mockReset());
  it("requires login",async()=>{mocks.createServerClient.mockResolvedValue(client({user:false}));expect(await resolveAttendanceEmployee()).toMatchObject({ok:false,status:401});});
  it("requires an active non-deleted employee and returns its text employee ID",async()=>{const c=client();mocks.createServerClient.mockResolvedValue(c);expect(await resolveAttendanceEmployee()).toEqual({ok:true,employee:{id:"EMP-0001",name:"社員A",gardenRole:"staff"}});expect(c.calls).toContainEqual(["user_id","user-uuid"]);expect(c.calls).toContainEqual(["is_active",true]);expect(c.calls).toContainEqual(["deleted_at",null]);});
  it("returns a stable 409 for an unregistered user",async()=>{mocks.createServerClient.mockResolvedValue(client({employee:null}));expect(await resolveAttendanceEmployee()).toMatchObject({ok:false,status:409,errorCode:"EMPLOYEE_NOT_REGISTERED"});});
});
