"use client";

import type { RoadmapEntry } from "../../_types/roadmap-entry";

type Props = {
  milestone: RoadmapEntry | null;
  simpleView?: boolean;
};

export function NextMilestoneCard({ milestone, simpleView = false }: Props) {
  return (
    <section
      style={{
        background: "linear-gradient(135deg, #d8f3dc 0%, #ffffff 120%)",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #95d5b2",
        boxShadow: "0 2px 8px rgba(64, 145, 108, 0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          次のマイルストーン
        </h3>
      </div>

      {milestone ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1b4332" }}>
            {simpleView ? milestone.label_ops ?? milestone.label_dev : milestone.label_dev}
          </div>
          {milestone.description && (
            <p style={{ fontSize: 12, color: "#40916c", margin: "4px 0 0", lineHeight: 1.6 }}>
              {milestone.description}
            </p>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 12, fontSize: 11, color: "#40916c" }}>
            {milestone.target_month && <span>{milestone.target_month}</span>}
            {milestone.due_on && <span>期限: {milestone.due_on}</span>}
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#6b8e75", margin: "10px 0 0" }}>
          次のマイルストーンはまだ設定されていません
        </p>
      )}
    </section>
  );
}
