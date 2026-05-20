import type { CSSProperties } from "react";

import type { ModuleBlueprint } from "../_data/modules";
import { stageTone } from "../_data/modules";

type Props = {
  module: ModuleBlueprint;
};

export function ModuleBlueprintCard({ module }: Props) {
  const tone = stageTone[module.stage];
  const percent = Math.max(0, Math.min(100, module.percent));

  return (
    <article style={cardStyle}>
      <div style={cardHeadStyle}>
        <span style={iconWrapStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={module.iconSrc} alt="" style={iconStyle} />
        </span>
        <div style={nameBlockStyle}>
          <h3 style={nameStyle}>{module.name}</h3>
          <p style={usageStyle}>{module.usage}</p>
        </div>
      </div>
      <p style={descriptionStyle}>{module.description}</p>
      <div
        style={{
          ...badgeStyle,
          background: tone.background,
          borderColor: tone.border,
          color: tone.color,
        }}
      >
        <span>{module.stage}</span>
        <span style={percentTextStyle}>{percent}%</span>
      </div>
      <div style={progressTrackStyle} aria-hidden>
        <div
          style={{
            ...progressFillStyle,
            width: `${percent}%`,
          }}
        />
      </div>
      <div style={folderStyle}>{module.folder}</div>
    </article>
  );
}

const cardStyle: CSSProperties = {
  minWidth: 0,
  background: "#fff",
  border: "1px solid #d8f3dc",
  borderRadius: 10,
  padding: 14,
  boxShadow: "0 2px 8px rgba(64, 145, 108, 0.05)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const iconWrapStyle: CSSProperties = {
  width: 42,
  height: 42,
  flex: "0 0 42px",
  display: "grid",
  placeItems: "center",
  borderRadius: 10,
  background: "#f1f8f4",
  border: "1px solid #e4f3e8",
};

const iconStyle: CSSProperties = {
  width: 30,
  height: 30,
  objectFit: "contain",
};

const nameBlockStyle: CSSProperties = {
  minWidth: 0,
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: "#1b4332",
  fontSize: 16,
  lineHeight: 1.25,
  fontWeight: 800,
};

const usageStyle: CSSProperties = {
  margin: "2px 0 0",
  color: "#40916c",
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 700,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  color: "#4f6f5d",
  fontSize: 12,
  lineHeight: 1.65,
  minHeight: 40,
};

const badgeStyle: CSSProperties = {
  alignSelf: "flex-start",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  maxWidth: "100%",
  border: "1px solid",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 700,
  whiteSpace: "normal",
};

const percentTextStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const progressTrackStyle: CSSProperties = {
  height: 7,
  borderRadius: 999,
  background: "#f1f8f4",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #40916c 0%, #95d5b2 100%)",
};

const folderStyle: CSSProperties = {
  fontSize: 11,
  color: "#789583",
  lineHeight: 1.4,
  overflowWrap: "anywhere",
};
