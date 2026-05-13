"use client";

/**
 * Bloom Phase A-2 統合 KPI ダッシュボード grid layout
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 6 実装
 *
 * 4 モジュールの KPI カードを 2x2 grid 配置:
 *   - Forest: 実データ統合 (forest_corporations + balance_sheets)
 *   - Tree / Bud / Leaf: Phase A-2.2-4 で実装、当面は PlaceholderKpiCard
 */

import { ForestKpiCard } from "./ForestKpiCard";
import { PlaceholderKpiCard } from "./PlaceholderKpiCard";

export function UnifiedKpiGrid() {
  return (
    <section
      aria-label="統合 KPI ダッシュボード"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 18,
        padding: "24px 0",
      }}
    >
      <ForestKpiCard />
      <PlaceholderKpiCard
        moduleName="Tree"
        moduleNameJp="架電業務"
        scheduledPhase="Phase A-2.2"
        scheduledTime="5/13 以降 (Tree Phase D 完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.2"
        icon="🌳"
      />
      <PlaceholderKpiCard
        moduleName="Bud"
        moduleNameJp="経理・収支"
        scheduledPhase="Phase A-2.3"
        scheduledTime="5/13 以降 (Bud Phase 1 完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.3"
        icon="💰"
      />
      <PlaceholderKpiCard
        moduleName="Leaf"
        moduleNameJp="商材・案件"
        scheduledPhase="Phase A-2.4"
        scheduledTime="5/13 以降 (Leaf 関電実装完了後)"
        dispatchRef="dispatch main- No. 90 §Phase A-2.4"
        icon="🍃"
      />
    </section>
  );
}
