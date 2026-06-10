"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BudGate } from "../_components/BudGate";
import { BUD_GARDEN_PAGE_MENU } from "../_components/bud-garden-menu";
import { useBudState } from "../_state/BudStateContext";
import {
  budActivityItems,
  companyTabs,
  dashboardTabs,
  kpis,
  mirrorItems,
  profitTrend,
  quickActions,
  waitingItems,
} from "./mock-data";
import styles from "./BudDashboard.module.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const BUD_ICON = "/themes/garden-shell/images/icons_bloom/orb_bud.png";

function formatRoleLabel(role: string | null): string {
  if (role === "admin") return "全権管理者 + 経理担当";
  if (role === "approver") return "承認者 + 経理担当";
  if (role === "staff") return "経理担当";
  return "Bud";
}

export default function DashboardPage() {
  const { sessionUser, signOut, budRole } = useBudState();
  const userName = sessionUser?.name ?? "東海林 美琴";

  return (
    <BudGate>
      <GardenShell
        activeModule="bud"
        pageMenu={BUD_GARDEN_PAGE_MENU}
        activityItems={budActivityItems}
        userName={userName}
        userEmail={sessionUser?.employee_number ? `${sessionUser.employee_number}@garden.local` : null}
        userRoleLabel={formatRoleLabel(budRole)}
        onLogout={signOut}
      >
        <div className={styles.pageStack}>
          <PageHeader
            title="Bud"
            titleJp="経理の蕾、ひらく前の数字たち"
            subtitle="経理実務の統合管理"
            accessBadge={{ icon: "♕", label: formatRoleLabel(budRole) }}
            moduleMark="bud"
            favoriteIcon={BUD_ICON}
          />

          <div className={styles.dashboardTabs} role="tablist" aria-label="Bud dashboard tabs">
            {dashboardTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={index === 0}
                className={`${styles.dashboardTab} ${index === 0 ? styles.dashboardTabActive : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.companyTabs} aria-label="法人別タブ">
            {companyTabs.map((company, index) => (
              <button
                key={company}
                type="button"
                className={`${styles.companyTab} ${index === 0 ? styles.companyTabActive : ""}`}
              >
                {company}
              </button>
            ))}
          </div>

          <section className={styles.kpiGrid} aria-label="Bud KPI">
            {kpis.map((kpi) => (
              <article className={styles.kpiCard} key={kpi.label}>
                <div className={styles.kpiHead}>
                  <span className={styles.kpiIcon}>{kpi.icon}</span>
                  <span className={styles.kpiLabel}>{kpi.label}</span>
                </div>
                <p className={styles.kpiValue}>{kpi.value}</p>
                <p className={styles.kpiNote}>{kpi.note}</p>
                <Sparkline values={kpi.series} variant={kpi.chart} />
              </article>
            ))}
          </section>

          <section className={styles.mainGrid}>
            <ProfitTrendChart />
            <TodayWaitingPanel />
            <QuickActionsPanel />
          </section>

          <section className={styles.mirrorPanel}>
            <div className={styles.sectionHeader}>
              <h2>Bloom / Forest へのミラー</h2>
              <span aria-hidden="true">ⓘ</span>
            </div>
            <div className={styles.mirrorGrid}>
              {mirrorItems.map((item) => (
                <article className={styles.mirrorItem} key={item.title}>
                  <span className={styles.mirrorIcon}>{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </GardenShell>
    </BudGate>
  );
}

function Sparkline({ values, variant }: { values: readonly number[]; variant: "bars" | "line" }) {
  if (variant === "bars") {
    return (
      <div className={styles.sparkBars} aria-hidden="true">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} style={{ height: `${value}%` }} />
        ))}
      </div>
    );
  }

  const width = 190;
  const height = 54;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / Math.max(max - min, 1)) * (height - 8) - 4;
    return `${x},${y}`;
  });

  return (
    <svg className={styles.sparkLine} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.4" />
      {points.map((point) => {
        const [cx, cy] = point.split(",");
        return <circle key={point} cx={cx} cy={cy} r="3" />;
      })}
    </svg>
  );
}

function ProfitTrendChart() {
  return (
    <section className={`${styles.panel} ${styles.chartPanel}`}>
      <div className={styles.sectionHeader}>
        <h2>利益推移</h2>
        <div className={styles.chartTools}>
          <button type="button">全期間</button>
          <button type="button">法人別</button>
        </div>
      </div>
      <div className={styles.chartBox}>
        <Line
          data={{
            labels: profitTrend.labels,
            datasets: profitTrend.datasets.map((dataset) => ({
              ...dataset,
              fill: true,
              tension: 0.38,
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 6,
              borderColor: dataset.color,
              backgroundColor: `${dataset.color}33`,
            })),
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index" as const, intersect: false },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#6e6a45",
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 16,
                  font: { size: 12, weight: 600 },
                },
              },
              tooltip: {
                callbacks: {
                  label: (context) => `${context.dataset.label}: ${context.parsed.y}万円`,
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: "#817b55" },
              },
              y: {
                ticks: {
                  color: "#817b55",
                  callback: (value) => `${value}万`,
                },
                grid: { color: "rgba(159, 140, 83, 0.12)" },
              },
            },
          }}
        />
      </div>
    </section>
  );
}

function TodayWaitingPanel() {
  return (
    <section className={`${styles.panel} ${styles.waitingPanel}`}>
      <div className={styles.sectionHeader}>
        <h2>経理実務</h2>
        <span>今日の処理待ち</span>
      </div>
      <div className={styles.waitingList}>
        {waitingItems.map((item) => (
          <div className={styles.waitingItem} key={item.label}>
            <span className={styles.listIcon}>{item.icon}</span>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickActionsPanel() {
  return (
    <section className={`${styles.panel} ${styles.actionsPanel}`}>
      <div className={styles.sectionHeader}>
        <h2>実務へ、すぐ</h2>
      </div>
      <div className={styles.actionGrid}>
        {quickActions.map((action) => (
          <button type="button" className={styles.actionButton} key={action.label}>
            <span className={styles.actionIcon}>{action.icon}</span>
            <span>{action.label}</span>
            <span className={styles.actionArrow}>›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
