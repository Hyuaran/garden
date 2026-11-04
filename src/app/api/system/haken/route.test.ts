// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ manager: vi.fn(), viewer: vi.fn() }));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireManager: mocks.manager,
}));
vi.mock("@/lib/auth/system-view-api.server", () => ({
  requireViewEmployee: mocks.viewer,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => {
    throw new Error("権限確認前にDBへアクセスしました");
  },
}));
import { GET, POST } from "./route";
beforeEach(() => {
  mocks.manager.mockResolvedValue(null);
  mocks.viewer.mockResolvedValue(null);
});
it("見る権限が無ければ403", async () => {
  expect((await GET()).status).toBe(403);
});
it("書く権限が無ければ403", async () => {
  expect(
    (
      await POST(
        new Request("https://example.test/api/system/haken", {
          method: "POST",
          body: JSON.stringify({ kind: "party", value: {} }),
        }),
      )
    ).status,
  ).toBe(403);
});
