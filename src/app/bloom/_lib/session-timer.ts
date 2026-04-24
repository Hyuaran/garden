/**
 * Garden-Bloom 2時間セッションタイマー
 *
 * マウス移動・キー入力・スクロールを監視し、
 * 最終操作から2時間経過で onTimeout コールバックを呼ぶ。
 */

import { isBloomUnlocked, touchBloomSession } from "./auth";

const CHECK_INTERVAL_MS = 60 * 1000;

export function startSessionTimer(onTimeout: () => void): () => void {
  const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];

  const handleActivity = () => {
    touchBloomSession();
  };

  events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

  const intervalId = setInterval(() => {
    if (!isBloomUnlocked()) {
      onTimeout();
    }
  }, CHECK_INTERVAL_MS);

  return () => {
    events.forEach((e) => window.removeEventListener(e, handleActivity));
    clearInterval(intervalId);
  };
}
