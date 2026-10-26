import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), canView: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/auth/view-permission.server", () => ({ viewPermissionContext: mocks.viewer, canView: mocks.canView }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
import { GET, POST } from "./route";
import { emptyInput } from "@/app/system/onboarding/_lib/onboarding";
import { proxyPayload } from "@/app/system/onboarding/_lib/onboarding-proxy";
const params = { params: Promise.resolve({ employeeId: "EMP-1" }) };
let rpc: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  rpc = vi.fn().mockResolvedValue({ error: null });
  mocks.viewer.mockResolvedValue({ name: "責任者", viewer: { employeeId: "EMP-M", role: "manager" } });
  mocks.canView.mockResolvedValue(true);
  mocks.admin.mockReturnValue({ rpc, from: (table: string) => ({
    select() { return this; }, eq() { return this; }, is() { return this; },
    maybeSingle: async () => ({ data: table === "root_employees" ? { employee_id: "EMP-1", name: "対象" } : { ...emptyInput(), bank_name: "秘密銀行", my_number: "123456789012" }, error: null }),
  }) });
});
function request(values: unknown) {
  return new Request("https://garden.test/api/system/onboarding/admin/EMP-1/proxy", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://garden.test" },
    body: JSON.stringify({ action: "save", values, step: 0 }),
  });
}
it("GETは責任者にマスク値も口座も返さない", async () => {
  const response = await GET(request({}), params);
  expect(response.status).toBe(200);
  expect(await response.text()).not.toMatch(/秘密銀行|9012|••••/);
});
it.each([{ my_number: "" }, { account_number: "123" }, { dependents: [{ my_number: "" }] }])("機微項目を含む責任者POSTは403", async privateValues => {
  const response = await POST(request({ ...proxyPayload(emptyInput(), false), ...privateValues }), params);
  expect(response.status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it("トスのGET/POSTは閲覧設定で403", async () => {
  mocks.canView.mockResolvedValue(false);
  expect((await GET(request({}), params)).status).toBe(403);
  expect((await POST(request({}), params)).status).toBe(403);
});
it("super_adminの機微項目POSTは保存できる", async () => {
  mocks.viewer.mockResolvedValue({ name: "全権", viewer: { employeeId: "EMP-S", role: "super_admin" } });
  expect((await POST(request({ ...emptyInput(), my_number: "123456789012" }), params)).status).toBe(200);
  expect(rpc.mock.calls[0][1]).toMatchObject({ p_sensitive: true, p_actor: "EMP-S" });
});
