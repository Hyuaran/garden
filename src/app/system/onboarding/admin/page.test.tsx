import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), list: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../_lib/onboarding-admin.server", () => ({
  onboardingAdminContext: mocks.context,
  readAdminOnboardingList: mocks.list,
}));
vi.mock("../_lib/onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
import OnboardingAdminPage from "./page";
import { OnboardingError } from "../_lib/onboarding.server";

describe("入社手続き事務一覧ページ", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-M" });
    mocks.list.mockResolvedValue([{ employeeId: "EMP-1559", name: "吉田 陽菜", hireDate: "2026-09-01", status: "submitted", submittedAt: "2026-09-01T00:00:00Z", missingCount: 0, adminComplete: false }]);
  });

  it("責任者以上には自分の入社手続きへ戻る入口と台帳の入社日を出す", async () => {
    render(await OnboardingAdminPage());

    expect(screen.getByRole("link", { name: "自分の入社手続きへ" })).toHaveAttribute("href", "/system/onboarding");
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
  });

  it("責任者未満には戻る入口を出さない", async () => {
    mocks.context.mockRejectedValue(new OnboardingError("閲覧権限がありません", 403));
    render(await OnboardingAdminPage());

    expect(screen.queryByRole("link", { name: "自分の入社手続きへ" })).toBeNull();
  });
});
