export const BLOOM_PATHS = {
  HOME: "/bloom",
  WORKBOARD: "/bloom/workboard",
  ROADMAP: "/bloom/roadmap",
  MONTHLY_DIGEST: "/bloom/monthly-digest",
  DAILY_REPORTS: "/bloom/daily-report",
  CEO_STATUS: "/bloom/ceo-status",
  PROGRESS: "/bloom/progress",
  LOGIN: "/bloom/login",
  /**
   * Garden Series 統一ログイン画面 (2026-05-11、Task 1)
   * BloomGate などの未認証 redirect 先として利用。
   */
  GARDEN_LOGIN: "/login",
  /**
   * @deprecated 2026-05-11 Task 1 以降は GARDEN_LOGIN を使用すること。
   * 既存参照の互換用に残置 (Phase B-5 で削除予定)。
   */
  FOREST_LOGIN: "/forest/login",
} as const;

export type BloomPath = (typeof BLOOM_PATHS)[keyof typeof BLOOM_PATHS];
