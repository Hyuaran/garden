/**
 * Garden-Root — セッションタイマー定数
 *
 * 本番: 2 時間無操作で自動ログアウト / 残り 10 分で警告
 * 開発 (NODE_ENV === "development"): 30 秒 / 残り 10 秒で警告
 *
 * ⚠️ 本番リリース前に確認: NODE_ENV が production になっていること
 */

const IS_DEV = process.env.NODE_ENV === "development";

/** セッションタイムアウト (ミリ秒) */
export const SESSION_TIMEOUT_MS = IS_DEV
  ? 30 * 1000 // 開発: 30 秒
  : 2 * 60 * 60 * 1000; // 本番: 2 時間

/** 警告モーダル表示開始タイミング (タイムアウト前のミリ秒) */
export const WARNING_OFFSET_MS = IS_DEV
  ? 10 * 1000 // 開発: 残り 10 秒
  : 10 * 60 * 1000; // 本番: 残り 10 分

/** タイマー監視の polling 間隔 (ms) */
export const TIMER_POLL_INTERVAL_MS = IS_DEV ? 1000 : 10 * 1000;

/** 開発モードバッジ表示判定 */
export const IS_DEV_MODE = IS_DEV;
