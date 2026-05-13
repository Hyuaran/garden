"use client";

/**
 * Tree / Bud / Leaf 用「準備中」KPI カード
 *
 * Phase A-2.1 (dispatch main- No. 90, 2026-05-07) writing-plans plan §Task 4 実装
 *
 * 各モジュールが Phase A-2.2-4 で実装するまでの暫定 UI。
 * モジュール名 + 実装予定時期 + 担当セッション名 + dispatch 番号を表示。
 */

import type { CSSProperties } from "react";

type Props = {
  moduleName: string;
  moduleNameJp: string;
  scheduledPhase: string;
  scheduledTime: string;
  dispatchRef?: string;
  icon?: string;
};

const cardStyle: CSSProperties = {
  position: "relative",
  background: "linear-gradient(135deg, rgba(120,100,70,0.08) 0%, rgba(212,165,65,0.05) 100%)",
  border: "1px dashed rgba(120,100,70,0.25)",
  borderRadius: 12,
  padding: "24px 20px",
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontFamily: "var(--font-noto-serif-jp), system-ui, sans-serif",
  color: "#5c6e5f",
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--font-cormorant), serif",
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "#3a2a1a",
  marginBottom: 4,
};

const jpStyle: CSSProperties = {
  fontFamily: "var(--font-shippori), serif",
  fontSize: 13,
  letterSpacing: "0.08em",
  color: "#7a8b7e",
  marginBottom: 16,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "#9aa89d",
  marginTop: 8,
  fontStyle: "italic",
};

export function PlaceholderKpiCard({
  moduleName,
  moduleNameJp,
  scheduledPhase,
  scheduledTime,
  dispatchRef,
  icon,
}: Props) {
  return (
    <article style={cardStyle} data-testid={`kpi-placeholder-${moduleName.toLowerCase()}`}>
      {icon && <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>}
      <h3 style={titleStyle}>{moduleName}</h3>
      <p style={jpStyle}>{moduleNameJp}</p>
      <p style={{ fontSize: 12, color: "#5c6e5f", margin: 0 }}>
        実装予定: <strong>{scheduledPhase}</strong>
      </p>
      <p style={labelStyle}>{scheduledTime}</p>
      {dispatchRef && <p style={{ ...labelStyle, marginTop: 4 }}>{dispatchRef}</p>}
    </article>
  );
}
