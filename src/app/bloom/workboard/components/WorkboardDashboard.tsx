"use client";

import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import { planItems, runningProjects, statusOptions, teamMembers, weeklyDays } from "../_data/workboard";
import styles from "./WorkboardDashboard.module.css";

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

function WeeklyBarsSvg() {
  const bars = weeklyDays.map((day) => {
    if (day.total === 0) return 0;
    return Math.round((day.completed / day.total) * 68);
  });

  return (
    <svg viewBox="0 0 420 96" width="100%" height="96" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="workboardSakuraBar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f5b6c2" />
          <stop offset="55%" stopColor="#df9c43" />
          <stop offset="100%" stopColor="#c97900" />
        </linearGradient>
        <linearGradient id="workboardLeafBar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#c8d79c" />
          <stop offset="100%" stopColor="#87a85f" />
        </linearGradient>
      </defs>
      <line x1="18" y1="82" x2="402" y2="82" stroke="rgba(195,149,120,.32)" strokeWidth="1" />
      {bars.map((height, index) => {
        const x = 34 + index * 58;
        const y = 82 - height;
        return (
          <g key={weeklyDays[index].day}>
            <rect x={x} y={y} width="26" height={height || 3} rx="7" fill={index === 6 ? "url(#workboardLeafBar)" : "url(#workboardSakuraBar)"} opacity={height ? 0.9 : 0.28} />
            <text x={x + 13} y="94" textAnchor="middle" fill="#7a5c4d" fontSize="10">{weeklyDays[index].day}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function WorkboardDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/workboard" }));

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
        <PageHeader
          title="ワークボード"
          titleJp="今日の動きを、見える化"
          subtitle="業務の作業状況・優先度・進捗を一望"
        />

        <div className={styles.topActions} aria-label="workboard actions">
          <button type="button" className={styles.actionPill}><span>♕</span> 東海林・社内向け</button>
          <button type="button" className={styles.actionPill}><span>◎</span> 本日の集中業務</button>
        </div>

        <nav className={styles.tabs} aria-label="workboard views">
          <button type="button" className={cx(styles.tab, styles.tabActive)}>ワークボード / Today</button>
          <button type="button" className={styles.tab}>週次 / Weekly</button>
          <button type="button" className={styles.tab}>メンバー別 / By Member</button>
        </nav>

        <div className={styles.dashboard}>
          <section className={cx(styles.card, styles.running)} aria-labelledby="workboard-running">
            <h2 id="workboard-running" className={styles.sectionTitle}>RUNNING / 走行中プロジェクト</h2>
            <div className={styles.runningGrid}>
              {runningProjects.map((project) => (
                <article key={project.title} className={styles.projectCard}>
                  <div className={styles.projectTitle}>{project.title}</div>
                  <span className={cx(styles.projectBadge, styles[project.statusTone])}>{project.status}</span>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${project.progress}%` }} />
                  </div>
                  <div className={styles.progressValue}>{project.progress}%</div>
                  <div className={styles.projectMeta}>
                    <span><small>担当</small><strong>{project.owner}</strong></span>
                    <span><small>最終更新</small><strong>{project.updated}</strong></span>
                    <span><small>次のアクション</small><strong>{project.next}</strong></span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.today)} aria-labelledby="workboard-today">
            <div className={styles.todayIcon}>❀</div>
            <div>
              <h2 id="workboard-today" className={styles.sectionTitle}>TODAY / 本日のステータス</h2>
              <p className={styles.todayState}>集中業務中 <span className={styles.todayFlower}>✿</span></p>
              <p className={styles.todayProject}>a-main 006 で Root Phase B 確定中</p>
              <p className={styles.todayUpdate}>最終更新: 14:30（東海林 美琴）</p>
              <div className={styles.statusButtons}>
                {statusOptions.map((status) => (
                  <button key={status.label} type="button" className={cx(styles.statusButton, styles[status.tone])}>
                    {status.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={cx(styles.card, styles.plan)} aria-labelledby="workboard-plan">
            <h2 id="workboard-plan" className={styles.sectionTitle}>TODAY&apos;S PLAN / 今日の予定</h2>
            <div className={styles.planList}>
              {planItems.map((item) => (
                <div key={`${item.time}-${item.title}`} className={styles.planItem}>
                  <span className={cx(styles.checkBox, item.done && styles.checkBoxDone)}>{item.done ? "✓" : ""}</span>
                  <span className={styles.planTime}>{item.time}</span>
                  <span className={styles.planTitle}>{item.title}</span>
                  <span className={styles.planTag}>{item.tag}</span>
                  <span className={styles.endCircle}>{item.done ? "✓" : ""}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={cx(styles.card, styles.milestone)} aria-labelledby="workboard-milestone">
            <h2 id="workboard-milestone" className={styles.sectionTitle}>NEXT MILESTONE / 次のマイルストーン</h2>
            <div className={styles.milestoneBox}>
              <div className={styles.milestoneHead}>
                <span className={styles.flag}>⚑</span>
                <div className={styles.milestoneTitle}>Bloom 段階 2-2 完了</div>
              </div>
              <div className={styles.milestoneStats}>
                <div>
                  <span className={styles.statLabel}>期日</span>
                  <span className={styles.statValue}>2026/06/15</span>
                </div>
                <div>
                  <span className={styles.statLabel}>残り</span>
                  <span className={styles.statValue}>あと <strong className={styles.daysValue}>26</strong> 日</span>
                </div>
                <div>
                  <span className={styles.statLabel}>関連プロジェクト</span>
                  <span className={styles.statValue}>Bloom サブページ展開</span>
                </div>
              </div>
              <div className={styles.milestoneProgress}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: "30%" }} />
                </div>
                <span className={styles.milestoneProgressValue}>30%</span>
              </div>
            </div>
          </section>

          <section className={cx(styles.card, styles.weekly)} aria-labelledby="workboard-weekly">
            <h2 id="workboard-weekly" className={styles.sectionTitle}>WEEKLY / 週次達成</h2>
            <WeeklyBarsSvg />
            <div className={styles.weekGrid}>
              {weeklyDays.map((day) => {
                const rate = day.total === 0 ? "—" : `${Math.round((day.completed / day.total) * 100)}%`;
                return (
                  <div key={`${day.day}-${day.date}`} className={styles.dayCard}>
                    <div className={styles.dayLabel}>{day.day}<span className={styles.dayDate}>{day.date}</span></div>
                    <div className={styles.dayCount}>{day.completed}/{day.total}</div>
                    <div className={styles.dayRate}>{rate}</div>
                    <div className={cx(styles.dayFlower, day.flower === "bud" && styles.dayFlowerBud, day.flower === "muted" && styles.dayFlowerMuted)}>
                      {day.flower === "bud" ? "♧" : "✿"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cx(styles.card, styles.team)} aria-labelledby="workboard-team">
            <h2 id="workboard-team" className={styles.sectionTitle}>TEAM / ワーカーステータス</h2>
            <div className={styles.teamList}>
              {teamMembers.map((member) => (
                <div key={member.name} className={styles.teamRow}>
                  <Image className={styles.avatar} src={member.avatar} alt="" width={34} height={34} />
                  <span className={styles.memberName}>{member.name}</span>
                  <span className={cx(styles.memberStatus, styles[member.tone])}>{member.status}</span>
                  <span className={styles.memberTask}>{member.task}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </GardenShell>
  );
}
