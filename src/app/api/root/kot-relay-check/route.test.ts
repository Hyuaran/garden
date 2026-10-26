vi.mock("@/lib/auth/view-permission.server", () => ({ systemViewResponse: async () => null }));
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ employee: vi.fn(), admin: vi.fn(), fetch: vi.fn(), role: vi.fn() }));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireEmployee: mocks.employee }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock("@/app/root/_lib/kot-api", () => ({ fetchKotEmployees: mocks.fetch, KotApiClientError: class extends Error {} }));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.employee.mockResolvedValue({ employee_id: "001" });
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.role };
  mocks.admin.mockReturnValue({ from: vi.fn(() => chain) });
});
describe("KOT relay check", () => {
  it("rejects unauthenticated users before querying roles", async () => {
    mocks.employee.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["admin", "manager", "staff", null])("rejects %s", async garden_role => {
    mocks.role.mockResolvedValue({ data: { garden_role } });
    expect((await GET()).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("returns only count and first employee code for super_admin", async () => {
    mocks.role.mockResolvedValue({ data: { garden_role: "super_admin" } });
    mocks.fetch.mockResolvedValue([{ code: "001", firstName: "private", key: "private" }, { code: "002" }]);
    const result = await GET();
    expect(await result.json()).toEqual({ count: 2, firstEmployeeCode: "001" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
  it("handles an empty list", async () => {
    mocks.role.mockResolvedValue({ data: { garden_role: "super_admin" } });
    mocks.fetch.mockResolvedValue([]);
    expect(await (await GET()).json()).toEqual({ count: 0, firstEmployeeCode: null });
  });
  it("does not expose upstream error details", async () => {
    mocks.role.mockResolvedValue({ data: { garden_role: "super_admin" } });
    mocks.fetch.mockRejectedValue(new Error("private"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, code: "UNKNOWN" });
  });
});
