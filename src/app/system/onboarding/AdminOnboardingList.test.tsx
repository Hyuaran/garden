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
