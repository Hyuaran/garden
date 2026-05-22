"use client";

import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  blueprintNotes,
  blueprintOverview,
  moduleBlueprints,
  roleAllocations,
  sourceLinkGroups,
  stageTone,
} from "../_data";
import styles from "./BlueprintDashboard.module.css";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理者";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

const noteTone: Record<string, string> = {
  確認: styles.noteCheck,
  保護: styles.noteProtect,
  未確定: styles.notePending,
};

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

function ModuleGauge({ percent, stage }: { percent: number; stage: keyof typeof stageTone }) {
  const tone = stageTone[stage];
  return (
    <div className={styles.gaugeWrap}>
      <div
        className={styles.gaugeRing}
        style={{
          background: `conic-gradient(${tone.color} ${percent * 3.6}deg, var(--border-soft) 0deg)`,
        }}
      >
        <div className={styles.gaugeInner}>
          <span className={styles.gaugeValue}>{percent}</span>
          <span className={styles.gaugeUnit}>%</span>
        </div>
      </div>
      <span
        className={styles.stageChip}
        style={{ background: tone.background, borderColor: tone.border, color: tone.color }}
      >
        {stage}
      </span>
    </div>
  );
}

export default function BlueprintDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({
    ...item,
    active: item.href === "/bloom/blueprint",
  }));

  const releasedCount = moduleBlueprints.filter((m) => m.percent >= 100).length;
  const growingCount = moduleBlueprints.filter((m) => m.percent > 0 && m.percent < 100).length;
  const seedingCount = moduleBlueprints.filter((m) => m.percent === 0).length;

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
          title="Garden 設計図"
          titleJp="庭の今、ひと目で"
          subtitle="Garden Series の構造・モジュール・AI 体制・参照先を一望する設計の入口"
          accessBadge={{ icon: "🌱", label: "AI と自社の設計を反映" }}
        />

        <section className={cx(styles.card, styles.introCard)}>
          <div className={styles.introMain}>
            <p className={styles.kicker}>Garden Series とは</p>
            <p className={styles.introLead}>{blueprintOverview.lead}</p>
            <div className={styles.principleGrid}>
              {blueprintOverview.principles.map((item) => (
                <article key={item.title} className={styles.principleCard}>
                  <span className={styles.principleFlower} aria-hidden="true">❀</span>
                  <h3 className={styles.principleTitle}>{item.title}</h3>
                  <p className={styles.principleBody}>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className={styles.referenceBox}>
            <div className={styles.referenceLabel}>参照元 / References</div>
            <ul className={styles.referenceList}>
              {blueprintOverview.references.map((ref) => (
                <li key={ref} className={styles.referenceItem}>{ref}</li>
              ))}
            </ul>
          </aside>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>12 Modules</p>
              <h2 className={styles.sectionTitle}>12 モジュール状態表</h2>
            </div>
            <div className={styles.moduleLegend}>
              <span><i className={cx(styles.legendDot, styles.dotReleased)} />満開 {releasedCount}</span>
              <span><i className={cx(styles.legendDot, styles.dotGrowing)} />育成中 {growingCount}</span>
              <span><i className={cx(styles.legendDot, styles.dotSeeding)} />種まき {seedingCount}</span>
            </div>
          </div>
          <div className={styles.moduleGrid}>
            {moduleBlueprints.map((module) => (
              <div key={module.code} className={styles.moduleCard}>
                <div className={styles.moduleIcon}>
                  <Image src={module.iconSrc} alt="" width={44} height={44} />
                </div>
                <div className={styles.moduleInfo}>
                  <div className={styles.moduleNameRow}>
                    <span className={styles.moduleName}>{module.name}</span>
                    <span className={styles.moduleUsage}>{module.usage}</span>
                  </div>
                  <p className={styles.moduleDesc}>{module.description}</p>
                </div>
                <ModuleGauge percent={module.percent} stage={module.stage} />
              </div>
            ))}
          </div>
        </section>

        <div className={styles.twoCol}>
          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>AI Roles</p>
                <h2 className={styles.sectionTitle}>AI 体制</h2>
              </div>
            </div>
            <div className={styles.roleList}>
              {roleAllocations.map((roleItem) => (
                <article key={roleItem.name} className={styles.roleCard}>
                  <div className={styles.roleHead}>
                    <span className={styles.roleName}>{roleItem.name}</span>
                    <span className={styles.rolePosition}>{roleItem.position}</span>
                  </div>
                  <ul className={styles.roleResponsibilities}>
                    {roleItem.responsibilities.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                  <div className={styles.roleRecord}>記録先：{roleItem.recordTarget}</div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>Sources</p>
                <h2 className={styles.sectionTitle}>リファレンス先</h2>
              </div>
            </div>
            <div className={styles.sourceList}>
              {sourceLinkGroups.map((group) => (
                <article key={group.title} className={styles.sourceGroup}>
                  <div className={styles.sourceGroupTitle}>{group.title}</div>
                  <p className={styles.sourceGroupDesc}>{group.description}</p>
                  <ul className={styles.sourceItems}>
                    {group.items.map((item) => (
                      <li key={item.label} className={styles.sourceItem}>
                        <span className={styles.sourceItemLabel}>{item.label}</span>
                        <code className={styles.sourceItemPath}>{item.path}</code>
                        <span className={styles.sourceItemNote}>{item.note}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Known Notes</p>
              <h2 className={styles.sectionTitle}>既知メモ</h2>
            </div>
          </div>
          <div className={styles.noteGrid}>
            {blueprintNotes.map((note) => (
              <article key={note.title} className={styles.noteCard}>
                <span className={cx(styles.noteBadge, noteTone[note.severity])}>{note.severity}</span>
                <h3 className={styles.noteTitle}>{note.title}</h3>
                <p className={styles.noteBody}>{note.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </GardenShell>
  );
}
