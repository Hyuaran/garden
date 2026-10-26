import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), hire: vi.fn(), self: vi.fn(), list: vi.fn() }));
vi.mock("./_lib/onboarding-admin.server", () => ({ onboardingAdminContext: mocks.admin, readAdminOnboardingList: mocks.list }));
vi.mock("./_lib/hire-candidates.server", () => ({ hireAdminContext: mocks.hire }));
vi.mock("./_lib/onboarding.server", () => ({
  OnboardingError: class extends Error {}, onboardingEmployee: vi.fn(async () => ({})), readOnboarding: mocks.self,
}));
vi.mock("./OnboardingClient", () => ({ default: () => <div role="progressbar" aria-label="入力の進捗" /> }));
vi.mock("./HireCandidatesClient", () => ({ default: ({ tab }: { tab: string }) => <p>{tab}</p> }));
vi.mock("./AdminOnboardingList", () => ({ default: () => <p>一覧</p> }));
import Page from "./page";
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockRejectedValue(new Error("forbidden"));
  mocks.hire.mockRejectedValue(new Error("forbidden"));
  mocks.self.mockResolvedValue({ status: "draft" });
  mocks.list.mockResolvedValue([]);
});
it.each(["toss", "manager", "super_admin"])("%sのタブと本人の進捗を表示", async role => {
  if (role !== "toss") mocks.admin.mockResolvedValue({});
  if (role === "super_admin") mocks.hire.mockResolvedValue({ userId: "admin" });
  render(await Page({}));
  expect(screen.getAllByRole("tab")).toHaveLength(role === "toss" ? 1 : role === "manager" ? 2 : 4);
  expect(screen.getByRole("tab", { name: "自分の入社手続き", selected: true })).toHaveAttribute("href", "/system/onboarding?tab=self");
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  expect(mocks.list).not.toHaveBeenCalled();
});
it.each(["candidates", "confirmations", "all", "unknown"])("未許可の%sは本人画面", async tab => {
  render(await Page({ searchParams: Promise.resolve({ tab }) }));
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("自分の入社手続き");
  expect(mocks.list).not.toHaveBeenCalled();
});
it("一覧指定時は本人データを読まず一覧を表示", async () => {
  mocks.admin.mockResolvedValue({});
  render(await Page({ searchParams: Promise.resolve({ tab: "all" }) }));
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("みんなの入社手続き");
  expect(mocks.list).toHaveBeenCalledOnce();
  expect(mocks.self).not.toHaveBeenCalled();
});
