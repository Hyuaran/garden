/**
 * Garden-Tree 画面パス定義（ナビゲーション用）
 *
 * プロトタイプでは state `screen` を切り替えていたが、
 * Next.js App Router ではそれぞれが独立した URL ルートとなる。
 *
 * サイドバー・ヘッダー・画面間遷移で使うパスをここで一元管理する。
 */

export const TREE_PATHS = {
  LOGIN: "/tree/login",
  BIRTHDAY: "/tree/birthday",
  DASHBOARD: "/tree/dashboard",

  CALLING_SPROUT: "/tree/calling/sprout",
  CALLING_BRANCH: "/tree/calling/branch",
  IN_CALL: "/tree/call",

  TOSS_WAIT: "/tree/toss-wait",
  CONFIRM_WAIT: "/tree/confirm-wait",
  FOLLOW_CALL: "/tree/follow-call",

  QA_SEARCH: "/tree/qa",
  APORAN: "/tree/aporan",
  EFF_RANKING: "/tree/ranking",
  VIDEO_PORTAL: "/tree/videos",
  CHATWORK: "/tree/chatwork",

  FEEDBACK: "/tree/feedback",
  FB_LIST: "/tree/feedback/list",
  ALERTS: "/tree/alerts",
  MYPAGE: "/tree/mypage",
  WRAP_UP: "/tree/wrap-up",

  MONITORING: "/tree/monitoring",
  SCRIPT_MANAGE: "/tree/scripts",
  BREEZE: "/tree/breeze",

  BREAK_SCHEDULE: "/tree/break-schedule",
  SEARCH: "/tree/search",
} as const;

export type TreePath = (typeof TREE_PATHS)[keyof typeof TREE_PATHS];
