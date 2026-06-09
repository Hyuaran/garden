"use client";

/**
 * Garden-Forest マクロチャート（積み上げ面グラフ）
 *
 * v9 の renderMacroChart() を React + react-chartjs-2 に移植。
 * X: 年度、Y: 経常利益（各社積み上げ）
 */

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
  const { labels, datasets } = useMemo(() => {
    if (periods.length === 0) return { labels: [], datasets: [] };

    const allYears = periods.map((p) => p.yr);
    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);

    const ds = companies
      .filter((c) => periods.some((p) => p.company_id === c.id))
      .map((c) => {
        const data = years.map((y) => {
          const p = periods.find((pp) => pp.company_id === c.id && pp.yr === y);
          return p ? Math.max(0, p.rieki ?? 0) : 0;
        });
        return {
          label: c.short,
          data,
          fill: true,
          tension: 0.35,
          backgroundColor: c.color + "cc",
          borderColor: c.color,
          borderWidth: 1.5,
          pointRadius: 3,
          pointHoverRadius: 6,
        };
      });

    return {
      labels: years.map((y) => `${y}年度`),
      datasets: ds,
    };
  }, [companies, periods]);

  if (labels.length === 0) return null;

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>
        グループ全体の合算利益推移 ～ 森の視界 ～
      </h3>
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
                  label: (ctx) =>
                    `${ctx.dataset.label}: ${fmtYen(ctx.parsed.y)}`,
                  footer: (items) => {
                    const total = items.reduce((s, i) => s + (i.parsed.y ?? 0), 0);
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
                  callback: (v) => fmtYenShort(v as number),
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
    </section>
  );
}
