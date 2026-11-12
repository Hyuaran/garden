import { beforeEach, expect, it, vi } from "vitest";
import { productPointsContext } from "./server";

const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  viewer: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireManager: mocks.manager,
}));
vi.mock("@/lib/auth/view-permission.server", () => ({
  viewPermissionContext: mocks.viewer,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.manager.mockResolvedValue({ userId: "actor" });
});
it("責任者と管理者は閲覧だけ、全権管理者は保存できる", async () => {
  for (const role of ["manager", "admin"]) {
    mocks.viewer.mockResolvedValue({ viewer: { role } });
    expect((await productPointsContext()).canWrite).toBe(false);
    await expect(productPointsContext(true)).rejects.toThrow("全権管理者");
  }
  mocks.viewer.mockResolvedValue({ viewer: { role: "super_admin" } });
  expect((await productPointsContext(true)).canWrite).toBe(true);
});
it("責任者未満は読む前に断る", async () => {
  mocks.manager.mockResolvedValue(null);
  await expect(productPointsContext()).rejects.toThrow("権限がありません");
  expect(mocks.admin).not.toHaveBeenCalled();
});
