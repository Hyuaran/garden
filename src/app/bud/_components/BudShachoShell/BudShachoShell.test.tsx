import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BUD_GARDEN_PAGE_MENU } from "../bud-garden-menu";
import { resolveBudActivePath } from "./bud-navigation";

const mocks = vi.hoisted(() => ({ pathname: "/bud/expenses/review", signOut: vi.fn(), toggleTheme: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("../BudGate", () => ({ BudGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/app/_components/notices/NoticeProvider", () => ({ useNotices: () => ({ unreadCount: 0 }) }));
vi.mock("next/image", () => ({ default: ({ unoptimized: _, ...props }: Record<string, unknown>) => <img {...props} /> }));
vi.mock("@/app/_lib/theme/ThemeProvider", () => ({ useTheme: () => ({ theme: "light", toggleTheme: mocks.toggleTheme }) }));
vi.mock("../../_state/BudStateContext", () => ({ useBudState: () => ({
  gardenRole: "super_admin", budRole: "admin", sessionUser: { name: "利用者" }, signOut: mocks.signOut,
}) }));

import { BudShachoShell } from "./BudShachoShell";

describe("BudShachoShell", () => {
  it("keeps the existing menu order and highlights expense review", () => {
    mocks.pathname = "/bud/expenses/review";
    render(<BudShachoShell><div>本文</div></BudShachoShell>);
    const nav = screen.getByRole("navigation", { name: "Budメニュー" });
    expect(within(nav).getAllByRole("link").map(link => link.textContent)).toEqual(BUD_GARDEN_PAGE_MENU.filter(item => !item.divider).map(item => item.label));
    expect(within(nav).getByRole("link", { name: "経費精算" })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByLabelText("Gardenシリーズ")).getByLabelText("Bud：経理・取引")).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByLabelText("お知らせ")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(mocks.signOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ダークにする" }));
    expect(mocks.toggleTheme).toHaveBeenCalled();
    expect(screen.getByText("本文")).toBeInTheDocument();
  });

  it("hides only the bank page title in the top bar", () => {
    mocks.pathname = "/bud/bank";
    const view = render(<BudShachoShell>本文</BudShachoShell>);
    expect(screen.queryByText("Bud ／ 口座残高・カード利用")).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name:"ログアウト"})).toBeInTheDocument();
    mocks.pathname = "/bud/expenses/review";
    view.rerender(<BudShachoShell>本文</BudShachoShell>);
    expect(screen.getByText("Bud ／ 経費精算")).toBeInTheDocument();
  });

  it("closes the drawer with close, backdrop, Escape and navigation, restoring focus", () => {
    mocks.pathname = "/bud/transfers/new-regular";
    render(<BudShachoShell>本文</BudShachoShell>);
    const open = screen.getByRole("button", { name: "メニューを開く" });
    for (const action of ["close", "backdrop", "escape", "link"]) {
      fireEvent.click(open);
      const drawer = screen.getByRole("dialog", { name: "Budメニュー" });
      expect(within(drawer).getByRole("button", { name: "閉じる" })).toHaveFocus();
      expect(within(drawer).getByRole("link", { name: "振込管理" })).toHaveAttribute("aria-current", "page");
      if (action === "close") fireEvent.click(within(drawer).getByRole("button", { name: "閉じる" }));
      if (action === "backdrop") fireEvent.click(screen.getByRole("button", { name: "メニューを閉じる" }));
      if (action === "escape") fireEvent.keyDown(window, { key: "Escape" });
      if (action === "link") fireEvent.click(within(drawer).getByRole("link", { name: "振込管理" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(open).toHaveFocus();
    }
  });

  it("excludes login and supports transitions to and from it", () => {
    mocks.pathname = "/bud/login";
    const view = render(<BudShachoShell>ログイン本文</BudShachoShell>);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByText("ログイン本文")).toBeInTheDocument();
    mocks.pathname = "/bud/dashboard";
    view.rerender(<BudShachoShell>本文</BudShachoShell>);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    mocks.pathname = "/bud/login";
    view.rerender(<BudShachoShell>ログイン本文</BudShachoShell>);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it.each([
    ["/bud/shiwakechou", "/bud/journal"], ["/bud/statements/imports", "/bud/bank"],
    ["/bud/transfers/csv-export", "/bud/transfers"], ["/bud/expenses-other", null],
  ])("resolves %s to %s", (path, active) => expect(resolveBudActivePath(path)).toBe(active));
});
