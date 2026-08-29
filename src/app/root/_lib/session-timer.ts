/**
 * Garden-Root — セッションタイマー定数
 *
 * 本番: 2 時間無操作で自動ログアウト / 残り 10 分で警告
 * 開発 (NODE_ENV === "development"): 5 分 / 残り 1 分で警告
 *
 * ⚠️ 本番リリース前に確認: NODE_ENV が production になっていること
 */

const IS_DEV = process.env.NODE_ENV === "development";

export const DEVELOPMENT_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
export const DEVELOPMENT_WARNING_OFFSET_MS = 60 * 1000;
export const PRODUCTION_SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const PRODUCTION_WARNING_OFFSET_MS = 10 * 60 * 1000;
export const DEVELOPMENT_TIMER_POLL_INTERVAL_MS = 1000;
export const PRODUCTION_TIMER_POLL_INTERVAL_MS = 10 * 1000;

/** セッションタイムアウト (ミリ秒) */
export const SESSION_TIMEOUT_MS = IS_DEV
  ? DEVELOPMENT_SESSION_TIMEOUT_MS // 開発: 5 分
  : PRODUCTION_SESSION_TIMEOUT_MS; // 本番: 2 時間

/** 警告モーダル表示開始タイミング (タイムアウト前のミリ秒) */
export const WARNING_OFFSET_MS = IS_DEV
  ? DEVELOPMENT_WARNING_OFFSET_MS // 開発: 残り 1 分
  : PRODUCTION_WARNING_OFFSET_MS; // 本番: 残り 10 分

/** タイマー監視の polling 間隔 (ms) */
export const TIMER_POLL_INTERVAL_MS = IS_DEV
  ? DEVELOPMENT_TIMER_POLL_INTERVAL_MS
  : PRODUCTION_TIMER_POLL_INTERVAL_MS;

/** 開発モードバッジ表示判定 */
export const IS_DEV_MODE = IS_DEV;
