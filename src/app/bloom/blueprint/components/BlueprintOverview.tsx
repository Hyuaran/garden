import type { CSSProperties } from "react";

import { blueprintOverview } from "../_data/overview";

export function BlueprintOverview() {
  return (
    <section style={sectionStyle} data-blueprint-area="overview">
      <div style={eyebrowStyle}>{blueprintOverview.eyebrow}</div>
      <div style={heroGridStyle}>
        <div>
          <h1 style={titleStyle}>{blueprintOverview.title}</h1>
          <p style={leadStyle}>{blueprintOverview.lead}</p>
        </div>
        <div style={referenceBoxStyle}>
          <div style={referenceLabelStyle}>参照元</div>
          <ul style={referenceListStyle}>
            {blueprintOverview.references.map((ref) => (
              <li key={ref} style={referenceItemStyle}>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div style={principleGridStyle}>
        {blueprintOverview.principles.map((item) => (
          <article key={item.title} style={principleStyle}>
            <h2 style={principleTitleStyle}>{item.title}</h2>
            <p style={principleBodyStyle}>{item.body}</p>
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
  background: "linear-gradient(135deg, #ffffff 0%, #f4fbf6 100%)",
  border: "1px solid #d8f3dc",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#40916c",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 8,
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 18,
  alignItems: "start",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.25,
  color: "#1b4332",
  fontWeight: 800,
};

const leadStyle: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 14,
  lineHeight: 1.8,
  color: "#385846",
  overflowWrap: "anywhere",
};

const referenceBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.8)",
  border: "1px solid #d8f3dc",
  borderRadius: 10,
  padding: 14,
};

const referenceLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#1b4332",
  marginBottom: 8,
};

const referenceListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const referenceItemStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  color: "#6b8e75",
  overflowWrap: "anywhere",
};

const principleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 12,
  marginTop: 18,
};

const principleStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e4f3e8",
  borderRadius: 10,
  padding: 14,
};

const principleTitleStyle: CSSProperties = {
  fontSize: 14,
  color: "#1b4332",
  margin: 0,
  fontWeight: 700,
};

const principleBodyStyle: CSSProperties = {
  fontSize: 12,
  color: "#5f7f6a",
  lineHeight: 1.7,
  margin: "8px 0 0",
  overflowWrap: "anywhere",
};
