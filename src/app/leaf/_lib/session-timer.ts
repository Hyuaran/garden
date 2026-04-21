/**
 * Garden-Leaf 関電業務委託 — 5分セッションタイマー
 *
 * マウス移動・キー入力・スクロール・クリックを監視し、
 * 最終操作から5分経過で onTimeout コールバックを呼ぶ。
 * ロック時間は管理者のみ変更可、エンドユーザー変更不可。
 */

import { isLeafUnlocked, touchLeafSession } from "./auth";

const CHECK_INTERVAL_MS = 10 * 1000; // 10秒ごとにチェック（5分ロックに対して十分な頻度）

export function startLeafSessionTimer(onTimeout: () => void): () => void {
  const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];

  const handleActivity = () => {
    touchLeafSession();
  };

  // イベントリスナー登録
  events.forEach((e) =>
    window.addEventListener(e, handleActivity, { passive: true }),
  );

  // 定期チェック
  const intervalId = setInterval(() => {
    if (!isLeafUnlocked()) {
      onTimeout();
    }
  }, CHECK_INTERVAL_MS);

  // クリーンアップ関数を返す
  return () => {
    events.forEach((e) => window.removeEventListener(e, handleActivity));
    clearInterval(intervalId);
  };
}
