import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.hoisted(()=>{process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';});
import { MASTER_MENUS } from "../_constants/types";

const mocks = vi.hoisted(() => ({
  pathname: "/root/employees",
  canWrite: true,
  viewAccess: undefined as Record<string, boolean> | undefined,
  signOut: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => mocks.pathname,
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: { alt?: string; [key: string]: unknown }) => <img alt={alt} {...props} />,
}));

vi.mock("@/app/_lib/theme/ThemeProvider", () => ({
  useTheme: () => ({
    theme: "light",
    toggleTheme: mocks.toggleTheme,
  }),
}));

vi.mock("../_state/RootStateContext", () => ({
  useRootState: () => ({
    canWrite: mocks.canWrite,
    viewAccess: mocks.viewAccess,
    gardenRole: "super_admin",
    rootUser: {
      name: "東海林 美琴",
      company_id: "COMP-001",
      company_name: "株式会社ヒュアラン",
      garden_role: "super_admin",
    },
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/app/_components/notices/NoticeProvider", () => ({ useNotices: () => ({ unreadCount: 0 }) }));

import { colors } from "../_constants/colors";
import { RootShell } from "./RootShell";

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("RootShell", () => {
  it("閲覧設定で許可された画面だけをメニューに出す", () => {
    mocks.viewAccess = { "root-home": false, "root-employees": true };
    try {
      render(<RootShell><div>本文</div></RootShell>);
      const nav = screen.getByLabelText("Rootメニュー");
      expect(within(nav).getByRole("link", { name: "従業員マスタ" })).toBeInTheDocument();
      expect(within(nav).queryByRole("link", { name: "ホーム" })).not.toBeInTheDocument();
      expect(within(nav).queryByRole("link", { name: "法人マスタ" })).not.toBeInTheDocument();
    } finally { mocks.viewAccess = undefined; }
  });
  it("社長スタイルのrailとRootメニューを表示する", () => {
    mocks.pathname = "/root/employees";
    mocks.canWrite = true;
    render(<RootShell><div>本文</div></RootShell>);

    expect(screen.getAllByLabelText("お知らせ")).toHaveLength(2);
    const viewButtons = screen.getAllByRole("button", { name: "この画面は表示の切り替えがありません" });
    expect(viewButtons).toHaveLength(2);
    for (const button of viewButtons) expect(button).toBeDisabled();
    const rail = screen.getByLabelText("Gardenシリーズ");
    expect(within(rail).getByLabelText("Root：組織台帳")).toHaveAttribute("aria-current", "page");
    expect(within(rail).getByLabelText("System：社内システム")).not.toHaveAttribute("aria-current");

    const nav = screen.getByLabelText("Rootメニュー");
    expect(within(nav).getByRole("link", { name: "ホーム" })).toBeInTheDocument();
    for (const menu of MASTER_MENUS) {
      expect(within(nav).getByRole("link", { name: menu.title })).toBeInTheDocument();
    }
    expect(nav.textContent ?? "").not.toMatch(emojiPattern);
    expect(within(nav).getByRole("link", { name: "従業員マスタ" })).toHaveAttribute("aria-current", "page");
    // 利用者欄は会社名と役職を 2 行に分けて出す（1 行に詰めると最後の 1 文字が落ちた）
    expect(screen.getByText("株式会社ヒュアラン")).toBeInTheDocument();
    expect(screen.getByText("全権管理者")).toBeInTheDocument();
  });

  it("adminOnlyはcanWriteのときだけ表示し、ログアウトとテーマ切替を出す", () => {
    mocks.pathname = "/root";
    mocks.canWrite = false;
    render(<RootShell><div>本文</div></RootShell>);

    const nav = screen.getByLabelText("Rootメニュー");
    expect(within(nav).queryByRole("link", { name: "口座の点検" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "KING OF TIME 同期履歴" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "ホーム" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(mocks.signOut).toHaveBeenCalledWith("manual");
    fireEvent.click(screen.getByRole("button", { name: "ダークにする" }));
    expect(mocks.toggleTheme).toHaveBeenCalled();
  });

  it("モバイル引き出しを開閉でき、モジュール・メニュー・利用者欄を表示する", () => {
    mocks.pathname = "/root/employees";
    mocks.canWrite = true;
    render(<RootShell><div>本文</div></RootShell>);

    const open = screen.getByRole("button", { name: "メニューを開く" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    let drawer = screen.getByRole("dialog", { name: "Rootメニュー" });
    const moduleLinks = within(drawer).getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(moduleLinks).toContain("System：社内システム");
    expect(within(drawer).getByRole("link", { name: "Root：組織台帳", current: "page" })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "従業員マスタ", current: "page" })).toBeInTheDocument();
    expect(within(drawer).getByText("株式会社ヒュアラン")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "閉じる" })).toHaveFocus();

    fireEvent.click(within(drawer).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "Rootメニュー" })).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "メニューを閉じる" }));
    expect(screen.queryByRole("dialog", { name: "Rootメニュー" })).not.toBeInTheDocument();

    fireEvent.click(open);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Rootメニュー" })).not.toBeInTheDocument();

    fireEvent.click(open);
    drawer = screen.getByRole("dialog", { name: "Rootメニュー" });
    fireEvent.click(within(drawer).getByRole("link", { name: "ホーム" }));
    expect(screen.queryByRole("dialog", { name: "Rootメニュー" })).not.toBeInTheDocument();
  });
});

describe("Root colors", () => {
  it("全キーがRoot CSS変数を参照し、headingを持つ", () => {
    expect(colors.heading).toBe("var(--root-heading)");
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^var\(--root-/);
    }
  });
});
