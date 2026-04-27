/**
 * Garden-Tree Confirm-wait 画面 — D-02 Step 9.3 テスト
 *
 * テストケース:
 *  T-CW01: 30分タイマーが表示される（待ち状態のアイテム）
 *  T-CW02: 期限超過アイテムに超過通知が表示される
 *  T-CW03: タイマーが 1 秒ごとにカウントアップする
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import ConfirmWaitPage from "../page";

describe("ConfirmWaitPage — D-02 Step 9.3 30分タイマー + 期限超過通知", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("T-CW01: 待ち状態のアイテムに「待ち」タイマーが表示される", () => {
    render(<ConfirmWaitPage />);
    // DEMO_WAIT_INITIAL_SEC: cw1 = 900秒（15:00）
    // 「待ち MM:SS / 30:00」形式が表示されること
    const timerElements = screen.getAllByText(/待ち \d{2}:\d{2} \/ 30:00/);
    expect(timerElements.length).toBeGreaterThan(0);
  });

  it("T-CW02: 30分超過済みアイテム（cw5=1860秒）に期限超過通知が表示される", () => {
    render(<ConfirmWaitPage />);
    // cw5 は DEMO_WAIT_INITIAL_SEC = 1860秒（31分）で開始 → 即時タイムアウト状態
    expect(
      screen.getByText(/同意確認期限（30分）を超過しています/)
    ).toBeInTheDocument();
  });

  it("T-CW03: 1秒経過でタイマーがカウントアップする", () => {
    render(<ConfirmWaitPage />);

    // 初期状態: cw1 = 900秒 → "15:00"
    const before = screen.getAllByText(/待ち 15:00/);
    expect(before.length).toBeGreaterThan(0);

    // 1秒進める
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // 1秒後: cw1 = 901秒 → "15:01"
    const after = screen.getAllByText(/待ち 15:01/);
    expect(after.length).toBeGreaterThan(0);
  });
});
