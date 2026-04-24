"use client";

import type {
  ModuleProgress,
  ModuleStatus,
} from "../../_types/module-progress";

type Props = {
  modules: ModuleProgress[];
  simpleView?: boolean;
};

const STATUS_STYLE: Record<
  ModuleStatus | "unknown",
  { bg: string; color: string; label: string }
> = {
  planned: { bg: "#f1f8f4", color: "#6b8e75", label: "計画中" },
  in_progress: { bg: "#d8f3dc", color: "#1b4332", label: "進行中" },
  at_risk: { bg: "#fef3c7", color: "#92400e", label: "リスク" },
  done: { bg: "#40916c", color: "#fff", label: "完了" },
  unknown: { bg: "#f3f4f6", color: "#6b7280", label: "-" },
};

export function ModuleProgressGrid({ modules, simpleView = false }: Props) {
  if (modules.length === 0) {
    return (
      <section style={emptyStyle}>
        <h3 style={headingStyle}>モジュール別進捗</h3>
        <p style={{ fontSize: 12, color: "#95d5b2", margin: "12px 0 0" }}>
          データがまだ登録されていません
        </p>
      </section>
    );
  }

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
      <h3 style={headingStyle}>モジュール別進捗</h3>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        {modules.map((m) => {
          const style = STATUS_STYLE[m.status ?? "unknown"];
          const label = simpleView ? m.label_ops : m.label_dev;
          return (
            <div
              key={m.module_code}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #d8f3dc",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1b4332" }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: style.bg,
                    color: style.color,
                    fontWeight: 600,
                  }}
                >
                  {style.label}
                </span>
              </div>
              {m.phase_label && (
                <div style={{ fontSize: 11, color: "#6b8e75", marginBottom: 6 }}>
                  {m.phase_label}
                </div>
              )}
              <div style={{ height: 6, borderRadius: 3, background: "#f1f8f4", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, m.progress_pct))}%`,
                    background: "linear-gradient(90deg, #40916c, #95d5b2)",
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#1b4332", textAlign: "right" }}>
                {m.progress_pct}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const headingStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#1b4332",
  margin: 0,
} as const;

const emptyStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  border: "1px solid #d8f3dc",
  boxShadow: "0 2px 8px rgba(64, 145, 108, 0.06)",
} as const;
