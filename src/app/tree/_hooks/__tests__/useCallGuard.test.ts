/**
 * useCallGuard.ts — ユニットテスト
 *
 * テストケース（最低 3 件）:
 *   1. isCalling=true で beforeunload イベントリスナーが登録される
 *   2. isCalling=false で beforeunload イベントリスナーが登録されない
 *   3. cleanup 時にリスナーが解除される
 *   4. hasOfflineQueue=true でも beforeunload が登録される
 *   5. isCalling=false かつ hasOfflineQueue=false ではリスナー未登録
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCallGuard } from "../useCallGuard";

describe("useCallGuard", () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, "addEventListener");
    removeEventSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isCalling=true のとき beforeunload リスナーが登録される", () => {
    renderHook(() => useCallGuard({ isCalling: true }));

    expect(addEventSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("isCalling=false かつ hasOfflineQueue=false のとき beforeunload リスナーが登録されない", () => {
    renderHook(() =>
      useCallGuard({ isCalling: false, hasOfflineQueue: false }),
    );

    const beforeunloadCalls = (addEventSpy.mock.calls as [string, unknown][]).filter(
      ([event]) => event === "beforeunload",
    );
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it("cleanup 時にリスナーが解除される", () => {
    const { unmount } = renderHook(() => useCallGuard({ isCalling: true }));

    // リスナー登録済みを確認
    expect(addEventSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    unmount();

    // cleanup で removeEventListener が呼ばれる
    expect(removeEventSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("hasOfflineQueue=true のとき beforeunload リスナーが登録される", () => {
    renderHook(() =>
      useCallGuard({ isCalling: false, hasOfflineQueue: true }),
    );

    expect(addEventSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("isCalling=false から true に変わるとリスナーが登録される", () => {
    const { rerender } = renderHook(
      ({ isCalling }: { isCalling: boolean }) =>
        useCallGuard({ isCalling }),
      { initialProps: { isCalling: false } },
    );

    // 初期状態では登録なし
    const beforeunloadCallsBefore = (addEventSpy.mock.calls as [string, unknown][]).filter(
      ([event]) => event === "beforeunload",
    );
    expect(beforeunloadCallsBefore).toHaveLength(0);

    // isCalling=true に変更
    rerender({ isCalling: true });

    const beforeunloadCallsAfter = (addEventSpy.mock.calls as [string, unknown][]).filter(
      ([event]) => event === "beforeunload",
    );
    expect(beforeunloadCallsAfter.length).toBeGreaterThan(0);
  });

  it("beforeunload ハンドラが e.preventDefault と e.returnValue を設定する", () => {
    renderHook(() =>
      useCallGuard({ isCalling: true, message: "テスト警告メッセージ" }),
    );

    // 登録されたハンドラを取得
    const handler = (addEventSpy.mock.calls as [string, unknown][]).find(
      ([event]) => event === "beforeunload",
    )?.[1] as ((e: BeforeUnloadEvent) => void) | undefined;

    expect(handler).toBeDefined();

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: "",
    } as unknown as BeforeUnloadEvent;

    handler!(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.returnValue).toBe("テスト警告メッセージ");
  });
});
