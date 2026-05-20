import type { CSSProperties } from "react";

import { sourceLinkGroups } from "../_data/sources";

export function SourceLinksPanel() {
  return (
    <section style={sectionStyle} data-blueprint-area="sources">
      <div style={sectionHeadStyle}>
        <p style={kickerStyle}>Sources</p>
        <h2 style={headingStyle}>リソース対応表</h2>
      </div>
      <div style={groupGridStyle}>
        {sourceLinkGroups.map((group) => (
          <article key={group.title} style={groupStyle}>
            <h3 style={groupTitleStyle}>{group.title}</h3>
            <p style={groupDescriptionStyle}>{group.description}</p>
            <div style={tableStyle}>
              {group.items.map((item) => (
                <div key={`${group.title}-${item.label}`} style={rowStyle}>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={pathStyle}>{item.path}</div>
                  <div style={noteStyle}>{item.note}</div>
                </div>
              ))}
            </div>
          </article>
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

const groupGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
  gap: 12,
};

const groupStyle: CSSProperties = {
  minWidth: 0,
  background: "#f8fcf9",
  border: "1px solid #e4f3e8",
  borderRadius: 10,
  padding: 14,
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "#1b4332",
  fontWeight: 800,
};

const groupDescriptionStyle: CSSProperties = {
  margin: "6px 0 12px",
  fontSize: 12,
  lineHeight: 1.6,
  color: "#5f7f6a",
};

const tableStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
  gap: "3px 10px",
  padding: "9px 0",
  borderTop: "1px dashed #cde8d5",
};

const labelStyle: CSSProperties = {
  color: "#1b4332",
  fontSize: 12,
  fontWeight: 700,
};

const pathStyle: CSSProperties = {
  color: "#40916c",
  fontSize: 11,
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
  overflowWrap: "anywhere",
};

const noteStyle: CSSProperties = {
  gridColumn: "1 / -1",
  color: "#6b8e75",
  fontSize: 11,
  lineHeight: 1.55,
};
