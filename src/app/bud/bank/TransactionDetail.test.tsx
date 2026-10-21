import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TransactionDetail from "./TransactionDetail";
it("shows current balance, income, expense, journal state and requests the next page and period", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({account:{name:"銀行",kind:"bank",balance:500},amount:20,income:3000,expense:5000,total:101,transactions:[{mf_transaction_id:"1",date:"2026-10-20",content:"入金内容",side:"INCOME",value:30,journalizing_status:"done"},{mf_transaction_id:"2",date:"2026-10-19",content:"出金内容",side:"EXPENSE",value:50,journalizing_status:"none"}]})));
  vi.stubGlobal("fetch",fetcher);
  render(<TransactionDetail id="b" />);
  await screen.findByText("今の残高 500 円");
  // 口座は入金と出金を分けて出す（差し引きの「合計」は出さない）
  expect(screen.getByText("入金 3,000 円・出金 5,000 円・101 件")).toBeInTheDocument();
  expect(screen.queryByText(/^合計/)).not.toBeInTheDocument();
  expect(screen.getByText("済")).toBeInTheDocument(); expect(screen.getByText("未")).toBeInTheDocument();
  expect(screen.getByText("30 円").closest("tr")?.children[2]).toHaveTextContent("30 円");
  expect(screen.getByText("50 円").closest("tr")?.children[3]).toHaveTextContent("50 円");
  fireEvent.click(screen.getByRole("button",{name:"次へ"}));
  await waitFor(() => expect(fetcher.mock.lastCall?.[0]).toContain("page=2"));
  fireEvent.change(screen.getByLabelText("期間"),{target:{value:"year"}});
  await waitFor(() => expect(fetcher.mock.lastCall?.[0]).toContain("period=year&page=1"));
});
