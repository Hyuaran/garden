import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { ThemeProvider } from "@/app/_lib/theme/ThemeProvider";
import ShachoShell from "./ShachoShell";
import { shouldHideSidebar } from "./shacho-shell-config";
import styles from "./shacho-shell.module.css";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), pathname: "/system" }));
vi.mock("@/app/_lib/supabase/browser", () => ({ createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

const manager = { name: "責任者A", company: "株式会社A", role: "manager" as const };
function renderShell(activePath = "/system", user: ComponentProps<typeof ShachoShell>["user"] = manager) {
  mocks.pathname = activePath;
  return render(<ThemeProvider><ShachoShell user={user}><p>本文</p></ShachoShell></ThemeProvider>);
}

describe("ShachoShell", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("shows System first followed by the Garden modules without a duplicate System link", () => {
    renderShell();
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    const railInner = within(rail).getByRole("link", { name: "System：社内システム" }).parentElement;
    const labels = within(rail).getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(railInner).toHaveClass(styles.railInner);
    expect(railInner?.parentElement).toBe(rail);
    expect(labels).toHaveLength(13);
    expect(labels.map((label) => label?.split("：")[0])).toEqual(["System", ...GARDEN_SHELL_MODULES.map((item) => item.name)]);
    expect(labels.filter((label) => label === "System：社内システム")).toHaveLength(1);
    expect(within(rail).getByRole("link", { name: "Leaf：案件アプリ" })).toBeInTheDocument();
    expect(within(rail).getByRole("link", { name: "Soil：データベース" })).toBeInTheDocument();
    expect(within(rail).getByRole("link", { name: "Root：組織台帳" })).toBeInTheDocument();
    expect(within(rail).getAllByRole("link")[0]).toHaveAttribute("href", "/system");
    expect(within(rail).getAllByRole("link")[0]).toHaveClass(styles.current);
  });

  it("links the gold tree emblem and Garden wordmark to home without image optimization", () => {
    renderShell();
    const home = screen.getByRole("link", { name: "Garden ホームへ" });
    const logo = home.querySelector("img");
    expect(home).toHaveAttribute("href", "/");
    expect(logo).toHaveAttribute("src", "/themes/garden-shell/images/login/mark-tree-emblem.png");
    expect(logo?.getAttribute("src")).not.toContain("/_next/image");
    expect(screen.getByText("System ／ 社内システム")).toBeInTheDocument();
  });

  it("toggles and saves the root theme", async () => {
    renderShell();
    await waitFor(() => expect(localStorage.getItem("garden.theme")).toBe("light"));
    const button = screen.getByRole("button", { name: "ダークにする" });
    fireEvent.click(button);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("garden.theme")).toBe("dark");
    expect(localStorage.getItem("garden-system-theme")).toBeNull();
    expect(screen.getByRole("button", { name: "ライトにする" })).toBeInTheDocument();
  });

  it("shows the signed-in account name beside the shared actions", () => {
    renderShell();
    expect(screen.getByText("責任者Aさん")).toBeInTheDocument();
    expect(screen.getByText("責任者Aさん").parentElement).toContainElement(screen.getByRole("button", { name:"ダークにする" }));
  });

  it("keeps the sidebar content in the sticky inner wrapper", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Systemメニュー" });
    expect(nav.parentElement).toHaveClass(styles.navFrame);
    expect(nav.parentElement?.parentElement).toHaveClass(styles.sideInner);
    expect(nav.parentElement?.parentElement).toContainElement(screen.getByRole("link", { name: "Garden ホームへ" }));
    expect(nav.parentElement?.parentElement).toContainElement(screen.getByText("株式会社A ／ マネージャー"));
  });

  it("restores a saved theme", async () => {
    localStorage.setItem("garden.theme", "dark");
    renderShell();
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
    expect(document.documentElement).toHaveClass("dark");
    expect(await screen.findByRole("button", { name: "ライトにする" })).toBeInTheDocument();
  });

  it("ignores the obsolete System-only theme key", async () => {
    localStorage.setItem("garden-system-theme", "dark");
    renderShell();
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "light"));
    expect(localStorage.getItem("garden.theme")).toBe("light");
    expect(screen.getByRole("button", { name: "ダークにする" })).toBeInTheDocument();
  });

  it("hides contract management below manager", () => {
    renderShell("/system", { ...manager, role: "staff" });
    expect(screen.queryByRole("link", { name: "契約書管理" })).not.toBeInTheDocument();
  });

  it("marks mypage as the current System menu item", () => {
    renderShell("/system/mypage");
    expect(screen.getByRole("link", { name: "自分の情報", current: "page" })).toBeInTheDocument();
  });

  it("marks call metrics as the current System menu item", () => {
    renderShell("/system/call-metrics");
    expect(screen.getByRole("link", { name: "テレマ コール集計", current: "page" })).toBeInTheDocument();
  });

  it("marks contracts as the current System menu item", () => {
    renderShell("/system/contracts");
    expect(screen.getByRole("link", { name: "契約書管理", current: "page" })).toBeInTheDocument();
  });

  it.each([
    ["/system", "ホーム"],
    ["/system/docs", "資料"],
    ["/system/docs/company", "資料"],
    ["/system/mypage", "自分の情報"],
    ["/system/attendance", "勤怠打刻"],
    ["/system/shift", "シフト"],
    ["/system/zenkaku", "前確依頼"],
    ["/system/call-metrics", "テレマ コール集計"],
    ["/system/contracts", "契約書管理"],
  ])("derives the current menu from %s", (pathname, label) => {
    renderShell(pathname);
    expect(screen.getByRole("link", { name: label, current: "page" })).toBeInTheDocument();
  });

  it("keeps the attendance item current on its nested sync page", () => {
    renderShell("/system/attendance/sync-status");
    expect(screen.getByRole("link", { name: "勤怠打刻", current: "page" })).toBeInTheDocument();
  });

  it("filters the rail with the shared staff visibility matrix", () => {
    renderShell("/system", { ...manager, role: "staff" });
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    expect(within(rail).queryByRole("link", { name: /^Soil：/ })).not.toBeInTheDocument();
    expect(within(rail).queryByRole("link", { name: /^Rill：/ })).not.toBeInTheDocument();
    expect(within(rail).getByRole("link", { name: "System：社内システム" })).toBeInTheDocument();
  });

  it("keeps all twelve modules for super admins", () => {
    renderShell("/system", { ...manager, role: "super_admin" });
    const rail = screen.getByRole("complementary", { name: "Gardenシリーズ" });
    expect(within(rail).getAllByRole("link")).toHaveLength(13);
  });

  it.each(["super_admin", "admin", "manager", "staff", "cs"] as const)(
    "keeps the rail and sidebar for %s",
    (role) => {
      renderShell("/system/mypage", { ...manager, role });
      expect(screen.getByRole("complementary", { name: "Gardenシリーズ" })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: "Systemメニュー" })).toBeInTheDocument();
      expect(screen.getByRole("main")).not.toHaveClass(styles.mainFull);
      for (const label of ["自分の情報", "勤怠打刻", "シフト", "前確依頼"])
        expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    },
  );

  it("keeps the current menu in the specified order and uses SVG-only new icons", () => {
    renderShell();
    const nav = screen.getByRole("navigation", { name: "Systemメニュー" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "ホーム", "資料", "入社手続き", "自分の情報", "勤怠打刻", "シフト", "前確依頼",
      "テレマ コール集計", "契約書管理", "関電トスポータル",
    ]);
    for (const label of ["資料", "シフト", "前確依頼"]) {
      const link = within(nav).getByRole("link", { name: label });
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it.each(["closer", "toss", "outsource"] as const)(
    "hides both sidebars but keeps shared actions for %s",
    (role) => {
      renderShell("/system/mypage", { ...manager, role });
      expect(screen.queryByRole("complementary", { name: "Gardenシリーズ" })).not.toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Systemメニュー" })).not.toBeInTheDocument();
      expect(screen.getByRole("main")).toHaveClass(styles.mainFull);
      expect(screen.getByText("責任者Aさん")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "ダークにする" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
    },
  );

  it("explicitly treats outsource as sidebarless without role-order comparison", () => {
    expect(shouldHideSidebar("outsource")).toBe(true);
    expect(shouldHideSidebar("staff")).toBe(false);
    expect(shouldHideSidebar("manager")).toBe(false);
  });
});
