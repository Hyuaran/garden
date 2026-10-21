import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TransactionDetail from "./TransactionDetail";
afterEach(() => vi.unstubAllGlobals());
const rows = [
  {mf_transaction_id:"1",date:"2026-10-20",content:"入金内容",side:"INCOME",value:30,journalizing_status:"done"},
  {mf_transaction_id:"2",date:"2026-10-19",content:"出金内容",side:"EXPENSE",value:50,journalizing_status:"none"},
];
function fixture(kind = "bank", transactions = rows) {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({account:{name:"銀行",kind,balance:500},transactions})));
  vi.stubGlobal("fetch",fetcher);
  render(<TransactionDetail id="b" />);
  return fetcher;
}
it("computes bank totals after search and filtering and changes period without server paging", async () => {
  const fetcher = fixture();
  await screen.findByText("今の残高 500 円");
  expect(screen.getByText("入金 30 円・出金 50 円・2 件")).toBeInTheDocument();
  expect(screen.getByText("30 円").closest("tr")?.children[2]).toHaveTextContent("30 円");
  expect(screen.getByText("50 円").closest("tr")?.children[3]).toHaveTextContent("50 円");
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"50"}});
  expect(screen.getByText("入金 0 円・出金 50 円・1 件")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", {name:"絞り込みをすべて解除"}));
  fireEvent.click(screen.getByRole("button", {name:"仕訳の並べ替え・絞り込み"}));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByLabelText("済 (1)"));
  fireEvent.click(within(dialog).getByRole("button", {name:"OK"}));
  expect(screen.getByText("入金 0 円・出金 50 円・1 件")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("期間"),{target:{value:"year"}});
  await waitFor(() => expect(fetcher.mock.lastCall?.[0]).toContain("period=year"));
  expect(fetcher.mock.lastCall?.[0]).not.toContain("page=");
});
it("computes signed card totals after content search", async () => {
  fixture("card");
  await screen.findByText("合計 20 円・2 件");
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"入金内容"}});
  expect(screen.getByText("合計 -30 円・1 件")).toBeInTheDocument();
});
it("pages locally after filtering and keeps totals over all filtered rows", async () => {
  const transactions = Array.from({length:205}, (_,i) => ({...rows[1], mf_transaction_id:String(i),content:i < 150 ? "対象" : "その他"}));
  const fetcher = fixture("bank", transactions);
  await screen.findByText("入金 0 円・出金 10,250 円・205 件");
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"対象"}});
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  expect(screen.getByText("入金 0 円・出金 7,500 円・150 件")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  expect(screen.getAllByRole("row")).toHaveLength(51);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
