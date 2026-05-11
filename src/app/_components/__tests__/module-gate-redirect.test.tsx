/**
 * ModuleGate redirect ロジック 単体テスト (2026-05-11、Task 6 §Step 6-2)
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 6 §Step 6-2
 *
 * テスト対象:
 *   - 未認証 → loginPath?returnTo=<current> へ redirect
 *   - role 不足 → /access-denied?module=<module> へ redirect
 *   - dev バイパス (NEXT_PUBLIC_AUTH_DEV_BYPASS=1) → children 描画、redirect しない
 *   - loading 中はリダイレクトしない
 *
 * mock 戦略:
 *   - next/navigation の useRouter を vi.fn() で replace 監視
 *   - ../../_lib/auth-unified の useAuthUnified を vi.fn() で各状態を返す
 *   - vi.hoisted で mock を top-hoist 対応
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { GardenRole } from "../../root/_constants/types";

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  useAuthUnifiedMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replaceMock,
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("../../_lib/auth-unified", () => ({
  useAuthUnified: () => mocks.useAuthUnifiedMock(),
}));

// ----------------------------------------------------------------------------
// テスト対象
// ----------------------------------------------------------------------------

import { ModuleGate } from "../ModuleGate";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

type AuthStateOverride = {
  loading?: boolean;
  isAuthenticated?: boolean;
  role?: GardenRole | null;
  userId?: string | null;
  employeeNumber?: string | null;
};

function setAuthState(state: AuthStateOverride) {
  mocks.useAuthUnifiedMock.mockReturnValue({
    loading: state.loading ?? false,
    isAuthenticated: state.isAuthenticated ?? false,
    userId: state.userId ?? null,
    role: state.role ?? null,
    employeeNumber: state.employeeNumber ?? null,
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
}

const ORIGINAL_DEV_BYPASS = process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS;

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("ModuleGate redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // dev バイパスは既定 OFF（個別テストで ON にする）
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS = "";
    // jsdom location を既定 path に
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/forest/dashboard");
    }
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS = ORIGINAL_DEV_BYPASS;
  });

  it("未認証 → loginPath?returnTo=<current path> へ redirect", () => {
    setAuthState({ loading: false, isAuthenticated: false, role: null });

    render(
      <ModuleGate module="forest">
        <div data-testid="protected">PROTECTED</div>
      </ModuleGate>,
    );

    // children は描画されない
    expect(screen.queryByTestId("protected")).toBeNull();
    // /login へ redirect、returnTo に encoded 現在パス
    expect(mocks.replaceMock).toHaveBeenCalledTimes(1);
    const url = mocks.replaceMock.mock.calls[0][0] as string;
    expect(url.startsWith("/login?returnTo=")).toBe(true);
    expect(url).toContain(encodeURIComponent("/forest/dashboard"));
  });

  it("認証済 + role 不足 → /access-denied?module=<module> へ redirect", () => {
    // forest は minRole=manager。staff は到達不可。
    setAuthState({
      loading: false,
      isAuthenticated: true,
      userId: "user-x",
      role: "staff",
    });

    render(
      <ModuleGate module="forest">
        <div data-testid="protected">PROTECTED</div>
      </ModuleGate>,
    );

    expect(screen.queryByTestId("protected")).toBeNull();
    expect(mocks.replaceMock).toHaveBeenCalledTimes(1);
    expect(mocks.replaceMock).toHaveBeenCalledWith(
      "/access-denied?module=forest",
    );
  });

  it("dev バイパス (NEXT_PUBLIC_AUTH_DEV_BYPASS=1) → 未認証でも children 描画、redirect しない", () => {
    process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS = "1";
    setAuthState({ loading: false, isAuthenticated: false, role: null });

    render(
      <ModuleGate module="forest">
        <div data-testid="protected">PROTECTED</div>
      </ModuleGate>,
    );

    expect(screen.queryByTestId("protected")).not.toBeNull();
    expect(mocks.replaceMock).not.toHaveBeenCalled();
  });

  it("loading 中はリダイレクトしない（authentication 確認待ち）", () => {
    setAuthState({ loading: true, isAuthenticated: false, role: null });

    render(
      <ModuleGate module="forest">
        <div data-testid="protected">PROTECTED</div>
      </ModuleGate>,
    );

    // children も描画されない（loading 中はスピナーのみ）
    expect(screen.queryByTestId("protected")).toBeNull();
    // 重要: replace は呼ばれない
    expect(mocks.replaceMock).not.toHaveBeenCalled();
  });
});
