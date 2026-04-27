/**
 * useCallRollback.ts — ユニットテスト
 *
 * テストケース（最低 3 件）:
 *   1. armRollback 後 canRollback が true になる
 *   2. 5s 以内に performRollback すると Server Action が呼ばれ成功する
 *   3. 5s 経過後は canRollback が false になり performRollback でエラーを返す
 *   4. performRollback 成功後は canRollback が false にリセットされる
 *   5. Server Action がエラーを返した場合は { success: false, error } を返す
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCallRollback } from "../useCallRollback";

// ============================================================
// モック
// ============================================================

const mockRollbackCallRecord = vi.fn();
const mockGetSession = vi.fn();

vi.mock("../../_actions/rollbackCallRecord", () => ({
  rollbackCallRecord: (...args: unknown[]) => mockRollbackCallRecord(...args),
}));

vi.mock("../../_lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// ============================================================
// テスト
// ============================================================

describe("useCallRollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetSession.mockResolvedValue({
      data: {
        session: { access_token: "valid-token" },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期状態: canRollback が false", () => {
    const { result } = renderHook(() => useCallRollback());
    expect(result.current.canRollback).toBe(false);
  });

  it("armRollback 後 canRollback が true になる", () => {
    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-001");
    });

    expect(result.current.canRollback).toBe(true);
  });

  it("5s 以内に performRollback すると成功する", async () => {
    mockRollbackCallRecord.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-001");
    });
    expect(result.current.canRollback).toBe(true);

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.performRollback();
    });

    expect(outcome?.success).toBe(true);
    expect(mockRollbackCallRecord).toHaveBeenCalledWith({
      call_id: "call-uuid-001",
      accessToken: "valid-token",
    });
    // 成功後は canRollback がリセット
    expect(result.current.canRollback).toBe(false);
  });

  it("5s 経過後は canRollback が false になる", () => {
    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-002");
    });
    expect(result.current.canRollback).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(result.current.canRollback).toBe(false);
  });

  it("5s 経過後に performRollback を呼ぶとエラーを返す（Server Action は呼ばれない）", async () => {
    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-003");
    });

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.performRollback();
    });

    expect(outcome?.success).toBe(false);
    expect(outcome?.error).toContain("5 秒経過");
    // Server Action は呼ばれない
    expect(mockRollbackCallRecord).not.toHaveBeenCalled();
  });

  it("Server Action が失敗した場合は { success: false, error } を返す", async () => {
    mockRollbackCallRecord.mockResolvedValue({
      success: false,
      errorCode: "DB_ERROR",
      errorMessage: "データベース更新に失敗しました",
    });

    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-004");
    });

    let outcome: { success: boolean; error?: string } | undefined;
    await act(async () => {
      outcome = await result.current.performRollback();
    });

    expect(outcome?.success).toBe(false);
    expect(outcome?.error).toBe("データベース更新に失敗しました");
    // 失敗後も canRollback は維持（再試行可能にしない設計のため false のまま）
    // NOTE: 実装は performRollback 失敗時に状態を変えない
  });

  it("armRollback を二回呼ぶとタイマーがリセットされる", () => {
    const { result } = renderHook(() => useCallRollback());

    act(() => {
      result.current.armRollback("call-uuid-005");
    });

    // 3s 経過（まだ有効）
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.canRollback).toBe(true);

    // 新しい call_id で再 arm（タイマーリセット）
    act(() => {
      result.current.armRollback("call-uuid-006");
    });

    // さらに 3s 経過（最初の arm から 6s だが、二回目の arm から 3s）
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.canRollback).toBe(true);

    // さらに 2s 経過（二回目の arm から 5s 超過）
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(result.current.canRollback).toBe(false);
  });
});
