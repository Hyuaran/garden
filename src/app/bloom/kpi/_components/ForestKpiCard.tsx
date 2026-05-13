"use client";

/**
 * Forest 法人別月次売上 KPI カード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 5 実装
 *
 * forest_corporations + forest_balance_sheets から取得した直近 6 ヶ月の月次売上を、
 * 法人別に sparkline 形式で表示。
 */

import { useEffect, useState, type CSSProperties } from "react";
import type { ForestKpiData, ForestMonthlyRevenue } from "../_lib/types";
import { fetchForestMonthlyRevenue } from "../_lib/forest-fetcher";

const cardStyle: CSSProperties = {
  background: "linear-gradient(135deg, rgba(122,153,104,0.08) 0%, rgba(212,165,65,0.06) 100%)",
  border: "1px solid rgba(122,153,104,0.3)",
  borderRadius: 12,
  padding: "24px 20px",
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-noto-serif-jp), system-ui, sans-serif",
  color: "#3a2a1a",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-cormorant), serif",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "0.04em",
  marginBottom: 2,
};

const jpStyle: CSSProperties = {
  fontFamily: "var(--font-shippori), serif",
  fontSize: 13,
  letterSpacing: "0.08em",
  color: "#7a8b7e",
  marginBottom: 14,
};

const sourceBadgeStyle = (source: "supabase" | "mock"): CSSProperties => ({
  display: "inline-block",
  fontSize: 10,
  padding: "2px 8px",
  borderRadius: 999,
  marginLeft: 8,
  background: source === "supabase" ? "rgba(31,92,58,0.12)" : "rgba(212,165,65,0.18)",
  color: source === "supabase" ? "#1f5c3a" : "#8a6c1d",
  letterSpacing: "0.06em",
});

function groupByCorporation(rows: ForestMonthlyRevenue[]): Map<string, ForestMonthlyRevenue[]> {
  const map = new Map<string, ForestMonthlyRevenue[]>();
  for (const row of rows) {
    const list = map.get(row.corporation_id) ?? [];
    list.push(row);
    map.set(row.corporation_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.year_month.localeCompare(b.year_month));
  }
  return map;
}

function formatYen(value: number): string {
  if (value >= 10_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万`;
  return `${value.toLocaleString()}`;
}

export function ForestKpiCard() {
  const [data, setData] = useState<ForestKpiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetched = await fetchForestMonthlyRevenue();
        if (!cancelled) setData(fetched);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <article style={cardStyle} data-testid="kpi-forest-error">
        <h3 style={titleStyle}>Forest</h3>
        <p style={jpStyle}>全法人決算</p>
        <p style={{ color: "#c1121f", fontSize: 13 }}>⚠️ 取得失敗: {error}</p>
      </article>
    );
  }

  if (!data) {
    return (
      <article style={cardStyle} data-testid="kpi-forest-loading">
        <h3 style={titleStyle}>Forest</h3>
        <p style={jpStyle}>全法人決算</p>
        <p style={{ color: "#9aa89d", fontSize: 13, fontStyle: "italic" }}>読み込み中…</p>
      </article>
    );
  }

  const grouped = groupByCorporation(data.monthly_revenues);

  return (
    <article style={cardStyle} data-testid="kpi-forest-ready">
      <h3 style={titleStyle}>
        Forest
        <span style={sourceBadgeStyle(data.source)}>{data.source}</span>
      </h3>
      <p style={jpStyle}>全法人決算 — 直近 6 ヶ月 月次売上</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {Array.from(grouped.entries()).map(([corpId, rows]) => {
          const latest = rows[rows.length - 1];
          return (
            <div key={corpId} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13, color: "#4a4233" }}>{latest?.corporation_name ?? corpId}</span>
              <span style={{ fontFamily: "var(--font-eb-garamond), serif", fontSize: 16, fontWeight: 500, color: "#1f5c3a" }}>
                ¥{formatYen(latest?.revenue ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
