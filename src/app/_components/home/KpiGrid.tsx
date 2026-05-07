/**
 * KpiGrid (v2.8a Step 3 — 静的版)
 *
 * DESIGN_SPEC §4-4
 *
 * 4 KPI カードを横並び grid で配置。
 * KpiCard variant prop で 4 type を切替。
 */
import KpiCard from "./KpiCard";

export default function KpiGrid() {
  return (
    <section className="kpi-grid">
      <KpiCard variant="sales" />
      <KpiCard variant="deposit" />
      <KpiCard variant="callRate" />
      <KpiCard variant="tasks" />
    </section>
  );
}
