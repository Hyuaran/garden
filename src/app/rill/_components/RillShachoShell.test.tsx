import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RillShachoShell from "./RillShachoShell";

const mocks = vi.hoisted(() => ({
  pathname: "/rill/mail",
  toggleTheme: vi.fn(),
  signOut: vi.fn(),
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

vi.mock("@/app/_lib/supabase/browser", () => ({
  createBrowserClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

vi.mock("@/app/_components/layout/GardenShell/GardenShell", () => ({
  readFavorites: () => [],
  readFavoritesRaw: () => "[]",
  subscribeFavorites: () => () => undefined,
  writeFavorites: vi.fn(),
}));

vi.mock("@/app/_components/shortcuts/ShortcutsModal", () => ({
  ShortcutsModal: () => null,
}));

describe("RillShachoShell", () => {
  it("モバイル引き出しを開閉でき、モジュール・メニュー・利用者欄を表示する", () => {
    render(
      <RillShachoShell user={{ name: "東海林 美琴", company: "株式会社ヒュアラン", role: "super_admin", roleLabel: "全権管理者" }}>
        <div>本文</div>
      </RillShachoShell>,
    );

    const open = screen.getByRole("button", { name: "メニューを開く" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");

    let drawer = screen.getByRole("dialog", { name: "Rill メニュー" });
    expect(within(drawer).getByRole("link", { name: "System：社内システム" })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "Rill：メッセージ", current: "page" })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /Mail/, current: "page" })).toBeInTheDocument();
    expect(within(drawer).getByText("株式会社ヒュアラン")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "閉じる" })).toHaveFocus();

    fireEvent.click(within(drawer).getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog", { name: "Rill メニュー" })).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    fireEvent.click(open);
    fireEvent.click(screen.getByRole("button", { name: "メニューを閉じる" }));
    expect(screen.queryByRole("dialog", { name: "Rill メニュー" })).not.toBeInTheDocument();

    fireEvent.click(open);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Rill メニュー" })).not.toBeInTheDocument();

    fireEvent.click(open);
    drawer = screen.getByRole("dialog", { name: "Rill メニュー" });
    fireEvent.click(within(drawer).getByRole("link", { name: /Mail/ }));
    expect(screen.queryByRole("dialog", { name: "Rill メニュー" })).not.toBeInTheDocument();
  });
});
