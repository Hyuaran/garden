"use client";

import { useViewModeOptional } from "../../_state/ViewModeContext";
import type { RoadmapEntry } from "../../_types/roadmap-entry";

type Props = {
  risks: RoadmapEntry[];
  simpleView?: boolean;
};

const SEVERITY_STYLE = {
  critical: { bg: "#fef2f2", border: "#dc2626", color: "#7f1d1d", icon: "🔴" },
  warn: { bg: "#fef3c7", border: "#d97706", color: "#92400e", icon: "🟡" },
  info: { bg: "#eff6ff", border: "#3b82f6", color: "#1e40af", icon: "🔵" },
  none: { bg: "#f9fafb", border: "#d1d5db", color: "#374151", icon: "⚪" },
} as const;

export function RiskCardList({ risks, simpleView }: Props) {
  const { simple } = useViewModeOptional();
  const effective = simpleView ?? simple;
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #d8f3dc",
        boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          リスク
        </h3>
        <span style={{ fontSize: 11, color: "#6b8e75" }}>{risks.length} 件</span>
      </div>

      {risks.length === 0 ? (
        <p style={{ fontSize: 12, color: "#95d5b2", margin: "12px 0 0" }}>
          登録されているリスクはありません
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {risks.map((r) => {
            const style =
              SEVERITY_STYLE[r.banner_severity ?? "none"] ?? SEVERITY_STYLE.none;
            const label = effective ? r.label_ops ?? r.label_dev : r.label_dev;
            return (
              <li
                key={r.id}
                style={{
                  padding: "10px 12px",
                  marginBottom: 8,
                  borderRadius: 8,
                  borderLeft: `4px solid ${style.border}`,
                  background: style.bg,
                  color: style.color,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span>{style.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                  {r.due_on && (
                    <span style={{ fontSize: 11, marginLeft: "auto", opacity: 0.7 }}>
                      期限 {r.due_on}
                    </span>
                  )}
                </div>
                {r.description && (
                  <p style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.6 }}>
                    {r.description}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
