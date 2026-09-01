import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), detail: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../_lib/onboarding-admin.server", () => ({
  onboardingAdminContext: mocks.context,
  readAdminOnboardingDetail: mocks.detail,
}));
vi.mock("../../_lib/onboarding.server", () => ({ OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } } }));
vi.mock("./OnboardingAdminDetailClient", () => ({ default: () => <button type="button">修正</button> }));
import OnboardingAdminDetailPage from "./page";
import { OnboardingError } from "../../_lib/onboarding.server";

describe("入社手続き事務詳細ページ", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-M" });
    mocks.detail.mockResolvedValue(null);
  });

  it("責任者未満にはメールアドレスの修正ボタンを出さない", async () => {
    mocks.context.mockRejectedValue(new OnboardingError("閲覧権限がありません", 403));

    render(await OnboardingAdminDetailPage({ params: Promise.resolve({ employeeId: "EMP-1" }) }));

    expect(screen.getByRole("heading", { name: "閲覧権限がありません" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修正" })).toBeNull();
    expect(mocks.detail).not.toHaveBeenCalled();
  });
});
