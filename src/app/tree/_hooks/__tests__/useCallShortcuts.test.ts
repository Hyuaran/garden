/**
 * useCallShortcuts.ts — ユニットテスト
 *
 * テストケース（最低 4 件）:
 *   1. F1 押下で onResult("トス") が呼ばれる
 *   2. input にフォーカスがある場合は F キーショートカットをスキップ
 *   3. Ctrl+Z で onRollback が呼ばれる
 *   4. localStorage で shortcuts 無効化された場合はイベントを無視
 *   5. Ctrl+→ で onNext が呼ばれる
 *   6. Esc で onCancelMemo が呼ばれる（input フォーカス中でも）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { useCallShortcuts } from "../useCallShortcuts";
import type { ShortcutHandlers, CallButtonsByKey } from "../useCallShortcuts";

const BUTTONS_BY_KEY: CallButtonsByKey = {
  F1: "トス",
  F2: "担不",
  F3: "見込 A",
  F4: "見込 B",
  F5: "見込 C",
  F6: "不通",
  F7: "NG お断り",
  F8: "NG クレーム",
  F9: "NG 契約済",
  F10: "NG その他",
};

function makeHandlers(overrides: Partial<ShortcutHandlers> = {}): ShortcutHandlers {
  return {
    onResult: vi.fn(),
    onRollback: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onCancelMemo: vi.fn(),
    onConfirmMemo: vi.fn(),
    ...overrides,
  };
}

/** キーボードイベントを window に発火するヘルパー */
function fireKey(
  key: string,
  options: KeyboardEventInit = {},
  targetElement?: HTMLElement
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  if (targetElement) {
    Object.defineProperty(event, "target", {
      writable: false,
      value: targetElement,
    });
  }
  window.dispatchEvent(event);
  return event;
}

describe("useCallShortcuts", () => {
  beforeEach(() => {
    localStorage.removeItem("tree.shortcuts_enabled");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("F1 押下で onResult('トス') が呼ばれる", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    fireKey("F1");

    expect(handlers.onResult).toHaveBeenCalledWith("トス");
    expect(handlers.onResult).toHaveBeenCalledTimes(1);
  });

  it("F10 押下で onResult('NG その他') が呼ばれる", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    fireKey("F10");

    expect(handlers.onResult).toHaveBeenCalledWith("NG その他");
  });

  it("input にフォーカスがある場合は F キーショートカットをスキップする", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    // input 要素をターゲットに見せる
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "F1",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      writable: false,
      value: input,
    });
    window.dispatchEvent(event);

    expect(handlers.onResult).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("Ctrl+Z で onRollback が呼ばれる（input フォーカスなし）", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    fireKey("z", { ctrlKey: true });

    expect(handlers.onRollback).toHaveBeenCalledTimes(1);
  });

  it("localStorage で shortcuts_enabled=false の場合はすべてのキーを無視する", () => {
    localStorage.setItem("tree.shortcuts_enabled", "false");
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    fireKey("F1");
    fireKey("z", { ctrlKey: true });
    fireKey("ArrowRight", { ctrlKey: true });

    expect(handlers.onResult).not.toHaveBeenCalled();
    expect(handlers.onRollback).not.toHaveBeenCalled();
    expect(handlers.onNext).not.toHaveBeenCalled();
  });

  it("Ctrl+→ で onNext が呼ばれる", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    fireKey("ArrowRight", { ctrlKey: true });

    expect(handlers.onNext).toHaveBeenCalledTimes(1);
  });

  it("Esc で onCancelMemo が呼ばれる（input フォーカス中でも有効）", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    // input フォーカスなし
    fireKey("Escape");
    expect(handlers.onCancelMemo).toHaveBeenCalledTimes(1);
  });

  it("Esc は input フォーカス中でも onCancelMemo を呼ぶ", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      writable: false,
      value: input,
    });
    window.dispatchEvent(event);

    expect(handlers.onCancelMemo).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it("input 内で Enter を押すと onConfirmMemo が呼ばれる", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      writable: false,
      value: input,
    });
    window.dispatchEvent(event);

    expect(handlers.onConfirmMemo).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it("Ctrl+Z は input フォーカス中はスキップする（ブラウザ標準の undo を維持）", () => {
    const handlers = makeHandlers();
    renderHook(() => useCallShortcuts(BUTTONS_BY_KEY, handlers));

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", {
      writable: false,
      value: input,
    });
    window.dispatchEvent(event);

    expect(handlers.onRollback).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
