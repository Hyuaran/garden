"use client";

/**
 * KPI カード（v6 dispatch Step 4）
 *
 * 5/5 デモ用: モック値 + 「（モック）」microcopy。
 * post-5/5 で kpi-fetchers.ts を async 化、supabase 経由で実値取得。
 */

import type { KpiData } from "../_lib/kpi-fetchers";

const TREND_COLOR: Record<KpiData["trend"], string> = {
  up: "#3B9B5C",
  down: "#C1121F",
  neutral: "#5C6E5F",
};

const TREND_GLYPH: Record<KpiData["trend"], string> = {
  up: "▲",
  down: "▼",
  neutral: "—",
};

export function KpiCard({ card }: { card: KpiData }) {
  return (
    <article
      data-testid={`kpi-card-${card.id}`}
      data-kpi-id={card.id}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 18,
        background: "rgba(255, 255, 255, 0.92)",
        borderRadius: 14,
        border: `1px solid ${card.color}33`,
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
        backdropFilter: "blur(6px)",
        minHeight: 120,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          aria-hidden
          style={{
            fontSize: 18,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `${card.color}22`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {card.icon}
        </span>
        <div style={{ fontSize: 12, color: "#5C6E5F", fontWeight: 600 }}>{card.title}</div>
      </header>

      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "#1F2A24",
          lineHeight: 1.1,
        }}
      >
        {card.value}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: TREND_COLOR[card.trend],
          fontWeight: 600,
        }}
      >
        <span aria-hidden>{TREND_GLYPH[card.trend]}</span>
        <span>{card.delta}</span>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <span
          style={{
            fontSize: 9,
            color: "#9AA89D",
            fontStyle: "italic",
          }}
          aria-label="現在は仮の数値、リリース後に実データへ自動切替"
        >
          （モック値・5/5 後に実データ連携）
        </span>
      </div>
    </article>
  );
}
