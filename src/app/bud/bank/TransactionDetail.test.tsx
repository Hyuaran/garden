import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TransactionDetail from "./TransactionDetail";
afterEach(() => vi.unstubAllGlobals());
// 数字の箱（小さな見出し small の次の数字）を取り出す。列の見出し（入金・出金）と区別する
const stat = (label: string) => screen.getAllByText(label).find(element => element.tagName === "SMALL")?.nextElementSibling;

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
  await screen.findAllByText("今の残高"); expect(stat("今の残高")).toHaveTextContent("500 円");
  expect(stat("入金")).toHaveTextContent("30 円"); expect(stat("出金")).toHaveTextContent("50 円"); expect(stat("件数")).toHaveTextContent("2 件");
  expect(screen.getAllByText("30 円").find(e => e.closest("tbody"))?.closest("tr")?.children[2]).toHaveTextContent("30 円");
  expect(screen.getAllByText("50 円").find(e => e.closest("tbody"))?.closest("tr")?.children[3]).toHaveTextContent("50 円");
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"50"}});
  expect(stat("入金")).toHaveTextContent("0 円"); expect(stat("出金")).toHaveTextContent("50 円"); expect(stat("件数")).toHaveTextContent("1 件");
  fireEvent.click(screen.getByRole("button", {name:"絞り込みをすべて解除"}));
  fireEvent.click(screen.getByRole("button", {name:"仕訳の並べ替え・絞り込み"}));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByLabelText("済 (1)"));
  fireEvent.click(within(dialog).getByRole("button", {name:"OK"}));
  expect(stat("入金")).toHaveTextContent("0 円"); expect(stat("出金")).toHaveTextContent("50 円"); expect(stat("件数")).toHaveTextContent("1 件");
  fireEvent.change(screen.getByLabelText("期間"),{target:{value:"year"}});
  await waitFor(() => expect(fetcher.mock.lastCall?.[0]).toContain("period=year"));
  expect(fetcher.mock.lastCall?.[0]).not.toContain("page=");
});
it("computes signed card totals after content search", async () => {
  fixture("card");
  await screen.findAllByText("合計"); expect(stat("合計")).toHaveTextContent("20 円"); expect(stat("件数")).toHaveTextContent("2 件");
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"入金内容"}});
  expect(stat("合計")).toHaveTextContent("-30 円"); expect(stat("件数")).toHaveTextContent("1 件");
});
it("pages locally after filtering and keeps totals over all filtered rows", async () => {
  const transactions = Array.from({length:205}, (_,i) => ({...rows[1], mf_transaction_id:String(i),content:i < 150 ? "対象" : "その他"}));
  const fetcher = fixture("bank", transactions);
  await screen.findAllByText("件数"); expect(stat("出金")).toHaveTextContent("10,250 円"); expect(stat("件数")).toHaveTextContent("205 件");
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  expect(screen.getByText("2 / 3")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", {name:"検索"}), {target:{value:"対象"}});
  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  expect(stat("出金")).toHaveTextContent("7,500 円"); expect(stat("件数")).toHaveTextContent("150 件");
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  expect(screen.getAllByRole("row")).toHaveLength(51);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("offers available past fiscal years and opens a past-year deep link", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({account:{name:"銀行",kind:"bank",balance:0,fiscal_start_date:"2026-04-01"},transactions:[],fiscalYears:[2026,2025,2023]})));
  vi.stubGlobal("fetch",fetcher);
  render(<TransactionDetail id="b" initialPeriod="fy:2025" />);
  await screen.findByRole("option",{name:"2025年度"});
  expect(screen.getAllByRole("option").map(o=>o.textContent)).toEqual(["今月","先月","2026年度","2025年度","2023年度"]);
  expect(fetcher.mock.calls[0][0]).toContain("period=fy%3A2025");
});
