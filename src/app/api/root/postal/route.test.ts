import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), from: vi.fn(), dataset: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/auth/view-permission.server", () => ({ viewPermissionContext: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ viewer: { role: "super_admin" } });
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.dataset, order: vi.fn().mockReturnThis(), then: (resolve: (v: unknown) => unknown) => Promise.resolve(mocks.rows()).then(resolve) };
  mocks.admin.mockReturnValue({ from: mocks.from.mockReturnValue(query) });
  mocks.dataset.mockResolvedValue({data:{id:"active"},error:null});
  mocks.rows.mockReturnValue({data:[{prefecture:"大阪府",city:"大阪市中央区",town:"南船場",is_special:false}],error:null});
});
it.each(["admin", "employee"])("%sは403", async role => {
  mocks.auth.mockResolvedValue({viewer:{role}});
  expect((await GET(new Request("http://localhost/api/root/postal?code=5420081"))).status).toBe(403);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("未ログインは403", async () => {
  mocks.auth.mockRejectedValue(new Error("unauthenticated"));
  expect((await GET(new Request("http://localhost/api/root/postal?code=5420081"))).status).toBe(403);
});
it.each(["123", "542-0081", ""])("7桁以外は400: %s", async code => {
  expect((await GET(new Request(`http://localhost/api/root/postal?code=${code}`))).status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("有効な住所表から候補を返す", async () => {
  const response = await GET(new Request("http://localhost/api/root/postal?code=5420081"));
  expect(await response.json()).toEqual({ok:true,addresses:[{address:"大阪府大阪市中央区南船場"}]});
  expect(mocks.from.mock.calls.map(call => call[0])).toEqual(["system_postal_datasets","system_postal_addresses"]);
});
