import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import PayrollNoticeRedirectPage from "./page";

describe("legacy payroll notice route", () => {
  it("redirects to the form route", () => {
    PayrollNoticeRedirectPage();
    expect(mocks.redirect).toHaveBeenCalledWith("/system/forms/payroll-notice");
  });
});
