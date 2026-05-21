"use client";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  digestAchievements,
  digestGoals,
  digestMetrics,
  digestMonth,
  digestTabs,
  monthlyHighlights,
  progressActual,
  progressTarget,
  specialNotes,
} from "../_data/monthly-digest";
import styles from "./MonthlyDigestDashboard.module.css";

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
      .gs-sidebar {
        display: flex;
        height: calc(100vh - 80px);
        left: 0;
        position: fixed;
        top: 80px;
        z-index: 90;
      }
      .gs-activity-dock {
        height: calc(100vh - 80px);
        pointer-events: none;
        position: fixed;
        right: 0;
        top: 80px;
        width: calc(var(--gs-right-w, 334px) + 14px);
        z-index: 95;
      }
      .gs-main-fixed {
        box-sizing: border-box;
        margin-left: var(--gs-left-w, 236px);
        margin-right: var(--gs-right-w, 334px);
        margin-top: 80px;
        min-height: calc(100vh - 80px);
        overflow-x: hidden;
        padding: 30px 32px 0 48px;
        position: relative;
        width: auto;
        z-index: 1;
      }
      @media (max-width: 760px) {
        .gs-sidebar { overflow: hidden; width: var(--gs-orb-w, 56px) !important; }
        .gs-orb-col { width: var(--gs-orb-w, 56px) !important; }
        .gs-nav-col,
        .nav-pages-toggle,
        .gs-activity-dock { display: none !important; }
        .gs-main-fixed {
          margin-left: var(--gs-orb-w, 56px) !important;
          margin-right: 0 !important;
          padding: 22px 14px 0 16px;
          width: calc(100vw - var(--gs-orb-w, 56px)) !important;
          max-width: calc(100vw - var(--gs-orb-w, 56px)) !important;
        }
      }
    `}</style>
  );
}

function points(values: number[], max: number) {
  return values
    .map((value, index) => {
      const x = 34 + index * 23;
      const y = 136 - (value / max) * 112;
      return `${x},${y}`;
    })
    .join(" ");
}

function ProgressChart() {
  const actualPoints = points(progressActual, 130);
  const targetPoints = points(progressTarget, 130);

  return (
    <svg className={styles.progressChart} viewBox="0 0 450 168" aria-hidden="true">
      <defs>
        <linearGradient id="monthlyActualLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#c97900" />
          <stop offset="60%" stopColor="#df9c43" />
          <stop offset="100%" stopColor="#f3a8b5" />
        </linearGradient>
        <linearGradient id="monthlyProgressFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(243,168,181,.24)" />
          <stop offset="100%" stopColor="rgba(243,168,181,0)" />
        </linearGradient>
      </defs>
      {[24, 52, 80, 108, 136].map((y) => (
        <line key={y} x1="28" y1={y} x2="414" y2={y} stroke="rgba(118,83,61,.16)" />
      ))}
      <line x1="28" y1="136" x2="414" y2="136" stroke="rgba(118,83,61,.28)" />
      <text x="18" y="28" fontSize="10" fill="#5d4a42">120</text>
      <text x="18" y="84" fontSize="10" fill="#5d4a42">60</text>
      <text x="22" y="140" fontSize="10" fill="#5d4a42">0</text>
      <polygon points={`34,136 ${actualPoints} ${34 + (progressActual.length - 1) * 23},136`} fill="url(#monthlyProgressFill)" />
      <polyline points={targetPoints} fill="none" stroke="#e98998" strokeWidth="2.4" strokeDasharray="7 6" />
      <polyline points={actualPoints} fill="none" stroke="url(#monthlyActualLine)" strokeWidth="4" />
      {progressActual.map((value, index) => (
        <circle key={`${value}-${index}`} cx={34 + index * 23} cy={136 - (value / 130) * 112} r="3.5" fill="#c97900" stroke="#fffaf5" strokeWidth="1.5" />
      ))}
      <text x="32" y="158" fontSize="11" fill="#5d4a42">4/1</text>
      <text x="124" y="158" fontSize="11" fill="#5d4a42">4/8</text>
      <text x="215" y="158" fontSize="11" fill="#5d4a42">4/16</text>
      <text x="306" y="158" fontSize="11" fill="#5d4a42">4/24</text>
      <text x="384" y="158" fontSize="11" fill="#5d4a42">4/30</text>
    </svg>
  );
}

export default function MonthlyDigestDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/monthly-digest" }));

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
            title="月次まとめ"
            titleJp="一月の歩みを、振り返る"
            subtitle="Garden Series / Bloom 配信"
          />
          <div className={styles.headerActions} aria-label="monthly digest actions">
            <span className={styles.monthSelect}>対象月：2026 年 4 月⌄</span>
            <a className={styles.primaryLink} href={`/bloom/monthly-digest/${digestMonth}/export`} target="_blank" rel="noreferrer">▣ PDF 出力</a>
            <a className={styles.outlineButton} href={`/bloom/monthly-digest/${digestMonth}/edit`}>編集</a>
          </div>
        </div>

        <nav className={styles.tabs} aria-label="monthly digest views">
          {digestTabs.map((tab) => (
            <button key={tab.label} type="button" className={cx(styles.tab, tab.active && styles.tabActive)}>
              {tab.label} / {tab.english}
            </button>
          ))}
        </nav>

        <section className={styles.cover} aria-labelledby="monthly-cover">
          <h2 id="monthly-cover">2026 年 4 月 月次まとめ</h2>
          <p>Garden Series / Bloom 配信</p>
          <div className={styles.coverMeta}>
            <span>発行：株式会社ヒュアラン</span>
            <span>対象：後道代表</span>
            <span>作成：東海林 美琴</span>
          </div>
          <span className={styles.issued}>2026/05/01</span>
        </section>

        <div className={styles.dashboard}>
          <section className={cx(styles.card, styles.overall)} aria-labelledby="monthly-overall">
            <h2 id="monthly-overall" className={styles.sectionTitle}>OVERALL / 今月の総括</h2>
            <div className={styles.metricGrid}>
              {digestMetrics.map((metric) => (
                <article key={metric.label} className={cx(styles.metricCard, styles[metric.tone])}>
                  <span className={styles.metricIcon}>{metric.icon}</span>
                  <div>
                    <span className={styles.metricLabel}>{metric.label}</span>
                    <strong className={styles.metricValue}>{metric.value}</strong>
                    <span className={styles.metricNote}>{metric.note}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.summary)} aria-labelledby="monthly-summary">
            <h2 id="monthly-summary" className={styles.sectionTitle}>SUMMARY / 業務サマリ</h2>
            <div className={styles.summaryColumns}>
              <div>
                <h3>今月のハイライト</h3>
                <ul className={styles.leafList}>
                  {monthlyHighlights.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h3>特記事項</h3>
                <ul className={styles.noteList}>
                  {specialNotes.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section className={cx(styles.card, styles.progress)} aria-labelledby="monthly-progress">
            <h2 id="monthly-progress" className={styles.sectionTitle}>PROGRESS / 進捗グラフ</h2>
            <div className={styles.progressWrap}>
              <ProgressChart />
              <div className={styles.progressStats}>
                <div><span>実績</span><strong>124 件</strong></div>
                <div><span>目標</span><strong>105 件</strong></div>
                <div><span>達成率</span><strong>118%</strong></div>
              </div>
            </div>
            <p className={styles.progressMessage}>目標を 18% 上回って達成</p>
          </section>

          <section className={cx(styles.card, styles.achievements)} aria-labelledby="monthly-achievements">
            <h2 id="monthly-achievements" className={styles.sectionTitle}>ACHIEVEMENTS / 達成リスト</h2>
            <div className={styles.achievementList}>
              {digestAchievements.map((achievement) => (
                <article key={achievement.title} className={styles.achievementRow}>
                  <span className={styles.achievementDate}>{achievement.date}</span>
                  <span className={styles.flower}>✿</span>
                  <div className={styles.achievementText}>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.body}</p>
                  </div>
                  <span className={cx(styles.tag, styles[achievement.tone])}>{achievement.tag}</span>
                </article>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.goals)} aria-labelledby="monthly-goals">
            <h2 id="monthly-goals" className={styles.sectionTitle}>NEXT GOALS / 次月目標</h2>
            <div className={styles.goalList}>
              {digestGoals.map((goal) => (
                <article key={goal.rank} className={styles.goalRow}>
                  <span className={styles.rank}>{goal.rank}</span>
                  <strong className={styles.goalTitle}>{goal.title}</strong>
                  <span className={styles.goalDue}>{goal.due}</span>
                  <span className={cx(styles.tag, styles[goal.tone])}>{goal.tag}</span>
                  <span className={styles.status}>{goal.status}</span>
                </article>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.ceo)} aria-labelledby="monthly-ceo">
            <h2 id="monthly-ceo" className={styles.sectionTitle}>TO CEO / 後道代表への報告</h2>
            <p className={styles.ceoText}>
              4 月は目標 105 件に対し 124 件達成。Bloom Top の桜世界観化が完了し、
              経営見える化の基盤が整いました。
            </p>
            <p className={styles.signature}>東海林 美琴（2026/05/01）</p>
          </section>
        </div>
      </div>
    </GardenShell>
  );
}
