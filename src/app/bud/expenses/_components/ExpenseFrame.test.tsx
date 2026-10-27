import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { BudFaithfulFrame } from "./ExpenseFrame";
vi.mock("../../_components/BudGate", () => ({ BudGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../_state/BudStateContext", () => ({ useBudState: () => ({ budRole: "admin" }) }));
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), "src/app/bud/expenses", file), "utf8");
const source = read("page.tsx");
const html = JSON.parse(source.match(/const SOURCE_HTML = (".*");/)![1]);
describe("expense presentation", () => {
 it("shows the Bud breadcrumb and Japanese heading, and preserves injected tab switching", () => {
  render(<BudFaithfulFrame route="/bud/expenses" title="経費精算" titleJp="" subtitle="" sourceCss="" sourceHtml={html} />);
  expect(screen.getByRole("navigation", { name: "現在地" })).toHaveTextContent("Bud経費精算");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("経費精算");
  expect(screen.getByRole("link", { name: "Bud" })).toHaveAttribute("href", "/bud/dashboard");
  const tabs = screen.getByRole("tablist");
  expect(tabs.textContent).not.toMatch(/Pending|Final|Booking|Categories/);
  fireEvent.click(screen.getByRole("tab", { name: "仕訳待ち" }));
  expect(document.getElementById("tab-booking")).toHaveClass("active");
  expect(document.getElementById("tab-submit")).not.toHaveClass("active");
 });
 it("keeps both page headers and review timestamp presentation consistent", () => {
  const review = read("_components/ExpenseReviewPanel.tsx");
  expect(review).toContain('<h1 style={{ fontSize: 30');
  expect(review).toContain('href: "/bud/expenses"');
  expect(review).toContain('label: "承認待ち（経理）"');
  expect(review).toContain('second: "2-digit"');
  expect(review).not.toContain("スマホ申請を確認して承認／差戻し。");
  expect(read("_components/ExpenseFrame.tsx")).toContain("injected.navigation");
 });
 it("contains no pictographic characters or serif fonts in presentation sources", () => {
  const files = fs.readdirSync(path.join(process.cwd(), "src/app/bud/expenses/_components")).filter(f => f.endsWith(".tsx") && !f.includes(".test."));
  const text = [source, ...files.map(f => read("_components/" + f))].join("\n");
  expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(text).not.toMatch(/Cormorant|Shippori|font-family:[^;]*serif/);
 });
});
