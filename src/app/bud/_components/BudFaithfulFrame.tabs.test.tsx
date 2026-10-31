import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { BudFaithfulFrame } from "./BudFaithfulFrame";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

vi.mock("./BudGate", () => ({ BudGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../_state/BudStateContext", () => ({ useBudState: () => ({ budRole: "admin" }) }));
vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search), useRouter: () => ({ refresh: vi.fn() }) }));
beforeEach(() => window.history.replaceState(null, "", "/bud/transfers"));

it.each(["transfers", "audit", "invoices", "journal", "settings", "profit", "masters", "payroll"])("%s switches actual injected panels and restores URL selection", route => {
  const source = readFileSync(`src/app/bud/${route}/${route === "profit" ? "ProfitContent.tsx" : "page.tsx"}`, "utf8");
  const html = JSON.parse(source.match(/const SOURCE_HTML = (".*");/)![1]);
  render(<BudFaithfulFrame route={`/bud/${route}`} title="確認" titleJp="" subtitle="" sourceCss="" sourceHtml={html} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.length).toBeGreaterThan(1);
  expect(document.querySelector(".tab-nav")).toBeNull();
  const target = tabs[1].getAttribute("data-tab")!;
  fireEvent.click(tabs[1]);
  expect(new URLSearchParams(window.location.search).get("tab")).toBe(target);
  expect(document.getElementById(`tab-${target}`)).toHaveClass("active");
  act(() => {
    window.history.replaceState(null, "", `?tab=${tabs[0].getAttribute("data-tab")}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  expect(document.getElementById(`tab-${target}`)).not.toHaveClass("active");
});

it("removes denied navigation and panels, keeps category filters, and keeps settings on the action row", () => {
  window.history.replaceState(null, "", "?tab=denied");
  const html = '<nav class="tab-nav"><button class="tab-item active" data-tab="allowed">一覧</button><button class="tab-item" data-tab="denied">秘密</button></nav><div class="tab-content active" id="tab-allowed"><button class="category-chip">カテゴリ</button></div><div class="tab-content" id="tab-denied">秘密の内容</div>';
  render(<SystemViewProvider value={{ pageKey: "bud-transfers", admin: true, canAdd: false, tabs: [{ key: "allowed", label: "一覧", allowed: true, canAdd: false }, { key: "denied", label: "秘密", allowed: false, canAdd: false }] }}><BudFaithfulFrame route="/bud/transfers" title="振込" titleJp="" subtitle="" sourceCss="" sourceHtml={html} /></SystemViewProvider>);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByText("秘密の内容")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "カテゴリ" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "見られる人の設定" }).closest("[data-system-tabs]")).toBeTruthy();
  expect(document.getElementById("tab-allowed")).toHaveClass("active");
});
