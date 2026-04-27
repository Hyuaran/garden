/**
 * KPI モックデータ provider（v6 dispatch Step 4）
 *
 * 5/5 デモ用 hardcode 値。post-5/5 で各モジュール API 連携に置換予定:
 *   - 売上: Bud bud_statements + Forest fiscal_periods
 *   - 入金予定: Bud bud_transfers
 *   - 架電状況: Tree tree_call_records
 *   - 未処理タスク: Bloom workboard
 *
 * 当面は同期 mock 関数。将来は async + supabase RLS 経由。
 */

export type KpiCardId = "sales" | "incoming" | "calls" | "tasks";

export type KpiData = {
  id: KpiCardId;
  /** 表示タイトル */
  title: string;
  /** メイン値（フォーマット済 string、例 "¥12,680,000"） */
  value: string;
  /** 補足ラベル（前月比 / 進捗 等） */
  delta: string;
  /** 補足の正負（+/-/neutral）— 色分け */
  trend: "up" | "down" | "neutral";
  /** カード上部の絵文字アイコン */
  icon: string;
  /** カード color theme（hex） */
  color: string;
  /** 表示できる role 一覧（known-pitfalls #6 + project_garden_dual_axis_navigation §2 参照） */
  minRoles: ReadonlyArray<string>;
};

export const KPI_CARDS: ReadonlyArray<KpiData> = [
  {
    id: "sales",
    title: "売上（今月）",
    value: "¥12,680,000",
    delta: "+12.5%（前月比）",
    trend: "up",
    icon: "🌱",
    color: "#3B9B5C",
    minRoles: ["super_admin", "admin", "manager"],
  },
  {
    id: "incoming",
    title: "入金予定（今月）",
    value: "¥8,450,000",
    delta: "+8.3%（前月比）",
    trend: "up",
    icon: "💧",
    color: "#4FA8C9",
    minRoles: ["super_admin", "admin", "manager"],
  },
  {
    id: "calls",
    title: "架電状況（今日）",
    value: "68%",
    delta: "34 / 50 件",
    trend: "neutral",
    icon: "🌲",
    color: "#7FC66D",
    minRoles: ["manager", "staff", "closer", "cs"],
  },
  {
    id: "tasks",
    title: "未処理タスク",
    value: "24 件",
    delta: "期限超過 5 件",
    trend: "down",
    icon: "🌸",
    color: "#E07A9B",
    minRoles: [
      "super_admin", "admin", "manager", "staff", "cs", "closer", "toss", "outsource",
    ],
  },
];

/** 指定 role で可視な KPI カードを返す */
export function getVisibleKpiCards(role: string): ReadonlyArray<KpiData> {
  return KPI_CARDS.filter((c) => c.minRoles.includes(role));
}
