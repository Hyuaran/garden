/**
 * useAuthUnified Hook + AuthProvider 単体テスト (2026-05-11、Task 6 §Step 6-1)
 *
 * 仕様: docs/specs/plans/2026-05-11-garden-unified-auth-plan.md §Task 6 §Step 6-1
 *
 * テスト対象:
 *   - 初期状態: loading=true, isAuthenticated=false
 *   - signIn 成功 → isAuthenticated=true, role 取得
 *   - signIn 失敗 → error 設定
 *   - signOut → state クリア
 *
 * mock 戦略:
 *   - src/app/bloom/_lib/supabase.ts の export `supabase` を vi.mock で差し替え。
 *   - auth.signInWithPassword / auth.signOut / auth.getSession / auth.onAuthStateChange
 *     と from().select().eq().maybeSingle() を vi.fn() で実装。
 *
 * 既存 vitest config（vitest.config.ts: environment=jsdom）+ @testing-library/react
 * の renderHook + act + waitFor を使用、新規パッケージなし。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";

// ----------------------------------------------------------------------------
// Mocks: supabase client (../bloom/_lib/supabase の export を差し替え)
//
// vi.mock は top にホイストされるため、mock 内で参照する変数は vi.hoisted で
// 同期的に初期化する必要がある（さもないと "Cannot access ... before
// initialization" エラー）。
// ----------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  getSessionMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

const {
  signInWithPasswordMock,
  signOutMock,
  getSessionMock,
  onAuthStateChangeMock,
  maybeSingleMock,
} = mocks;

vi.mock("../../bloom/_lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPasswordMock,
      signOut: mocks.signOutMock,
      getSession: mocks.getSessionMock,
      onAuthStateChange: mocks.onAuthStateChangeMock,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mocks.maybeSingleMock,
    })),
  },
}));

// ----------------------------------------------------------------------------
// テスト対象を mock 設定後に import
// ----------------------------------------------------------------------------

import { AuthProvider, useAuthUnified } from "../auth-unified";

// ----------------------------------------------------------------------------
// テスト
// ----------------------------------------------------------------------------

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("useAuthUnified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 既定: 未ログイン状態
    getSessionMock.mockResolvedValue({ data: { session: null } });
    onAuthStateChangeMock.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    signOutMock.mockResolvedValue({ error: null });
    // sessionStorage クリア（signInUnified が module 別 unlock を set するため）
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  it("初期: loading=true, isAuthenticated=false（マウント直後の同期状態）", () => {
    // getSession を未解決 Promise にして、loading=true のまま観測
    getSessionMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuthUnified(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("signIn 成功 → isAuthenticated=true, role 取得", async () => {
    // 初期 getSession は未ログイン
    getSessionMock.mockResolvedValue({ data: { session: null } });
    // signIn 結果
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    // root_employees 取得結果
    maybeSingleMock.mockResolvedValue({
      data: { garden_role: "manager", employee_number: "0001" },
      error: null,
    });

    const { result } = renderHook(() => useAuthUnified(), { wrapper });

    // 初期 loading=false まで待機
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    // signIn 実行
    await act(async () => {
      const r = await result.current.signIn("1", "password");
      expect(r.success).toBe(true);
      expect(r.userId).toBe("user-123");
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.userId).toBe("user-123");
    expect(result.current.role).toBe("manager");
    expect(result.current.employeeNumber).toBe("0001");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "emp0001@garden.internal",
      password: "password",
    });
  });

  it("signIn 失敗 → success=false + error 設定、state は未認証のまま", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    signInWithPasswordMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const { result } = renderHook(() => useAuthUnified(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let signInResult: { success: boolean; error?: string } = { success: false };
    await act(async () => {
      signInResult = await result.current.signIn("9999", "wrong");
    });

    expect(signInResult.success).toBe(false);
    expect(signInResult.error).toBe("社員番号またはパスワードが正しくありません");
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
  });

  it("signOut → state クリア（userId / role / employeeNumber がすべて null）", async () => {
    // 初期ログイン済状態
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "user-abc" } } },
    });
    maybeSingleMock.mockResolvedValue({
      data: { garden_role: "staff", employee_number: "0042" },
      error: null,
    });

    const { result } = renderHook(() => useAuthUnified(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.role).toBe("staff");
    expect(result.current.employeeNumber).toBe("0042");

    // signOut
    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutMock).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.employeeNumber).toBeNull();
  });
});
