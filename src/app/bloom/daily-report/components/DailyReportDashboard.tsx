"use client";

import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  dailyMembers,
  dailyTabs,
  recentReports,
  reportBlocks,
  summaryCounters,
  weeklyReportDays,
} from "../_data/daily-report";
import styles from "./DailyReportDashboard.module.css";

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
        .gs-activity-dock { display: none; }
        .gs-main-fixed {
          margin-left: var(--gs-orb-w, 56px);
          margin-right: 0;
          padding: 22px 14px 0 16px;
        }
      }
    `}</style>
  );
}

function WeeklyChart() {
  const maxHours = 12;
  const maxTasks = 20;
  const points = weeklyReportDays
    .map((day, index) => {
      const x = 44 + index * 54;
      const y = 100 - (day.tasks / maxTasks) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className={styles.weeklyChart} viewBox="0 0 420 122" aria-hidden="true">
      <line x1="28" y1="100" x2="398" y2="100" stroke="rgba(118,83,61,.28)" />
      <line x1="28" y1="58" x2="398" y2="58" stroke="rgba(118,83,61,.12)" />
      <line x1="28" y1="18" x2="398" y2="18" stroke="rgba(118,83,61,.12)" />
      {weeklyReportDays.map((day, index) => {
        const x = 34 + index * 54;
        const hourHeight = Math.max(4, (day.hours / maxHours) * 72);
        const taskHeight = Math.max(4, (day.tasks / maxTasks) * 72);
        return (
          <g key={day.day}>
            <rect x={x} y={100 - hourHeight} width="16" height={hourHeight} rx="3" fill="#d99a30" opacity=".75" />
            <rect x={x + 20} y={100 - taskHeight} width="16" height={taskHeight} rx="3" fill="#9daf72" opacity=".82" />
            <text x={x + 18} y="117" textAnchor="middle" fontSize="11" fill="#4f4038">{day.day}</text>
          </g>
        );
      })}
      <polyline points={points} fill="none" stroke="#a8a36f" strokeWidth="2" strokeDasharray="4 4" />
      {weeklyReportDays.map((day, index) => (
        <circle key={`${day.day}-point`} cx={44 + index * 54} cy={100 - (day.tasks / maxTasks) * 72} r="4" fill="#d99a30" stroke="#fffaf5" strokeWidth="2" />
      ))}
    </svg>
  );
}

export default function DailyReportDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/daily-report" }));

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
            title="日報"
            titleJp="一日の積み重ねを綴る"
            subtitle="自分と業務記録 / PDF 出力（記録/集計）"
          />
          <div className={styles.headerActions} aria-label="daily report actions">
            <span className={styles.datePill}>日付：2026年5月20日(水)</span>
            <button type="button" className={styles.primaryButton}>✐ 新規作成</button>
          </div>
        </div>

        <nav className={styles.tabs} aria-label="daily report views">
          {dailyTabs.map((tab) => (
            <button key={tab.label} type="button" className={cx(styles.tab, tab.active && styles.tabActive)}>
              {tab.label} / {tab.english}
            </button>
          ))}
        </nav>

        <div className={styles.dashboard}>
          <section className={cx(styles.card, styles.reportCard)} aria-labelledby="daily-report-main">
            <div className={styles.cardHeader}>
              <h2 id="daily-report-main" className={styles.sectionTitle}>TODAY&apos;S REPORT / 本日の日報</h2>
            </div>
            <div className={styles.authorRow}>
              <Image className={styles.avatar} src="/themes/garden-shell/images/avatar/avatar_shoji.png" alt="" width={42} height={42} />
              <strong>東海林 美琴</strong>
              <span className={styles.rolePill}>全権管理者</span>
              <span className={styles.timeStamp}>◷ 2026/05/20 19:48</span>
              <span className={styles.draftPill}>下書き</span>
              <span className={styles.publishPill}>公開済</span>
              <span className={styles.waitPill}>Bloom 反映待ち</span>
            </div>
            <div className={styles.reportBlocks}>
              {reportBlocks.map((block) => (
                <article key={block.label} className={styles.reportBlock}>
                  <div className={styles.blockLabel}><span>{block.icon}</span>{block.label}</div>
                  <div className={styles.blockBody}>
                    <p>{block.body}</p>
                    {block.tags.length > 0 && (
                      <div className={styles.tags}>
                        {block.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.reportActions}>
              <button type="button" className={styles.secondaryButton}>▣ 下書き保存</button>
              <button type="button" className={styles.primaryButton}>✈ 公開する</button>
            </div>
          </section>

          <section className={cx(styles.card, styles.summaryCard)} aria-labelledby="daily-summary">
            <h2 id="daily-summary" className={styles.sectionTitle}>TODAY&apos;S SUMMARY / 本日のサマリ</h2>
            <div className={styles.summaryTop}>
              <div className={styles.summaryMetric}>
                <span className={styles.metricIcon}>◷</span>
                <span className={styles.metricLabel}>作業時間</span>
                <strong>9<span>時間</span>30<span>分</span></strong>
              </div>
              <div className={styles.summaryMetric}>
                <span className={styles.metricIcon}>✓</span>
                <span className={styles.metricLabel}>完了タスク</span>
                <strong>8<span>件 / 12件</span><em>66%</em></strong>
                <div className={styles.progressTrack}><div style={{ width: "66%" }} /></div>
              </div>
            </div>
            <div className={styles.counterGrid}>
              {summaryCounters.map((counter) => (
                <div key={counter.label} className={styles.counterCard}>
                  <span>{counter.icon}</span>
                  <small>{counter.label}</small>
                  <strong>{counter.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.recentCard)} aria-labelledby="daily-recent">
            <h2 id="daily-recent" className={styles.sectionTitle}>RECENT / 直近の日報</h2>
            <div className={styles.recentList}>
              {recentReports.map((report) => (
                <article key={report.date} className={styles.recentRow}>
                  <strong>{report.date}</strong>
                  <span>{report.weekday}</span>
                  <Image className={styles.smallAvatar} src={report.avatar} alt="" width={24} height={24} />
                  <span className={styles.recentOwner}>{report.owner}</span>
                  <p>{report.summary}</p>
                  <div className={styles.rowTags}>
                    {report.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <a href="#" aria-label={`${report.date} の詳細`}>詳細 →</a>
                </article>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.weeklyCard)} aria-labelledby="daily-weekly">
            <div className={styles.sectionHeaderSplit}>
              <h2 id="daily-weekly" className={styles.sectionTitle}>WEEKLY / 今週のサマリ</h2>
              <div className={styles.legend}><span className={styles.legendGold} />作業時間（時間）<span className={styles.legendGreen} />完了タスク（件）</div>
            </div>
            <p className={styles.weekTotal}>今週合計：<strong>52</strong> 時間 / <strong>60</strong> タスク完了</p>
            <WeeklyChart />
          </section>

          <section className={cx(styles.card, styles.membersCard)} aria-labelledby="daily-members">
            <h2 id="daily-members" className={styles.sectionTitle}>MEMBERS / メンバー別</h2>
            <div className={styles.memberList}>
              {dailyMembers.map((member) => (
                <article key={member.name} className={styles.memberRow}>
                  <Image className={styles.smallAvatar} src={member.avatar} alt="" width={30} height={30} />
                  <strong>{member.name}</strong>
                  <span>{member.count} 件投稿</span>
                  <div className={styles.memberProgress}><div style={{ width: `${member.progress}%` }} /></div>
                  <b>{member.progress}%</b>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </GardenShell>
  );
}
