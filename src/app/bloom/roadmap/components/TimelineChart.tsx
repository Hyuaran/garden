"use client";

import type { MonthBucket } from "../_lib/progress-aggregator";

type Props = {
  buckets: MonthBucket[];
  /** 既定: M1〜M8 の 8 バケット描画 */
  months?: string[];
};

const DEFAULT_MONTHS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];

export function TimelineChart({ buckets, months = DEFAULT_MONTHS }: Props) {
  const byMonth = new Map(buckets.map((b) => [b.month, b]));

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
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: "0 0 12px" }}>
        タイムライン (M1〜M8)
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${months.length}, 1fr)`,
          gap: 6,
        }}
      >
        {months.map((m) => {
          const bucket = byMonth.get(m);
          const pct = bucket?.avgProgressPct ?? 0;
          const count = bucket?.entries.length ?? 0;
          return (
            <div
              key={m}
              style={{
                borderRadius: 8,
                background: "#f1f8f4",
                padding: "10px 6px",
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
                border: "1px solid transparent",
              }}
              title={
                bucket
                  ? `${m}: ${count} 件 / 平均 ${pct}%`
                  : `${m}: エントリなし`
              }
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: `${pct}%`,
                  width: "100%",
                  background: "linear-gradient(180deg, #95d5b2 0%, #40916c 100%)",
                  opacity: 0.25,
                  transition: "height 0.4s ease",
                }}
              />
              <div style={{ position: "relative", fontSize: 11, fontWeight: 700, color: "#1b4332" }}>
                {m}
              </div>
              <div style={{ position: "relative", fontSize: 13, fontWeight: 800, color: "#1b4332", marginTop: 4 }}>
                {pct}%
              </div>
              <div style={{ position: "relative", fontSize: 10, color: "#6b8e75", marginTop: 2 }}>
                {count} 件
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
