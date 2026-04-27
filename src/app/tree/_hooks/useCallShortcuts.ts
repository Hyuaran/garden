"use client";

/**
 * Tree Phase D-02 Step 5: FM 互換ショートカット
 * spec §4、判 0-4 確定: preventDefault + ユーザー教育
 *
 * キー割当:
 *   F1  → トス（Sprout）/ 受注（Branch）
 *   F2  → 担不
 *   F3  → 見込 A
 *   F4  → 見込 B
 *   F5  → 見込 C
 *   F6  → 不通
 *   F7  → NG お断り
 *   F8  → NG クレーム
 *   F9  → NG 契約済
 *   F10 → NG その他
 *   Ctrl+Z   → 巻き戻し（5s 以内）
 *   Ctrl+→   → 次リスト
 *   Ctrl+←   → 前リスト（結果未入力時のみ）
 *   Esc      → メモ入力キャンセル
 *   Enter    → メモ確定（input のみ）
 */

import { useEffect, useRef } from "react";

export type ShortcutHandlers = {
  onResult: (label: string) => void;
  onRollback?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onCancelMemo?: () => void;
  onConfirmMemo?: () => void;
};

/** キー → ボタンラベルのマッピング。呼び出し側で定義して渡す */
export type CallButtonsByKey = Record<string, string>;

const SHORTCUT_ENABLED_KEY = "tree.shortcuts_enabled";

function isShortcutEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SHORTCUT_ENABLED_KEY);
  return v === null || v === "true";
}

/**
 * FM 互換ショートカット hook
 *
 * @param buttonsByKey  F キー → ボタンラベルのマッピング（e.g. { F1: 'トス', F2: '担不', ... }）
 * @param handlers      各ショートカット発火時のコールバック
 */
export function useCallShortcuts(
  buttonsByKey: CallButtonsByKey,
  handlers: ShortcutHandlers
) {
  const handlersRef = useRef(handlers);
  const buttonsRef = useRef(buttonsByKey);

  // ref を最新値に同期（レンダーではなく effect 内で更新）
  useEffect(() => {
    handlersRef.current = handlers;
  });
  useEffect(() => {
    buttonsRef.current = buttonsByKey;
  });

  useEffect(() => {
    if (!isShortcutEnabled()) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() ?? "";
      const isInputFocused = tagName === "INPUT" || tagName === "TEXTAREA";

      // F1–F10: input/textarea にフォーカスがある場合は無効
      if (/^F([1-9]|10)$/.test(e.key)) {
        if (isInputFocused) return;
        const label = buttonsRef.current[e.key];
        if (label) {
          e.preventDefault();
          handlersRef.current.onResult(label);
        }
        return;
      }

      // Ctrl+Z: 巻き戻し（input 内ではブラウザ標準動作を維持）
      if (e.ctrlKey && e.key === "z") {
        if (isInputFocused) return;
        e.preventDefault();
        handlersRef.current.onRollback?.();
        return;
      }

      // Ctrl+→: 次リスト
      if (e.ctrlKey && e.key === "ArrowRight") {
        if (isInputFocused) return;
        e.preventDefault();
        handlersRef.current.onNext?.();
        return;
      }

      // Ctrl+←: 前リスト
      if (e.ctrlKey && e.key === "ArrowLeft") {
        if (isInputFocused) return;
        e.preventDefault();
        handlersRef.current.onPrev?.();
        return;
      }

      // Esc: メモキャンセル（input 内でも有効）
      if (e.key === "Escape") {
        handlersRef.current.onCancelMemo?.();
        return;
      }

      // Enter: メモ確定（input 内のみ、textarea の改行は維持）
      if (e.key === "Enter" && isInputFocused) {
        if (tagName === "INPUT") {
          handlersRef.current.onConfirmMemo?.();
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // buttonsByKey / handlers は ref 経由で常に最新値を参照
}
