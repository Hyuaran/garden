import type { CSSProperties } from "react";

import { blueprintNotes, type BlueprintNote } from "../_data/notes";

const severityStyle: Record<
  BlueprintNote["severity"],
  { background: string; color: string; border: string }
> = {
  確認: { background: "#f1f8f4", color: "#2f6d45", border: "#cde8d5" },
  保護: { background: "#fff7df", color: "#7d651d", border: "#ead391" },
  未確定: { background: "#f8f6f0", color: "#78624a", border: "#e3dccd" },
};

export function NotesPanel() {
  return (
    <section style={sectionStyle} data-blueprint-area="notes">
      <div style={sectionHeadStyle}>
        <p style={kickerStyle}>Known Notes</p>
        <h2 style={headingStyle}>既知の注意点</h2>
      </div>
      <div style={listStyle}>
        {blueprintNotes.map((note) => {
          const tone = severityStyle[note.severity];
          return (
            <article key={note.title} style={noteStyle}>
              <div style={noteHeadStyle}>
                <h3 style={noteTitleStyle}>{note.title}</h3>
                <span
                  style={{
                    ...severityBadgeStyle,
                    background: tone.background,
                    color: tone.color,
                    borderColor: tone.border,
                  }}
                >
                  {note.severity}
                </span>
              </div>
              <p style={noteBodyStyle}>{note.body}</p>
            </article>
          );
        })}
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

const listStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const noteStyle: CSSProperties = {
  minWidth: 0,
  border: "1px solid #e4f3e8",
  borderRadius: 10,
  padding: 14,
  background: "#f8fcf9",
};

const noteHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 8,
};

const noteTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#1b4332",
  lineHeight: 1.45,
  fontWeight: 800,
};

const severityBadgeStyle: CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 700,
};

const noteBodyStyle: CSSProperties = {
  margin: 0,
  color: "#5f7f6a",
  fontSize: 12,
  lineHeight: 1.7,
};
