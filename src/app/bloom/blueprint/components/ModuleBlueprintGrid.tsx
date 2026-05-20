import type { CSSProperties } from "react";

import { moduleBlueprints } from "../_data/modules";
import { ModuleBlueprintCard } from "./ModuleBlueprintCard";

export function ModuleBlueprintGrid() {
  return (
    <section style={sectionStyle} data-blueprint-area="modules">
      <div style={sectionHeadStyle}>
        <div>
          <p style={kickerStyle}>12 Modules</p>
          <h2 style={headingStyle}>12 モジュール早見表</h2>
        </div>
        <p style={summaryStyle}>
          植物比喩を主軸に、各モジュールの用途・役割・現在の育ち具合を一覧できます。
        </p>
      </div>
      <div style={gridStyle}>
        {moduleBlueprints.map((module) => (
          <ModuleBlueprintCard key={module.code} module={module} />
        ))}
      </div>
    </section>
  );
}

const sectionStyle: CSSProperties = {
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowX: "hidden",
  background: "#fff",
  border: "1px solid #d8f3dc",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
};

const sectionHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 14,
};

const kickerStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  color: "#40916c",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const headingStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: 18,
  color: "#1b4332",
  fontWeight: 800,
};

const summaryStyle: CSSProperties = {
  margin: 0,
  maxWidth: 460,
  fontSize: 12,
  color: "#6b8e75",
  lineHeight: 1.6,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
  gap: 12,
};
