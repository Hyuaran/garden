import type { CSSProperties } from "react";

import type { ModuleBlueprint } from "../_data/modules";

type Props = {
  module: ModuleBlueprint;
};

export function ModuleBlueprintCard({ module }: Props) {
  return (
    <article style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={iconWrapStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={module.iconSrc} alt="" style={iconStyle} />
        </span>
        <div style={nameBlockStyle}>
          <p style={codeStyle}>{module.code2}</p>
          <h3 style={nameStyle}>{module.name}</h3>
          <p style={usageStyle}>{module.role}</p>
        </div>
        <span style={stageStyle}>{module.stageLabel}</span>
      </div>
      <p style={descriptionStyle}>{module.summary}</p>
      <div style={folderStyle}>{module.folder}</div>
    </article>
  );
}

const cardStyle: CSSProperties = {
  minWidth: 0,
  background: "#fff",
  border: "1px solid #eadfcb",
  borderRadius: 8,
  padding: 14,
  boxShadow: "0 2px 8px rgba(184, 115, 96, 0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const cardHeadStyle: CSSProperties = {
  display: "grid",
  alignItems: "start",
  gridTemplateColumns: "42px minmax(0, 1fr) auto",
  gap: 10,
  minWidth: 0,
};

const iconWrapStyle: CSSProperties = {
  width: 42,
  height: 42,
  flex: "0 0 42px",
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  background: "#fff8f0",
  border: "1px solid #efd9aa",
};

const iconStyle: CSSProperties = {
  width: 30,
  height: 30,
  objectFit: "contain",
};

const nameBlockStyle: CSSProperties = {
  minWidth: 0,
};

const codeStyle: CSSProperties = {
  margin: 0,
  color: "#b2780f",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 700,
};

const nameStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#3f3528",
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 800,
};

const usageStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#8f7b60",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
};

const stageStyle: CSSProperties = {
  border: "1px solid #efd9aa",
  borderRadius: 999,
  color: "#b2780f",
  fontSize: 11,
  lineHeight: 1.2,
  padding: "4px 8px",
  whiteSpace: "nowrap",
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#6f6252",
  fontSize: 12,
  lineHeight: 1.65,
  minHeight: 40,
};

const folderStyle: CSSProperties = {
  fontSize: 11,
  color: "#b2780f",
  lineHeight: 1.4,
  overflowWrap: "anywhere",
};
