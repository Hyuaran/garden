"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { Company, FiscalPeriod } from "../_constants/companies";
import { fmtYen, fmtYenShort } from "../_lib/format";
import styles from "./ForestDesign.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Props = {
  companies: Company[];
  periods: FiscalPeriod[];
};

export function MacroChart({ companies, periods }: Props) {
  const { labels, datasets, latestTotal, previousTotal } = useMemo(() => {
    if (periods.length === 0) {
      return { labels: [], datasets: [], latestTotal: 0, previousTotal: 0 };
    }

    const allYears = periods.map((period) => period.yr);
    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);
    const years: number[] = [];
    for (let year = minYear; year <= maxYear; year++) years.push(year);

    const datasets = companies
      .filter((company) => periods.some((period) => period.company_id === company.id))
      .map((company) => {
        const data = years.map((year) => {
          const period = periods.find((p) => p.company_id === company.id && p.yr === year);
          return period ? Math.max(0, period.rieki ?? 0) : 0;
        });
        return {
          label: company.short,
          data,
          fill: true,
          tension: 0.35,
          backgroundColor: `${company.color}cc`,
          borderColor: company.color,
          borderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 6,
        };
      });

    const totals = years.map((year) =>
      companies.reduce((total, company) => {
        const period = periods.find((p) => p.company_id === company.id && p.yr === year);
        return total + Math.max(0, period?.rieki ?? 0);
      }, 0),
    );

    return {
      labels: years.map((year) => `${year}年度`),
      datasets,
      latestTotal: totals[totals.length - 1] ?? 0,
      previousTotal: totals[totals.length - 2] ?? 0,
    };
  }, [companies, periods]);

  if (labels.length === 0) return null;

  return (
    <section className={styles.panel}>
      <div className={styles.chartHeader}>
        <h3 className={styles.panelTitle}>グループ全体の合算利益推移</h3>
        <div className={styles.chartTools} aria-label="chart controls">
          <button type="button">全期間</button>
          <button type="button">詳細</button>
        </div>
      </div>
      <div className={styles.chartBox} style={{ height: 360 }}>
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index" as const, intersect: false },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${fmtYen(ctx.parsed.y)}`,
                  footer: (items) => {
                    const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
                    return `グループ合計: ${fmtYen(total)}`;
                  },
                },
              },
              legend: {
                position: "bottom" as const,
                labels: {
                  color: "#2d6a4f",
                  font: { family: "'Noto Sans JP', sans-serif", size: 12, weight: 700 },
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 16,
                },
              },
            },
            scales: {
              y: {
                stacked: true,
                ticks: {
                  callback: (value) => fmtYenShort(value as number),
                  color: "#4f7862",
                  font: { size: 11 },
                },
                grid: { color: "rgba(45,106,79,0.08)" },
              },
              x: {
                stacked: true,
                grid: { display: false },
                ticks: { color: "#4f7862", font: { size: 11 } },
              },
            },
          }}
        />
      </div>
      <div className={styles.chartFooter}>
        <div>
          <span>2025年度（見込）合計</span>
          <strong>{fmtYen(latestTotal)}</strong>
        </div>
        <div>
          <span>前期比</span>
          <strong>{fmtYen(latestTotal - previousTotal)} (+32.5%)</strong>
        </div>
        <p>全社で増益基調を維持しています</p>
      </div>
    </section>
  );
}
