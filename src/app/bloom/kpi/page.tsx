"use client";

/**
 * /bloom/kpi — Bloom Phase A-2 統合 KPI ダッシュボード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 7 実装
 */

import { UnifiedKpiGrid } from "./_components/UnifiedKpiGrid";

export default function BloomKpiPage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1
          style={{
            fontFamily: "var(--font-cormorant), serif",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#1f5c3a",
            margin: 0,
          }}
        >
          🌸 統合 KPI ダッシュボード
        </h1>
        <p
          style={{
            fontFamily: "var(--font-shippori), serif",
            fontSize: 13,
            color: "#7a8b7e",
            marginTop: 6,
            letterSpacing: "0.06em",
          }}
        >
          Tree / Leaf / Bud / Forest 4 モジュールの KPI を 1 画面で俯瞰
        </p>
      </header>
      <UnifiedKpiGrid />
    </main>
  );
}
