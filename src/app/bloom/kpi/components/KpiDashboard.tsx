"use client";

import { useState } from "react";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  actionItems,
  companyKpis,
  developmentProgress,
  identityRows,
  targetMonth,
  type KpiCard,
} from "../_data";
import styles from "./KpiDashboard.module.css";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理者";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

function ShellLayoutStyle() {
  return (
    <style>{`
      .gs-sidebar { display: flex; height: calc(100vh - 80px); left: 0; position: fixed; top: 80px; z-index: 90; }
      .gs-activity-dock { height: calc(100vh - 80px); pointer-events: none; position: fixed; right: 0; top: 80px; width: calc(var(--gs-right-w, 334px) + 14px); z-index: 95; }
      .gs-main-fixed { box-sizing: border-box; margin-left: var(--gs-left-w, 236px); margin-right: var(--gs-right-w, 334px); margin-top: 80px; min-height: calc(100vh - 80px); overflow-x: hidden; padding: 30px 32px 0 48px; position: relative; width: auto; z-index: 1; }
      @media (max-width: 760px) {
        .gs-sidebar { overflow: hidden; width: var(--gs-orb-w, 56px) !important; }
        .gs-orb-col { width: var(--gs-orb-w, 56px) !important; }
        .gs-nav-col, .nav-pages-toggle, .gs-activity-dock { display: none !important; }
        .gs-main-fixed { margin-left: var(--gs-orb-w, 56px) !important; margin-right: 0 !important; padding: 22px 14px 0 16px; width: calc(100vw - var(--gs-orb-w, 56px)) !important; max-width: calc(100vw - var(--gs-orb-w, 56px)) !important; }
      }
    `}</style>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: "up" | "down" }) {
  const stroke = tone === "up" ? "#7a9968" : "#c98a86";
  const points = values
    .map((v, i) => `${(i * 200) / (values.length - 1)},${50 - (v / 100) * 44}`)
    .join(" ");
  const last = values[values.length - 1];
  return (
    <svg className={styles.spark} viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" />
      <circle cx={200} cy={50 - (last / 100) * 44} r="3" fill={stroke} />
    </svg>
  );
}

function KpiCardView({ card }: { card: KpiCard }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{card.label}</span>
        <span className={styles.kpiSub}>{card.sub}</span>
      </div>
      <div className={styles.kpiValue}>
        {card.prefix && <span className={styles.kpiPrefix}>{card.prefix}</span>}
        {card.value}
        {card.unit && <span className={styles.kpiUnit}>{card.unit}</span>}
      </div>
      <div className={cx(styles.kpiYoy, card.yoyTone === "down" && styles.kpiYoyDown)}>
        <span className={styles.kpiYoyArrow}>{card.yoyTone === "up" ? "↑" : "↓"}</span>
        <span>{card.yoy}</span>
        <span className={styles.kpiYoyLabel}>前年比</span>
      </div>
      <Sparkline values={card.trend} tone={card.yoyTone} />
    </div>
  );
}

export default function KpiDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({
    ...item,
    active: item.href === "/bloom/kpi",
  }));

  const [activeKey, setActiveKey] = useState("all");
  const active = companyKpis.find((c) => c.key === activeKey) ?? companyKpis[0];

  return (
    <GardenShell
      activeModule="bloom"
      pageMenu={activeMenu}
      userName={userName}
      userEmail={userEmail}
      userRoleLabel={roleLabel(role)}
      onLogout={() => lockAndLogout("manual")}
    >
      <ShellLayoutStyle />
      <div className={styles.page}>
        <div className={styles.headerWrap}>
          <PageHeader
            title="統合 KPI"
            titleJp="法人横断の数字"
            subtitle="6 法人の業績と Garden 開発を、ひとつの画面で"
            accessBadge={{ icon: "👑", label: "限定公開 admin 3名のみ閲覧可能" }}
          />
          <span className={styles.monthPill}>対象月：{targetMonth}</span>
        </div>

        <nav className={styles.tabs} role="tablist" aria-label="法人別 KPI">
          {companyKpis.map((company) => (
            <button
              key={company.key}
              type="button"
              role="tab"
              aria-selected={activeKey === company.key}
              className={cx(styles.tab, activeKey === company.key && styles.tabActive)}
              onClick={() => setActiveKey(company.key)}
            >
              <span className={styles.tabJp}>{company.name}</span>
              <span className={styles.tabEn}>{company.en}</span>
            </button>
          ))}
        </nav>

        <div className={styles.kpiGrid}>
          {active.kpis.map((card) => (
            <KpiCardView key={`${active.key}-${card.label}`} card={card} />
          ))}
        </div>

        {activeKey === "all" ? (
          <>
            <div className={styles.lowerGrid}>
              <section className={styles.card}>
                <div className={styles.sectionHead}>
                  <div>
                    <p className={styles.kicker}>Identity</p>
                    <h2 className={styles.sectionTitle}>法人別サマリ</h2>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>法人</th>
                        <th className={styles.num}>売上</th>
                        <th className={styles.num}>粗利</th>
                        <th className={styles.num}>粗利率</th>
                        <th className={styles.num}>前年比</th>
                        <th>状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {identityRows.map((row) => (
                        <tr key={row.name}>
                          <td className={styles.companyCell}>{row.name}</td>
                          <td className={styles.num}>{row.revenue}</td>
                          <td className={styles.num}>{row.profit}</td>
                          <td className={styles.num}>{row.margin}</td>
                          <td className={cx(styles.num, row.yoyTone === "down" ? styles.negative : styles.positive)}>{row.yoy}</td>
                          <td>
                            <span className={cx(styles.statusBadge, styles[row.statusTone])}>{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={cx(styles.card, styles.devCard)}>
                <div className={styles.sectionHead}>
                  <div>
                    <p className={styles.kicker}>Development</p>
                    <h2 className={styles.sectionTitle}>Garden 開発進捗</h2>
                  </div>
                </div>
                <div
                  className={styles.devRing}
                  style={{ background: `conic-gradient(#d99a30 ${developmentProgress.percent * 3.6}deg, var(--border-soft) 0deg)` }}
                >
                  <div className={styles.devInner}>
                    <span className={styles.devValue}>{developmentProgress.percent}<small>%</small></span>
                  </div>
                </div>
                <div className={styles.devStats}>
                  <span><i className={cx(styles.devDot, styles.dotReleased)} />満開 {developmentProgress.released}</span>
                  <span><i className={cx(styles.devDot, styles.dotDeveloping)} />育成中 {developmentProgress.developing}</span>
                  <span><i className={cx(styles.devDot, styles.dotSeeding)} />種まき {developmentProgress.seeding}</span>
                </div>
                <p className={styles.devNote}>{developmentProgress.note}</p>
              </section>
            </div>

            <section className={styles.card}>
              <div className={styles.sectionHead}>
                <div>
                  <p className={styles.kicker}>Action Items</p>
                  <h2 className={styles.sectionTitle}>対応事項</h2>
                </div>
              </div>
              <div className={styles.actionGrid}>
                {actionItems.map((item) => (
                  <article key={item.title} className={cx(styles.actionCard, styles[`action_${item.tone}`])}>
                    <span className={styles.actionIcon}>{item.icon}</span>
                    <div className={styles.actionBody}>
                      <strong className={styles.actionTitle}>{item.title}</strong>
                      <p className={styles.actionDetail}>{item.detail}</p>
                    </div>
                    <span className={styles.actionOwner}>{item.owner}</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>Trend</p>
                <h2 className={styles.sectionTitle}>{active.name} の推移</h2>
              </div>
              <span className={styles.trendNote}>直近 6 ヶ月 / 指標別の伸び</span>
            </div>
            <div className={styles.trendGrid}>
              {active.kpis.map((card) => (
                <div key={`trend-${card.label}`} className={styles.trendCard}>
                  <div className={styles.trendHead}>
                    <span className={styles.trendTitle}>{card.label}</span>
                    <span className={cx(styles.trendYoy, card.yoyTone === "down" && styles.negative)}>{card.yoy}</span>
                  </div>
                  <Sparkline values={card.trend} tone={card.yoyTone} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </GardenShell>
  );
}
