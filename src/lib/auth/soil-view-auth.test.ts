import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GardenRole } from "@/app/root/_constants/types";
import { resolveCanView, type ViewPermission } from "./view-permission";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ role: "manager" as GardenRole, permissions: [] as ViewPermission[] }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "reader", garden_role: mocks.role }, error: null }) }) }) }) }) }));
vi.mock("./view-permission.server", () => ({
  ViewPermissionError: class extends Error {},
  viewPermissionContext: async () => ({ viewer: { employeeId: "employee", role: mocks.role } }),
  canView: async (page: string, tab: string, viewer: { employeeId: string; role: GardenRole }, defaults: boolean) => resolveCanView(mocks.permissions, page, tab, viewer, defaults),
}));
import { requireSoilListUser } from "@/app/api/soil/list/_lib/auth";
beforeEach(() => { mocks.role = "manager"; mocks.permissions = []; });
function setting(roles: string[]): ViewPermission {
  return { page_key: "soil-overview", tab_key: "", roles, employee_ids: [], viewers_can_add: false, updated_by: "admin", updated_at: "" };
}
describe("Soil shared list API", () => {
  it("retains the existing manager read default despite Soil's admin page default", async () => {
    expect((await requireSoilListUser("list")).ok).toBe(true);
  });
  it("an explicit denial blocks the existing shared reader", async () => {
    mocks.permissions = [setting([])]; expect((await requireSoilListUser("list")).ok).toBe(false);
  });
  it("an explicit grant broadens reads but never the existing write gate", async () => {
    mocks.role = "toss"; mocks.permissions = [setting(["toss"])];
    expect((await requireSoilListUser("list")).ok).toBe(true);
    expect((await requireSoilListUser()).ok).toBe(false);
  });
  it("without a Soil override, System tab restrictions still apply", async () => {
    mocks.permissions = [{ ...setting([]), page_key: "system-list", tab_key: "list" }];
    expect((await requireSoilListUser("list")).ok).toBe(false);
  });
});
