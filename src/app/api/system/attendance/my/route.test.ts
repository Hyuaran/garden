import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({resolve:vi.fn(),admin:vi.fn()}));
vi.mock("../_lib/auth",()=>({resolveAttendanceEmployee:mocks.resolve}));vi.mock("@/lib/supabase/admin",()=>({getSupabaseAdmin:mocks.admin}));
import { GET } from "./route";
describe("GET attendance my",()=>{beforeEach(()=>mocks.resolve.mockResolvedValue({ok:true,employee:{id:"EMP-0001",name:"A",gardenRole:"staff"}}));
  it("queries only the resolved employee within the JST day",async()=>{const calls:unknown[][]=[];const chain={select(){return this},eq(...a:unknown[]){calls.push(a);return this},gte(...a:unknown[]){calls.push(a);return this},lt(...a:unknown[]){calls.push(a);return this},order(){return this},limit:async()=>({data:[],error:null})};mocks.admin.mockReturnValue({from:()=>chain});const response=await GET(new Request("http://localhost/api/system/attendance/my?date=2026-08-13"));expect(response.status).toBe(200);expect(calls).toContainEqual(["employee_id","EMP-0001"]);expect(calls).toContainEqual(["punched_at","2026-08-12T15:00:00.000Z"]);expect(calls).toContainEqual(["punched_at","2026-08-13T15:00:00.000Z"]);});
  it("rejects an invalid date",async()=>{mocks.admin.mockReturnValue({});expect((await GET(new Request("http://localhost/api/system/attendance/my?date=bad"))).status).toBe(400);});});
