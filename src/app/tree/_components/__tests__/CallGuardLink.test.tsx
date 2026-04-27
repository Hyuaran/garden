/**
 * CallGuardLink.tsx — ユニットテスト
 *
 * テストケース（最低 3 件）:
 *   1. guardActive=false のとき通常遷移（モーダル非表示）
 *   2. guardActive=true のときリンクをクリックするとモーダルが表示される
 *   3. モーダルで「続行する」を押すと router.push が呼ばれ、モーダルが閉じる
 *   4. モーダルで「キャンセル」を押すと router.push は呼ばれず、モーダルが閉じる
 *   5. guardActive=false のとき onClick コールバックが呼ばれる
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CallGuardLink } from "../CallGuardLink";

// ============================================================
// モック: next/link / next/navigation
// ============================================================

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    onClick,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    href: string;
    [key: string]: unknown;
  }) => (
    <a
      href={typeof href === "string" ? href : "#"}
      onClick={onClick}
      {...rest}
    >
      {children}
    </a>
  ),
}));

// ============================================================
// テスト
// ============================================================

describe("CallGuardLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guardActive=false のとき通常遷移 — モーダルは表示されない", () => {
    render(
      <CallGuardLink href="/tree/home" guardActive={false}>
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("guardActive=true のときリンクをクリックするとモーダルが表示される", () => {
    render(
      <CallGuardLink href="/tree/home" guardActive={true}>
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("通話中の画面遷移確認")).toBeDefined();
  });

  it("「続行する」を押すと router.push が呼ばれ、モーダルが閉じる", () => {
    render(
      <CallGuardLink href="/tree/home" guardActive={true}>
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByText("続行する"));

    expect(mockPush).toHaveBeenCalledWith("/tree/home");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("「キャンセル」を押すと router.push は呼ばれず、モーダルが閉じる", () => {
    render(
      <CallGuardLink href="/tree/home" guardActive={true}>
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.click(screen.getByText("キャンセル"));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("guardActive=false のとき onClick コールバックが呼ばれる", () => {
    const handleClick = vi.fn();

    render(
      <CallGuardLink href="/tree/home" guardActive={false} onClick={handleClick}>
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("guardMessage を指定するとカスタムメッセージがモーダルに表示される", () => {
    render(
      <CallGuardLink
        href="/tree/home"
        guardActive={true}
        guardMessage="カスタム警告メッセージです"
      >
        ホームへ
      </CallGuardLink>,
    );

    fireEvent.click(screen.getByText("ホームへ"));

    expect(screen.getByText("カスタム警告メッセージです")).toBeDefined();
  });
});
