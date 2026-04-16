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
import { FOREST_THEME } from "../_constants/theme";
import { fmtYen, fmtYenShort } from "../_lib/format";

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
    <div
      style={{
        background: FOREST_THEME.panelBg,
        backdropFilter: "blur(20px)",
        border: `1px solid ${FOREST_THEME.panelBorder}`,
        borderRadius: FOREST_THEME.panelRadius,
        padding: 24,
        boxShadow: FOREST_THEME.panelShadow,
        marginBottom: 32,
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: FOREST_THEME.textPrimary,
          marginBottom: 16,
        }}
      >
        経常利益推移（グループ全体）
      </h3>
      <div style={{ height: 320 }}>
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
                    const total = items.reduce((s, i) => s + i.parsed.y, 0);
                    return `グループ合計: ${fmtYen(total)}`;
                  },
                },
              },
              legend: {
                position: "bottom" as const,
                labels: {
                  font: { family: "'Noto Sans JP', sans-serif", size: 12 },
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
                  font: { size: 11 },
                },
                grid: { color: "rgba(0,0,0,0.05)" },
              },
              x: {
                stacked: true,
                grid: { display: false },
                ticks: { font: { size: 11 } },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
