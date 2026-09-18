import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MASTER_MENUS } from "../_constants/types";

const mocks = vi.hoisted(() => ({
  pathname: "/root/employees",
  canWrite: true,
  signOut: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({
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

import { colors } from "../_constants/colors";
import { RootShell } from "./RootShell";

const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("RootShell", () => {
  it("社長スタイルのrailとRootメニューを表示する", () => {
    mocks.pathname = "/root/employees";
    mocks.canWrite = true;
    render(<RootShell><div>本文</div></RootShell>);

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
    expect(within(nav).queryByRole("link", { name: "KoT 同期履歴" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "ホーム" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(mocks.signOut).toHaveBeenCalledWith("manual");
    fireEvent.click(screen.getByRole("button", { name: "ダークにする" }));
    expect(mocks.toggleTheme).toHaveBeenCalled();
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
