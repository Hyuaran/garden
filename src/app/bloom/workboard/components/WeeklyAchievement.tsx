"use client";

type Stats = {
  /** 完了した予定項目の合計 */
  completedPlans: number;
  /** 計画した予定項目の合計 */
  totalPlans: number;
  /** 自己申告稼働時間合計 */
  hoursLogged: number | null;
  /** 期間日数（既定 7） */
  spanDays?: number;
};

type Props = {
  stats: Stats;
};

export function WeeklyAchievement({ stats }: Props) {
  const { completedPlans, totalPlans, hoursLogged, spanDays = 7 } = stats;
  const rate = totalPlans === 0 ? 0 : Math.round((completedPlans / totalPlans) * 100);

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
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
        今週の実績
      </h3>
      <p style={{ fontSize: 11, color: "#6b8e75", margin: "2px 0 12px" }}>
        直近 {spanDays} 日間
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <Metric label="完了" value={`${completedPlans} / ${totalPlans}`} />
        <Metric label="達成率" value={`${rate}%`} highlight />
        <Metric label="稼働" value={hoursLogged != null ? `${hoursLogged.toFixed(1)} h` : "-"} />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "#40916c" : "#f1f8f4",
        color: highlight ? "#fff" : "#1b4332",
        borderRadius: 8,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, opacity: highlight ? 0.85 : 0.7 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
