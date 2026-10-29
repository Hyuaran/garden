import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import StatementsContent from "./StatementsContent";
import StatementsImportsContent from "./imports/StatementsImportsContent";
import StatementsSummaryContent from "./summary/StatementsSummaryContent";
import { statementAccountLabel } from "./statement-accounts";

const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), is: vi.fn(), order: vi.fn(), importBankStatements: vi.fn(), fetchStatementList: vi.fn(), fetchImportBatches: vi.fn() }));
vi.mock("../_lib/supabase", () => ({ supabase: { from: mocks.from } }));
vi.mock("../_state/BudStateContext", () => ({ useBudState: () => ({ sessionUser: { user_id: "user" } }) }));
vi.mock("../_lib/statement-queries", () => ({ fetchStatementList: mocks.fetchStatementList, fetchImportBatches: mocks.fetchImportBatches }));
vi.mock("../_lib/statement-import", () => ({ importBankStatements: mocks.importBankStatements }));
vi.mock("./_components/ManualAssignModal", () => ({ ManualAssignModal: () => null }));
vi.mock("@/app/system/_components/StickyTable/useStickyTable", () => ({ default: ({ children }: { children: ReactNode }) => <table>{children}</table> }));
vi.mock("@/app/system/_components/ChoiceFilter", () => ({ default: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (value: string) => void }) => <select aria-label="銀行" value={value} onChange={e => onValueChange(e.target.value)}>{children}</select> }));

const account = { id: "account-1", bank_name: "楽天銀行", branch_name: "第一支店", account_number: "0012345", sub_account_label: "楽天｜HR" };
const label = "楽天｜HR / 楽天銀行 / 第一支店 / 下4桁 2345";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ is: mocks.is });
  mocks.is.mockReturnValue({ order: mocks.order });
  mocks.order.mockResolvedValue({ data: [account], error: null });
  mocks.fetchStatementList.mockResolvedValue([{ id: "s1", bank_account_id: account.id, amount: 100, transaction_date: "2026-10-01", description: "入金", matched_transfer_id: null }]);
  mocks.fetchImportBatches.mockResolvedValue([{ id: "b1", bank_account_id: account.id, imported_at: "2026-10-01", status: "completed" }]);
  mocks.importBankStatements.mockResolvedValue({ success: true, successCount: 1, skippedCount: 0, errorCount: 0, autoMatchedCount: 0 });
});

it.each([StatementsContent, StatementsImportsContent, StatementsSummaryContent])("現行の列を取得し口座名を表示する: %s", async Component => {
  render(<Component />);
  expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
  if (Component !== StatementsContent) expect(await screen.findByRole("cell", { name: label })).toBeInTheDocument();
  expect(mocks.from).toHaveBeenCalledWith("root_bank_accounts");
  expect(mocks.select).toHaveBeenCalledWith("id, bank_name, branch_name, account_number, sub_account_label");
  expect(mocks.is).toHaveBeenCalledWith("deleted_at", null);
  expect(mocks.order).toHaveBeenCalledTimes(1);
});

it("一覧の口座選択に実際の主キーを使い、CSV取り込みへ渡す", async () => {
  render(<StatementsContent />);
  await screen.findByRole("option", { name: label });
  fireEvent.change(screen.getByLabelText("銀行"), { target: { value: account.id } });
  await waitFor(() => expect(mocks.fetchStatementList).toHaveBeenLastCalledWith(expect.objectContaining({ bankAccountId: account.id })));
  fireEvent.click(screen.getByRole("button", { name: "+ CSV 取込" }));
  fireEvent.change(screen.getByLabelText("対象口座 *"), { target: { value: account.id } });
  const file = new File(["csv"], "statement.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => "csv" });
  const input = document.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "取込実行" }));
  await waitFor(() => expect(mocks.importBankStatements).toHaveBeenCalledWith(expect.objectContaining({ bankAccountId: account.id })));
  expect(mocks.order).toHaveBeenCalledTimes(1);
});

it("取得失敗を空の口座一覧として隠さない", async () => {
  mocks.order.mockResolvedValue({ data: null, error: { message: "failure" } });
  render(<StatementsImportsContent />);
  expect(await screen.findByRole("alert")).toHaveTextContent("口座の一覧を取得できませんでした");
});

it("任意項目が空でも未定義の文字や区切りを表示しない", () => {
  expect(statementAccountLabel({ ...account, branch_name: null, account_number: null, sub_account_label: null })).toBe("楽天銀行");
});
