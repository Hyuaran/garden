"use client";

/**
 * Tree Phase D-02 通話中の画面遷移ガード
 * spec §6
 */

import { useEffect } from "react";

export type CallGuardConfig = {
  isCalling: boolean;            // 通話中（架電画面表示中 + アクティブセッション）
  hasOfflineQueue?: boolean;      // オフラインキュー > 0
  message?: string;
};

/**
 * beforeunload イベントで通話中のタブ閉じ・ブラウザ戻るを警告。
 * Chrome 等は自動で標準ダイアログを表示する（カスタムメッセージは無視されるが要 returnValue セット）。
 */
export function useCallGuard(config: CallGuardConfig): void {
  useEffect(() => {
    const shouldGuard = config.isCalling || config.hasOfflineQueue;
    if (!shouldGuard) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome 等のモダンブラウザはこの値を無視するが、レガシー対応として設定
      e.returnValue = config.message ?? '通話中です。ページを離れると結果が保存されない可能性があります。';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [config.isCalling, config.hasOfflineQueue, config.message]);
}
