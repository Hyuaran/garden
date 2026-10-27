import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/minimum-wages.server",()=>({listMinimumWages:vi.fn(async()=>[])}));
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
import { emptyInput } from "../../_lib/onboarding";

describe("入社手続き事務詳細ページ", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-M" });
    mocks.detail.mockResolvedValue(null);
  });

  it("閲覧許可された責任者には提出前だけ代行リンクを出す", async () => {
    mocks.context.mockResolvedValue({ managerEmployeeId: "EMP-M", canWrite: true });
    mocks.detail.mockResolvedValue({ values: { ...emptyInput(), name: "後道 愛美" }, employee: { name: "後道 愛美" }, status: "draft" });
    const { unmount } = render(await OnboardingAdminDetailPage({ params: Promise.resolve({ employeeId: "EMP-1" }) }));
    expect(screen.getByRole("link", { name: "本人の代わりに入力する" })).toHaveAttribute("href", "/system/onboarding/admin/EMP-1/proxy");
    expect(screen.getByRole("heading", { name: "後道 愛美さんの入社手続き" })).toBeInTheDocument();
    unmount();
    mocks.detail.mockResolvedValue({ values: emptyInput(), employee: { name: "後道 愛美" }, status: "submitted" });
    render(await OnboardingAdminDetailPage({ params: Promise.resolve({ employeeId: "EMP-1" }) }));
    expect(screen.queryByRole("link", { name: "本人の代わりに入力する" })).toBeNull();
  });

  it("責任者未満にはメールアドレスの修正ボタンを出さない", async () => {
    mocks.context.mockRejectedValue(new OnboardingError("閲覧権限がありません", 403));

    render(await OnboardingAdminDetailPage({ params: Promise.resolve({ employeeId: "EMP-1" }) }));

    expect(screen.getByRole("heading", { name: "閲覧権限がありません" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修正" })).toBeNull();
    expect(mocks.detail).not.toHaveBeenCalled();
  });
});
