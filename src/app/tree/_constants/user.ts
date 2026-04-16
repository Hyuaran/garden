/**
 * Garden-Tree デモ用ユーザー情報
 *
 * プロトタイプでは const USER で一元管理されていた。
 * 本実装では Supabase Auth と連携予定（useUser() 等のフックに置換）。
 *
 * 当面はプロトタイプと同じデータで画面を動かすため、暫定で定数化。
 */
export const USER = {
  name: "東海林",
  fullName: "東海林 美琴",
  empId: "1042",
  employmentType: "正社員",
} as const;

export type GardenUser = typeof USER;
