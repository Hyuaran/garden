"use client";

import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import { moduleBlueprints, stageTone } from "../../blueprint/_data";
import { milestones, overallProgress, progressCharts } from "../_data";
import styles from "./ProgressDashboard.module.css";

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

function OverallGauge({ percent }: { percent: number }) {
  const angle = percent * 3.6;
  return (
    <div
      className={styles.overallRing}
      style={{
        background: `conic-gradient(#d99a30 ${angle}deg, var(--border-soft) 0deg)`,
      }}
    >
      <div className={styles.overallInner}>
        <span className={styles.overallValue}>{percent}<small>%</small></span>
        <span className={styles.overallLabel}>全体進捗</span>
      </div>
    </div>
  );
}

function MiniBarChart({ bars }: { bars: Array<{ label: string; value: number }> }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <svg className={styles.chartSvg} viewBox="0 0 220 96" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="progressBar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f0c074" />
          <stop offset="100%" stopColor="#cf8a2a" />
        </linearGradient>
      </defs>
      <line x1="6" y1="78" x2="214" y2="78" stroke="rgba(118,83,61,.2)" strokeWidth="1" />
      {bars.map((bar, index) => {
        const slot = 208 / bars.length;
        const barW = Math.min(24, slot * 0.5);
        const x = 6 + index * slot + (slot - barW) / 2;
        const h = Math.max(3, (bar.value / max) * 64);
        return (
          <g key={bar.label}>
            <rect x={x} y={78 - h} width={barW} height={h} rx="3" fill="url(#progressBar)" opacity="0.9" />
            <text x={x + barW / 2} y="90" textAnchor="middle" fontSize="7" fill="#a89b78">{bar.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function ProgressDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({
    ...item,
    active: item.href === "/bloom/progress",
  }));

  const doneMilestones = milestones.filter((m) => m.done);
  const upcomingMilestones = milestones.filter((m) => !m.done);

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
          title="Garden 開発進捗"
          titleJp="庭の育ち"
          subtitle="12 モジュールの育ち具合とマイルストーンを、一望に"
        />

        <div className={styles.topGrid}>
          <section className={cx(styles.card, styles.overallCard)}>
            <p className={styles.kicker}>Overall</p>
            <h2 className={styles.sectionTitle}>全体の育ち具合</h2>
            <div className={styles.overallBody}>
              <OverallGauge percent={overallProgress.percent} />
              <div className={styles.overallStats}>
                <div className={styles.overallStat}>
                  <span className={cx(styles.statDot, styles.dotReleased)} />
                  <span className={styles.statLabel}>満開（公開済）</span>
                  <span className={styles.statValue}>{overallProgress.released}</span>
                </div>
                <div className={styles.overallStat}>
                  <span className={cx(styles.statDot, styles.dotDeveloping)} />
                  <span className={styles.statLabel}>育成中</span>
                  <span className={styles.statValue}>{overallProgress.developing}</span>
                </div>
                <div className={styles.overallStat}>
                  <span className={cx(styles.statDot, styles.dotSeeding)} />
                  <span className={styles.statLabel}>種まき</span>
                  <span className={styles.statValue}>{overallProgress.seeding}</span>
                </div>
                <p className={styles.overallCaption}>{overallProgress.caption}</p>
              </div>
            </div>
          </section>

          <section className={cx(styles.card, styles.milestoneCard)}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>Milestones</p>
                <h2 className={styles.sectionTitle}>マイルストーン</h2>
              </div>
            </div>
            <div className={styles.milestoneCols}>
              <div className={styles.milestoneCol}>
                <div className={styles.milestoneColLabel}>達成済</div>
                <ul className={styles.milestoneList}>
                  {doneMilestones.map((m) => (
                    <li key={m.title} className={cx(styles.milestoneItem, styles.milestoneDone)}>
                      <span className={styles.milestoneMark} aria-hidden="true">✿</span>
                      <span className={styles.milestoneDate}>{m.date}</span>
                      <span className={styles.milestoneText}>
                        <strong>{m.title}</strong>
                        <small>{m.detail}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.milestoneCol}>
                <div className={styles.milestoneColLabel}>直近マイルストーン</div>
                <ul className={styles.milestoneList}>
                  {upcomingMilestones.map((m) => (
                    <li key={m.title} className={styles.milestoneItem}>
                      <span className={styles.milestoneMark} aria-hidden="true">○</span>
                      <span className={styles.milestoneDate}>{m.date}</span>
                      <span className={styles.milestoneText}>
                        <strong>{m.title}</strong>
                        <small>{m.detail}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>12 Modules</p>
              <h2 className={styles.sectionTitle}>12 モジュール一覧</h2>
            </div>
          </div>
          <div className={styles.moduleGrid}>
            {moduleBlueprints.map((module) => {
              const tone = stageTone[module.stage];
              return (
                <div key={module.code} className={styles.moduleCard}>
                  <div className={styles.moduleIcon}>
                    <Image src={module.iconSrc} alt="" width={38} height={38} />
                  </div>
                  <div className={styles.moduleName}>{module.name}</div>
                  <div className={styles.moduleUsage}>{module.usage}</div>
                  <div className={styles.moduleBarTrack}>
                    <div
                      className={styles.moduleBarFill}
                      style={{ width: `${module.percent}%`, background: tone.color }}
                    />
                  </div>
                  <div className={styles.moduleMeta}>
                    <span className={styles.modulePercent}>{module.percent}%</span>
                    <span
                      className={styles.moduleStage}
                      style={{ background: tone.background, borderColor: tone.border, color: tone.color }}
                    >
                      {module.stage}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Trends</p>
              <h2 className={styles.sectionTitle}>育ちの推移</h2>
            </div>
          </div>
          <div className={styles.chartGrid}>
            {progressCharts.map((chart) => (
              <div key={chart.title} className={styles.chartCard}>
                <div className={styles.chartHead}>
                  <span className={styles.chartTitle}>{chart.title}</span>
                  <span className={styles.chartSub}>{chart.subtitle}（{chart.unit}）</span>
                </div>
                <MiniBarChart bars={chart.bars} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </GardenShell>
  );
}
