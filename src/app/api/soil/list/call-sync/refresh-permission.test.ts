import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ employee: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/system-view-api.server", () => ({ requireViewEmployee: mocks.employee }));
vi.mock("@/lib/auth/view-permission.server", () => ({ canView: vi.fn(), viewPermissionContext: vi.fn(), ViewPermissionError: class extends Error {} }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
}) }));
import { POST } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});
it("allows a list viewer to recount after the host sync", async () => {
  mocks.employee.mockResolvedValue({ userId: "list-only-staff" });
  expect((await POST()).status).toBe(200);
  expect(mocks.employee).toHaveBeenCalledWith("system-list", "list", "manager");
  expect(mocks.rpc).toHaveBeenCalledWith("soil_list_refresh_call_summary");
});
it("rejects non-viewers without recounting", async () => {
  mocks.employee.mockResolvedValue(null);
  expect((await POST()).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
