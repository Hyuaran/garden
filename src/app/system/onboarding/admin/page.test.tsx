import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ hire: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
vi.mock("../_lib/hire-candidates.server", () => ({ hireAdminContext: mocks.hire }));
import Page from "./page";
beforeEach(() => { vi.resetAllMocks(); });
it("全権管理者は入社予定者へ転送", async () => {
 mocks.hire.mockResolvedValue({userId:"admin"}); await Page();
 expect(mocks.redirect).toHaveBeenCalledWith("/system/onboarding?tab=candidates");
});
it("その他は一覧へ転送し移動先で権限を確認", async () => {
 mocks.hire.mockRejectedValue(new Error("forbidden")); await Page();
 expect(mocks.redirect).toHaveBeenCalledWith("/system/onboarding?tab=all");
});
