/**
 * Forest 法人別月次売上 fetcher
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 3 実装
 *
 * - dev (NODE_ENV=development): buildMockForestData() で 2 法人 × 6 ヶ月の固定値返却
 * - 本番: Supabase forest_corporations + forest_balance_sheets から集計
 *
 * 注意: forest_balance_sheets のスキーマは a-forest-002 が B-min で整備中、
 *       本 fetcher は revenue カラムが直接ある前提で実装。実カラム名差異は
 *       Phase A-2.1 着手時に a-forest-002 と確認 (5/9 朝想定)。
 */

import { supabase } from "../../../bloom/_lib/supabase";
import type { ForestKpiData, ForestMonthlyRevenue } from "./types";

const MOCK_CORPORATIONS = [
  { id: "mock-corp-1", name: "株式会社ヒュアラン" },
  { id: "mock-corp-2", name: "ヒュアラングループ HD" },
];

export function buildMockForestData(): ForestKpiData {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push(ym);
  }

  const monthly_revenues: ForestMonthlyRevenue[] = [];
  for (const corp of MOCK_CORPORATIONS) {
    for (const ym of months) {
      // 月によって少し変動する mock 値 (8M-15M 円)
      const seed = ym.charCodeAt(5) + ym.charCodeAt(6) + corp.id.length;
      const revenue = 8_000_000 + (seed % 7) * 1_000_000;
      monthly_revenues.push({
        corporation_id: corp.id,
        corporation_name: corp.name,
        year_month: ym,
        revenue,
      });
    }
  }

  return {
    monthly_revenues,
    source: "mock",
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchForestMonthlyRevenue(): Promise<ForestKpiData> {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return buildMockForestData();
  }

  // 本番: Supabase 経由で実データ取得
  // Phase A-2.1 着手時にスキーマ詳細を a-forest-002 と確認、適宜カラム名調整
  try {
    const { data, error } = await supabase
      .from("forest_corporations")
      .select("id, name, forest_balance_sheets!inner(year_month, revenue)")
      .order("name");

    if (error || !data) {
      // フォールバックで mock 返却 (UI 側 source=mock を表示)
      return buildMockForestData();
    }

    const monthly_revenues: ForestMonthlyRevenue[] = [];
    for (const corp of data as Array<{
      id: string;
      name: string;
      forest_balance_sheets: Array<{ year_month: string; revenue: number }>;
    }>) {
      for (const bs of corp.forest_balance_sheets ?? []) {
        monthly_revenues.push({
          corporation_id: corp.id,
          corporation_name: corp.name,
          year_month: bs.year_month,
          revenue: bs.revenue,
        });
      }
    }

    return {
      monthly_revenues,
      source: "supabase",
      fetched_at: new Date().toISOString(),
    };
  } catch {
    return buildMockForestData();
  }
}
