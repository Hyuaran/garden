"use client";

type Props = {
  percent: number;
  label?: string;
};

export function OverallProgressBar({ percent, label = "全体進捗" }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          {label}
        </h3>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#1b4332" }}>
          {clamped}
          <span style={{ fontSize: 14, marginLeft: 2 }}>%</span>
        </span>
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 7,
          background: "#f1f8f4",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: "linear-gradient(90deg, #40916c, #95d5b2)",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </section>
  );
}
