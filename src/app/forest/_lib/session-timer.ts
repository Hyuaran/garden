/**
 * Garden-Forest 2時間セッションタイマー
 *
 * マウス移動・キー入力・スクロールを監視し、
 * 最終操作から2時間経過で onTimeout コールバックを呼ぶ。
 */

import { touchForestSession, isForestUnlocked } from "./auth";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000; // 1分ごとにチェック

export function startSessionTimer(onTimeout: () => void): () => void {
  const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];

  const handleActivity = () => {
    touchForestSession();
  };

  // イベントリスナー登録
  events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

  // 定期チェック
  const intervalId = setInterval(() => {
    if (!isForestUnlocked()) {
      onTimeout();
    }
  }, CHECK_INTERVAL_MS);

  // クリーンアップ関数を返す
  return () => {
    events.forEach((e) => window.removeEventListener(e, handleActivity));
    clearInterval(intervalId);
  };
}
