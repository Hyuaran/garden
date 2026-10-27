import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import StatementsTabs from "./StatementsTabs";
import { SystemViewProvider } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";

vi.mock("../_components/BudGate", () => ({ BudGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("../_components/BudShell", () => ({ BudShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("./StatementsContent", () => ({ default: () => <p>一覧の内容</p> }));
vi.mock("./summary/StatementsSummaryContent", () => ({ default: () => <p>集計の内容</p> }));
vi.mock("./imports/StatementsImportsContent", () => ({ default: () => <p>履歴の内容</p> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: (url: string) => { throw new Error(url); } }));
beforeEach(() => window.history.replaceState(null, "", "/bud/statements"));

it("restores a bookmarked tab, updates the URL, and follows browser navigation", () => {
  window.history.replaceState(null, "", "?tab=summary&account=1");
  const { unmount } = render(<StatementsTabs />);
  expect(screen.getByText("集計の内容")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "取込履歴" }));
  expect(screen.getByText("履歴の内容")).toBeInTheDocument();
  expect(window.location.search).toContain("tab=imports");
  expect(window.location.search).toContain("account=1");
  unmount();
  render(<StatementsTabs />);
  expect(screen.getByRole("tab", { name: "取込履歴", selected: true })).toBeInTheDocument();
  act(() => { window.history.replaceState(null, "", "?tab=list"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByText("一覧の内容")).toBeInTheDocument();
});

it("shows only the permitted content and moves its gear into the heading", () => {
  window.history.replaceState(null, "", "?tab=summary");
  render(<SystemViewProvider value={{ pageKey: "bud-statements", admin: true, canAdd: false, tabs: ["list", "summary", "imports"].map(key => ({ key, label: key, allowed: key === "imports", canAdd: false })) }}><StatementsTabs /></SystemViewProvider>);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByText("履歴の内容")).toBeInTheDocument();
  expect(screen.queryByText("集計の内容")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toContainElement(screen.getByRole("button", { name: "見られる人の設定" }));
});

it.each(["summary", "imports"])("redirects the old %s bookmark", async tab => {
  const page = tab === "summary" ? await import("./summary/page") : await import("./imports/page");
  expect(() => page.default()).toThrow(`/bud/statements?tab=${tab}`);
});
