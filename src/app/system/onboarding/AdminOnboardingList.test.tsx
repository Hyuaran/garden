import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ push }) }));
import AdminOnboardingList from "./AdminOnboardingList";
it("氏名以外のセル・行のEnterとSpaceで詳細を開き、カナ検索できる", () => {
  render(<AdminOnboardingList rows={[{ employeeId: "EMP-1", name: "後道 愛美", nameKana: "ウシロミチ マナミ", hireDate: "2026-10-26", status: "draft", submittedAt: null, missingCount: 1, adminComplete: false }]} />);
  const row = screen.getByText("後道 愛美").closest("tr")!;
  fireEvent.click(screen.getByText("2026-10-26"));
  fireEvent.keyDown(row, { key: "Enter" });
  fireEvent.keyDown(row, { key: " " });
  expect(push).toHaveBeenCalledTimes(3);
  expect(push).toHaveBeenCalledWith("/system/onboarding/admin/EMP-1");
  fireEvent.change(screen.getByPlaceholderText("氏名・カナで探す"), { target: { value: "ウシロミチ" } });
  expect(screen.getByText("後道 愛美")).toBeInTheDocument();
});
it("完了（提出ずみ・事務入力済）は最初から出さず、「完了を表示しない」を外すと出る。未着手も並ぶ", () => {
  window.localStorage.removeItem("onboarding-all:hide-complete");
  const base = { nameKana: "", hireDate: "2026-11-01", submittedAt: null, missingCount: 0 };
  render(<AdminOnboardingList rows={[
    { ...base, employeeId: "EMP-1", name: "完了 太郎", status: "submitted", adminComplete: true },
    { ...base, employeeId: "EMP-2", name: "事務 待ち", status: "submitted", adminComplete: false },
    { ...base, employeeId: "EMP-3", name: "籔 僚太", status: "not_started", adminComplete: false },
  ]} />);
  const box = screen.getByRole("checkbox", { name: "完了を表示しない" });
  expect(box).toBeChecked();
  expect(screen.queryByText("完了 太郎")).toBeNull();
  expect(screen.getByText("事務 待ち")).toBeInTheDocument();
  expect(screen.getByText("未着手")).toBeInTheDocument();
  fireEvent.click(box);
  expect(screen.getByText("完了 太郎")).toBeInTheDocument();
  expect(window.localStorage.getItem("onboarding-all:hide-complete")).toBe("false");
});
