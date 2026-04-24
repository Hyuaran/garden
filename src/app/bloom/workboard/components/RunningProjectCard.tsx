"use client";

import type { RoadmapEntry } from "../../_types/roadmap-entry";

type Props = {
  project: RoadmapEntry | null;
  /** 👥みんな向け: true だと label_ops を優先表示 */
  simpleView?: boolean;
};

export function RunningProjectCard({ project, simpleView = false }: Props) {
  if (!project) {
    return (
      <section style={containerStyle}>
        <Heading text="進行中プロジェクト" />
        <p style={emptyStyle}>進行中のプロジェクトはありません</p>
      </section>
    );
  }

  const label = simpleView ? project.label_ops ?? project.label_dev : project.label_dev;
  const pct = project.progress_pct ?? 0;

  return (
    <section style={containerStyle}>
      <Heading text="進行中プロジェクト" />
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1b4332" }}>{label}</div>
        {project.description && (
          <p style={{ fontSize: 12, color: "#6b8e75", margin: "4px 0 0", lineHeight: 1.6 }}>
            {project.description}
          </p>
        )}
      </div>
      <ProgressBar percent={pct} />
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#40916c" }}>
        {project.target_month && <span>目標: {project.target_month}</span>}
        {project.due_on && <span>期限: {project.due_on}</span>}
      </div>
    </section>
  );
}

function Heading({ text }: { text: string }) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
      {text}
    </h3>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "#f1f8f4",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: "linear-gradient(90deg, #40916c, #95d5b2)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "#1b4332", textAlign: "right" }}>
        {clamped}%
      </div>
    </div>
  );
}

const containerStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  border: "1px solid #d8f3dc",
  boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
} as const;

const emptyStyle = {
  fontSize: 12,
  color: "#95d5b2",
  margin: "12px 0 0",
} as const;
