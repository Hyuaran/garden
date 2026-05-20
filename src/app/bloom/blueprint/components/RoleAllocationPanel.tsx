import type { CSSProperties } from "react";

import { roleAllocations } from "../_data/roles";

export function RoleAllocationPanel() {
  return (
    <section style={sectionStyle} data-blueprint-area="roles">
      <div style={sectionHeadStyle}>
        <p style={kickerStyle}>AI Roles</p>
        <h2 style={headingStyle}>AI 役割分担</h2>
      </div>
      <div style={gridStyle}>
        {roleAllocations.map((role) => (
          <article key={role.name} style={cardStyle}>
            <div style={roleHeadStyle}>
              <h3 style={nameStyle}>{role.name}</h3>
              <span style={positionStyle}>{role.position}</span>
            </div>
            <ul style={listStyle}>
              {role.responsibilities.map((item) => (
                <li key={item} style={listItemStyle}>
                  {item}
                </li>
              ))}
            </ul>
            <div style={recordStyle}>
              <span style={recordLabelStyle}>記録先</span>
              <span style={recordPathStyle}>{role.recordTarget}</span>
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

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 12,
};

const cardStyle: CSSProperties = {
  minWidth: 0,
  background: "#f8fcf9",
  border: "1px solid #e4f3e8",
  borderRadius: 10,
  padding: 14,
};

const roleHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: "#1b4332",
  fontSize: 15,
  lineHeight: 1.3,
  fontWeight: 800,
};

const positionStyle: CSSProperties = {
  flex: "0 0 auto",
  borderRadius: 999,
  background: "#d8f3dc",
  color: "#1b4332",
  padding: "4px 9px",
  fontSize: 11,
  fontWeight: 700,
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const listItemStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.55,
  color: "#4f6f5d",
};

const recordStyle: CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: "1px dashed #cde8d5",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const recordLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#40916c",
  fontWeight: 700,
};

const recordPathStyle: CSSProperties = {
  fontSize: 11,
  color: "#6b8e75",
  overflowWrap: "anywhere",
};
