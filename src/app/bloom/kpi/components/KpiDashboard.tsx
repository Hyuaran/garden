"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  actionItems,
  entityKpis,
  entityRows,
  entityTabs,
  sectionPanels,
  trendSeries,
  type KpiSubTab,
} from "../_data/kpi";
import styles from "./KpiDashboard.module.css";

const subTabs: Array<{ key: KpiSubTab; label: string }> = [
  { key: "summary", label: "サマリ / Summary" },
  { key: "forest", label: "Forest / 売上" },
  { key: "tree", label: "Tree / 架電" },
  { key: "bud", label: "Bud / 経理" },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

function SparkLine({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => `${8 + index * 22},${54 - ((value - min) / Math.max(1, max - min)) * 38}`).join(" ");
  return (
    <svg className={styles.spark} viewBox="0 0 220 64" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#d99a30" strokeWidth="2.2" />
      {values.map((value, index) => <circle key={`${value}-${index}`} cx={8 + index * 22} cy={54 - ((value - min) / Math.max(1, max - min)) * 38} r="2.8" fill="#d99a30" />)}
    </svg>
  );
}

function BarSpark({ values }: { values: number[] }) {
  return (
    <svg className={styles.spark} viewBox="0 0 220 64" preserveAspectRatio="none" aria-hidden="true">
      {values.map((value, index) => <rect key={`${value}-${index}`} x={14 + index * 28} y={58 - value} width="13" height={value} rx="2" fill="#f2a9b5" opacity="0.78" />)}
    </svg>
  );
}

function TrendChart({ chart }: { chart: (typeof trendSeries)[number] }) {
  const colors = ["#d99a30", "#f2a9b5", "#7a9968"];
  return (
    <svg className={styles.trendChart} viewBox="0 0 360 130" preserveAspectRatio="none" aria-hidden="true">
      <line x1="24" x2="330" y1="104" y2="104" stroke="rgba(118,83,61,.22)" />
      <line x1="24" x2="330" y1="58" y2="58" stroke="rgba(118,83,61,.12)" />
      {chart.lines.map((line, lineIndex) => {
        const points = line.map((value, index) => `${28 + index * 58},${104 - (value / chart.max) * 82}`).join(" ");
        return <polyline key={chart.labels[lineIndex]} points={points} fill="none" stroke={colors[lineIndex]} strokeWidth="2" opacity={lineIndex === 0 ? 1 : 0.64} />;
      })}
      {["11月", "12月", "1月", "2月", "3月", "4月"].map((label, index) => <text key={label} x={28 + index * 58} y="124" textAnchor="middle" fontSize="9" fill="#7b6252">{label}</text>)}
    </svg>
  );
}

export default function KpiDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const [activeEntity, setActiveEntity] = useState("全社統合");
  const [activeSubTab, setActiveSubTab] = useState<KpiSubTab>("summary");
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美樹";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/kpi" }));
  const activeKpi = entityKpis[activeEntity];
  const visibleRows = useMemo(() => activeEntity === "全社統合" ? entityRows : entityRows.filter((row) => row.name === activeEntity || row.name === "全社統合"), [activeEntity]);
  const activePanel = sectionPanels[activeSubTab];

  const cards: Array<
    { kind: "line"; label: string; value: string; delta: string; icon: string; values: number[] } |
    { kind: "bar"; label: string; value: string; delta: string; icon: string; values: number[] }
  > = [
    { kind: "line", label: `今月売上（${activeEntity}）`, value: activeKpi.sales, delta: activeKpi.salesDelta, icon: "/themes/garden-shell/images/icons_bloom/orb_bloom.png", values: activeKpi.chart },
    { kind: "line", label: `今月利益（${activeEntity}）`, value: activeKpi.profit, delta: activeKpi.profitDelta, icon: "/themes/garden-shell/images/icons_bloom/orb_fruit.png", values: activeKpi.chart.map((value) => Math.max(8, value - 6)) },
    { kind: "bar", label: `今月架電件数（${activeEntity}）`, value: activeKpi.calls, delta: activeKpi.callsDelta, icon: "/themes/garden-shell/images/icons_bloom/orb_tree.png", values: activeKpi.bars },
    { kind: "bar", label: `今月仕訳件数（${activeEntity}）`, value: activeKpi.journals, delta: activeKpi.journalsDelta, icon: "/themes/garden-shell/images/icons_bloom/orb_bud.png", values: activeKpi.bars.map((value) => Math.max(12, value - 8)) },
  ];

  return (
    <GardenShell
      activeModule="bloom"
      pageMenu={activeMenu}
      userName={userName}
      userEmail={userEmail}
      userRoleLabel={roleLabel(role)}
      onLogout={() => lockAndLogout("manual")}
    >
      <div className={styles.page}>
        <div className={styles.headerWrap}>
          <PageHeader
            title="統合 KPI"
            titleJp="法人横断の数字"
            subtitle="Forest 月次売上 + Tree（架電）/ Bud（経理）/ Leaf（個別業務）KPI を一画面で"
          />
        </div>

        <div className={styles.periodChip}>対象月: 2026年4月</div>

        <nav className={styles.entityTabs} aria-label="entity tabs">
          {entityTabs.map((entity) => (
            <button key={entity} type="button" className={cx(styles.entityTab, activeEntity === entity && styles.entityTabActive)} onClick={() => setActiveEntity(entity)}>
              {entity}
            </button>
          ))}
        </nav>

        <nav className={styles.subTabs} aria-label="kpi sections">
          {subTabs.map((tab) => (
            <button key={tab.key} type="button" className={cx(styles.subTab, activeSubTab === tab.key && styles.subTabActive)} onClick={() => setActiveSubTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section className={styles.kpiGrid} aria-label="key kpi">
          {cards.map((card) => (
            <article key={card.label} className={styles.kpiCard}>
              <Image src={card.icon} alt="" width={58} height={58} />
              <div className={styles.kpiMain}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>先月比 <b className={cx(card.delta.startsWith("-") && styles.deltaNegative)}>{card.delta}</b></small>
              </div>
              {card.kind === "line" ? <SparkLine values={card.values} /> : <BarSpark values={card.values} />}
            </article>
          ))}
        </section>

        <section className={cx(styles.panel, styles.activePanel)} aria-live="polite">
          <h2 className={styles.sectionTitle}>{activePanel.title}</h2>
          <p>{activePanel.body}</p>
        </section>

        <div className={styles.midGrid}>
          <section className={styles.panel} aria-labelledby="kpi-entities">
            <h2 id="kpi-entities" className={styles.sectionTitle}>BY ENTITY / 法人別 KPI</h2>
            <div className={styles.tableWrap}>
              <table className={styles.entityTable}>
                <thead><tr><th>法人名</th><th>売上</th><th>利益</th><th>現預金</th><th>前年比</th><th>状態</th></tr></thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td><td>{row.sales}</td><td>{row.profit}</td><td>{row.cash}</td>
                      <td className={cx(row.negative ? styles.negative : styles.positive)}>{row.yoy}</td>
                      <td><span className={cx(styles.statusPill, row.negative && styles.warning)}>{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cx(styles.panel, styles.developmentCard)} aria-labelledby="kpi-development">
            <h2 id="kpi-development" className={styles.sectionTitle}>DEVELOPMENT / Garden 開発進捗</h2>
            <div className={styles.developmentBody}>
              <div className={styles.devRing}><strong>67</strong><span>%</span></div>
              <div className={styles.devList}>
                <p><b className={styles.okMark}>○</b>リリース済: 3 / 12</p>
                <p><b className={styles.goldMark}>◇</b>開発中: 5 / 12</p>
                <p><b className={styles.grayMark}>△</b>未着手: 4 / 12</p>
                <a href="/bloom/progress">詳細 → /bloom/progress</a>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.trendGrid} aria-label="trend charts">
          {trendSeries.map((chart) => (
            <article key={chart.title} className={styles.panel}>
              <h2 className={styles.sectionTitle}>{chart.title} / 直近6ヶ月</h2>
              <TrendChart chart={chart} />
            </article>
          ))}
        </section>

        <section className={styles.actionGrid} aria-label="action items">
          {actionItems.map((item) => (
            <article key={item.title} className={styles.actionCard}>
              <Image src={item.icon} alt="" width={46} height={46} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <small>{item.note}</small>
              </div>
            </article>
          ))}
        </section>
      </div>
    </GardenShell>
  );
}
