/**
 * Bloom Phase A-2 統合 KPI ダッシュボード 型定義
 *
 * dispatch main- No. 90 (2026-05-07) writing-plans plan §Task 1 実装
 * docs/superpowers/plans/2026-05-07-bloom-phase-a2-unified-kpi-dashboard.md
 */

export type KpiCardStatus = "loading" | "ready" | "error" | "placeholder";

export type ForestMonthlyRevenue = {
  /** 法人 ID (forest_corporations.id) */
  corporation_id: string;
  /** 法人名 (forest_corporations.name) */
  corporation_name: string;
  /** 年月 (YYYY-MM 形式) */
  year_month: string;
  /** 月次売上 (forest_balance_sheets.revenue 等から集計、円単位) */
  revenue: number;
};

export type ForestKpiData = {
  /** 直近 6 ヶ月の法人別月次売上 */
  monthly_revenues: ForestMonthlyRevenue[];
  /** データ取得元 ('supabase' or 'mock') */
  source: "supabase" | "mock";
  /** 取得時刻 ISO 8601 */
  fetched_at: string;
};

export type UnifiedKpiData = {
  forest: ForestKpiData | null;
  /** Tree / Bud / Leaf は Phase A-2.2-4 で実装、当面は null */
  tree: null;
  bud: null;
  leaf: null;
};
