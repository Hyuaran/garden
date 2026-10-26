import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({context:vi.fn(),read:vi.fn(),rpc:vi.fn(),admin:vi.fn(),notice:vi.fn()}));
vi.mock("@/lib/auth/view-permission.server", () => ({viewPermissionContext:mocks.context,readViewPermissions:mocks.read,ViewPermissionError:class extends Error { constructor(message:string,public status=403){super(message);} }}));
vi.mock("@/lib/supabase/admin", () => ({getSupabaseAdmin:mocks.admin}));
vi.mock("@/lib/auth/view-permission-notice.server", () => ({notifyViewerAdded:mocks.notice}));
import { GET, PATCH } from "./route";
const request = (action:string, extra={}) => new Request("http://localhost/api/system/view-permissions", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({page:"system-onboarding",tab:"all",action,...extra})});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({db:{rpc:mocks.rpc},viewer:{employeeId:"EMP-1",role:"staff"},name:"追加した人"});
  mocks.read.mockResolvedValue([{page_key:"system-onboarding",tab_key:"all",roles:["staff"],employee_ids:[],viewers_can_add:false}]);
  mocks.rpc.mockResolvedValue({data:true,error:null});
  const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{name:"追加された人"},error:null})};
  mocks.admin.mockReturnValue({from:()=>q});
});
it.each(["save","reset"])("全権管理者以外は%sできない",async action => {
  expect((await PATCH(request(action))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("追加がオフなら閲覧できても追加できない",async () => {
  expect((await PATCH(request("add",{employeeId:"EMP-2"}))).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.notice).not.toHaveBeenCalled();
});
it("追加がオンならRPCで追加しGarden通知を呼ぶ（実送信なし）",async () => {
  mocks.read.mockResolvedValue([{page_key:"system-onboarding",tab_key:"all",roles:["staff"],employee_ids:[],viewers_can_add:true}]);
  expect((await PATCH(request("add",{employeeId:"EMP-2"}))).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("system_add_viewer",{p_page:"system-onboarding",p_tab:"all",p_employee_id:"EMP-2"});
  expect(mocks.notice).toHaveBeenCalledWith("追加した人","追加された人","入社手続き／みんなの入社手続き");
});
it("追加がオンでも閲覧権限がない人には403",async () => {
  mocks.read.mockResolvedValue([{page_key:"system-onboarding",tab_key:"all",roles:[],employee_ids:[],viewers_can_add:true}]);
  expect((await PATCH(request("add",{employeeId:"EMP-2"}))).status).toBe(403);
  expect((await GET(new Request("http://localhost/api/system/view-permissions?page=system-onboarding&tab=all"))).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("重複追加は通知しない",async () => {
  mocks.context.mockResolvedValue({db:{rpc:mocks.rpc},viewer:{employeeId:"EMP-1",role:"super_admin"},name:"管理者"});
  mocks.rpc.mockResolvedValue({data:false,error:null});
  expect((await PATCH(request("add",{employeeId:"EMP-2"}))).status).toBe(200);
  expect(mocks.notice).not.toHaveBeenCalled();
});
it("全権管理者の保存もRPCの認証で拒否されたら403",async () => {
  mocks.context.mockResolvedValue({db:{rpc:mocks.rpc},viewer:{employeeId:"EMP-1",role:"super_admin"}});
  mocks.rpc.mockResolvedValue({error:{code:"42501"}});
  expect((await PATCH(request("save",{roles:["staff"],employeeIds:[],viewersCanAdd:false}))).status).toBe(403);
});
