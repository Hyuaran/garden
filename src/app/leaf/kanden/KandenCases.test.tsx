import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { loadCaseList } from "./case-list-actions";
import { loadCaseDetail } from "./actions";
import type { CaseDetail, CaseList } from "./cases";
import KandenCases from "./KandenCases";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ loadCaseDetail: vi.fn() }));

vi.mock("./case-list-actions", () => ({ loadCaseList: vi.fn() }));

const list: CaseList = {
  hasOrders: true, updatedAt: "2026-11-20T12:30:00Z", years: [2026, 2025],
  counts: { active: 1, completed: 2, cancelled: 3 },
  page: 1, total: 1, withPhotos: 1, options: null,
  rows: [{
    id: "order", ordered_on: "2026-11-05", kanri_no: "1527681", kanri_no_raw: "PD1527681",
    customer_name: "山田 太郎", cancel_reason: null,
    progress: "確認中", acquisition: "奪還", contract_type: "従量電灯B", sales_name: null, clerk_name: null,
    entered_on: null, mailed_on: null, invoice_sent_on: null, photo_count: 1,
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
    payments: [{ pd_row_no: "26064-0001", statement_month: "2026-11", amount: -12000, source_file: null }],
    photos: [{ url: "https://example.test/signed", filename: "1527681_1.jpg", jpeg: true }],
  });
  render(<KandenCases list={list} year={2026} currentYear={2026} tab="active" search="" />);
  expect(screen.getByRole("link", { name: "進行中 1" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "キャンセル 3" })).toHaveAttribute("href", "/leaf/kanden?year=2026&tab=cancelled");
  expect(screen.getByRole("link", { name: "完了 2" })).toHaveAttribute("href", "/leaf/kanden?year=2026&tab=completed");
  const search = screen.getByPlaceholderText("管理番号・お客様名・カナ・住所・理由");
  vi.mocked(loadCaseList).mockResolvedValueOnce({ ...list, rows: [], total: 0, withPhotos: 0 }).mockResolvedValueOnce(list);
  fireEvent.change(search, { target: { value: "京都" } });
  expect(screen.getByRole("cell", { name: "山田 太郎" })).toBeInTheDocument();
  expect(await screen.findByText("該当する案件はありません。")).toBeInTheDocument();
  expect(loadCaseList).toHaveBeenLastCalledWith(2026, "active", expect.objectContaining({ search: "京都", page: 1 }), false);
  fireEvent.change(search, { target: { value: "大阪市" } });
  expect(loadCaseDetail).not.toHaveBeenCalled();

  fireEvent.click(await screen.findByRole("cell", { name: "山田 太郎" }));
  const dialog = await screen.findByRole("dialog", { name: "1527681 山田 太郎" });
  expect(loadCaseDetail).toHaveBeenCalledExactlyOnceWith("order");
  expect(await within(dialog).findByText("確認済み")).toBeInTheDocument();
  expect(within(dialog).getByText(/2026-11.*戻入.*-12,000 円/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "写メ 1 を拡大" }));
  expect(within(dialog).getByRole("img", { name: "写メ 1" })).toHaveAttribute("loading", "lazy");
  expect(within(dialog).getByRole("button", { name: "画像を保存" })).toBeEnabled();
});

it("キャンセルタブでは理由を既定で表示し、ページ外の理由と理由なしを複数選択できる", async () => {
  const reason = "郵送前キャンセル（入金なし）";
  const otherReason = "戻入あり";
  const cancelled: CaseList = {
    ...list, options: { cancel_reason: ["", reason, otherReason] },
    rows: [{ ...list.rows[0], cancel_reason: reason }],
  };
  vi.mocked(loadCaseList).mockResolvedValueOnce({ ...cancelled, total: 2, options: null });
  render(<KandenCases list={cancelled} year={2026} currentYear={2026} tab="cancelled" search="" />);
  expect(screen.getByRole("cell", { name: reason })).toBeInTheDocument();
  const filter = screen.getByRole("button", { name: "理由" });
  fireEvent.click(filter);
  const dialog = within(screen.getByRole("dialog", { name: "理由" }));
  fireEvent.click(dialog.getByRole("checkbox", { name: otherReason }));
  fireEvent.click(dialog.getByRole("checkbox", { name: "（なし）" }));
  fireEvent.click(dialog.getByRole("button", { name: "OK" }));
  expect(await screen.findByText(/件数 2 件/)).toBeInTheDocument();
  expect(loadCaseList).toHaveBeenLastCalledWith(2026, "cancelled",
    expect.objectContaining({ filters: { cancel_reason: ["", otherReason] }, page: 1 }), false);
  fireEvent.click(filter);
  expect(screen.getByRole("checkbox", { name: otherReason })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: reason })).not.toBeChecked();
});

it("進行中タブでは表示を切り替えて要確認の理由を選べる", () => {
  const reason = "要確認（明細が PDF の月）";
  render(<KandenCases list={{ ...list, options: { cancel_reason: [reason] } }}
    year={2026} currentYear={2026} tab="active" search="" />);
  expect(screen.queryByRole("button", { name: "理由" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "理由列を表示" }));
  fireEvent.click(screen.getByRole("button", { name: "理由" }));
  expect(screen.getByRole("checkbox", { name: reason })).toBeInTheDocument();
});
