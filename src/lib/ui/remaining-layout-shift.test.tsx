import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import BudTableLoading from "@/app/bud/_components/BudTableLoading";

it("retains the same hidden timestamp width before and after loading", () => {
  const { container, rerender } = render(<UpdatedStamp label="" />);
  const reserve = container.querySelector('[aria-hidden="true"]')!;
  const initial = reserve.outerHTML;
  rerender(<UpdatedStamp label="" date="2026-11-02T06:18:00Z" />);
  expect(container.querySelector('[aria-hidden="true"]')!.outerHTML).toBe(initial);
  expect(reserve.textContent).toBe("最終更新：2026/11/02(月) 15:18");
  const css = readFileSync("src/app/system/_components/UpdatedStamp/updated-stamp.module.css", "utf8");
  expect(css).toContain("grid-area:1 / 1");
  expect(css).toContain("visibility:hidden");
  expect(css).toContain("tabular-nums");
});

it("renders a table header and reserved row heights while loading", () => {
  render(<BudTableLoading headers={["法人", "銀行", "合計"]} rows={8} rowHeight={64} />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(screen.getAllByRole("row")).toHaveLength(9);
  expect(screen.getAllByRole("row")[1]).toHaveStyle({ height: "64px" });
});

it("reserves bank, card and transfer destinations in their first render", () => {
  const bank = readFileSync("src/app/bud/bank/BankAccounts.tsx", "utf8");
  expect(bank).toContain("loading && snapshot.accounts.length === 0");
  expect(bank).toContain("<BudTableLoading");
  expect(bank).toContain('tab === "bank" ? ["法人", "銀行", "合計"] : ["カード", "利用金額", "件数"]');
  const transfers = readFileSync("src/app/bud/transfers/page.tsx", "utf8");
  expect(transfers).toContain("#trf-overview-calendar-mount { min-height: 860px; }");
  const calendar = readFileSync("src/app/bud/transfers/_components/TransferAmountCalendar.tsx", "utf8");
  expect(calendar).toContain('className="trf-amount-day-grid" aria-busy={loading}');
  expect(calendar).not.toContain("{loading ? (");
  expect(readFileSync("src/app/bud/_components/BudFaithfulFrame.module.css", "utf8")).toContain(".access-badge) { min-width:20em;");
});
