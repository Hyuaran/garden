import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { loadCaseDetail } from "./actions";
import type { CaseDetail, CaseList } from "./cases";
import KandenCases from "./KandenCases";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ loadCaseDetail: vi.fn() }));

const list: CaseList = {
  hasOrders: true, updatedAt: "2026-11-20T12:30:00Z", years: [2026, 2025],
  counts: { active: 1, completed: 2, cancelled: 3 },
  rows: [{
    id: "order", ordered_on: "2026-11-05", kanri_no: "1527681", kanri_no_raw: "PD1527681",
    customer_name: "山田 太郎", customer_kana: "ヤマダ タロウ", address: "大阪市中央区",
    progress: "確認中", acquisition: "奪還", contract_type: "従量電灯B", sales_name: null, clerk_name: null,
    entered_on: null, app_sent_on: null, invoice_sent_on: null, photo_count: 1,
  }],
};

it("データが未取り込みの場合と読み込み失敗を区別する", () => {
  const props = { year: 2026, currentYear: 2026, tab: "active", search: "" } as const;
  const { rerender } = render(<KandenCases {...props} list={{ ...list, hasOrders: false }} />);
  expect(screen.getByText("FileMaker の受注はまだ取り込まれていません。")).toBeInTheDocument();
  rerender(<KandenCases {...props} list={null} />);
  expect(screen.getByRole("status")).toHaveTextContent("関電の案件一覧を読み込めませんでした。");
});

it("住所で検索し、案件を開いたときだけ詳細と写メを読み込む", async () => {
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(function (this: HTMLDialogElement) {
    this.open = true;
  });
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (this: HTMLDialogElement) {
    this.open = false;
  });
  vi.mocked(loadCaseDetail).mockResolvedValue({
    detail: { customer_name: "山田 太郎", note: "確認済み" } as CaseDetail,
    photos: [{ url: "https://example.test/signed", filename: "1527681_1.jpg", jpeg: true }],
  });
  render(<KandenCases list={list} year={2026} currentYear={2026} tab="active" search="" />);
  expect(screen.getByRole("link", { name: "完了 2" })).toHaveAttribute("href", "/leaf/kanden?year=2026&tab=completed");
  const search = screen.getByPlaceholderText("管理番号・お客様名・カナ・住所");
  fireEvent.change(search, { target: { value: "京都" } });
  expect(screen.getByText("該当する案件はありません。")).toBeInTheDocument();
  fireEvent.change(search, { target: { value: "大阪市" } });
  expect(loadCaseDetail).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("cell", { name: "山田 太郎" }));
  const dialog = await screen.findByRole("dialog", { name: "1527681 山田 太郎" });
  expect(loadCaseDetail).toHaveBeenCalledExactlyOnceWith("order");
  expect(await within(dialog).findByText("確認済み")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "写メ 1 を拡大" }));
  expect(within(dialog).getByRole("img", { name: "写メ 1" })).toHaveAttribute("loading", "lazy");
  expect(within(dialog).getByRole("button", { name: "画像を保存" })).toBeEnabled();
});
