import "@/lib/auth/__tests__/system-view-fixture";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), redirect: mocks.redirect }));
import PayrollNoticeRedirectPage from "./page";

describe("legacy payroll notice route", () => {
  it("redirects to the form route", () => {
    PayrollNoticeRedirectPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/system/forms/payroll-notice");
  });
});
