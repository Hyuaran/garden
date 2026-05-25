"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  historyLogs,
  milestones,
  progressModules,
  progressSummary,
  type ProgressModule,
  type ProgressTab,
} from "../_data/progress";
import styles from "./ProgressDashboard.module.css";

const tabs: Array<{ key: ProgressTab; label: string }> = [
  { key: "overview", label: "全体 / Overview" },
  { key: "modules", label: "モジュール / Modules" },
  { key: "history", label: "履歴 / History" },
];

const historyPeriods = ["週", "月", "直近3か月", "全期間", "日付指定"] as const;
const phaseSteps = ["種まき", "芽吹き", "つぼみ", "咲きはじめ", "満開"] as const;

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

function statusLabel(status: ProgressModule["status"]) {
  if (status === "released") return "リリース済";
  if (status === "developing") return "開発中";
  return "未着手";
}

function parseHistoryDate(date: string) {
  return new Date(`${date.replace(/\//g, "-")}T00:00:00+09:00`);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function latestHistoryDate() {
  return historyLogs.map((log) => parseHistoryDate(log.date)).sort((a, b) => b.getTime() - a.getTime())[0];
}

function periodStartDate(period: string) {
  const latest = latestHistoryDate();
  if (period === "週") {
    const start = new Date(latest);
    start.setDate(start.getDate() - 6);
    return start;
  }
  if (period === "月") {
    const start = new Date(latest);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  if (period === "直近3か月") {
    const start = new Date(latest);
    start.setMonth(start.getMonth() - 3);
    return start;
  }
  return null;
}

export default function ProgressDashboard() {
  const { bloomUser, userEmail, role, lockAndLogout } = useBloomState();
  const [activeTab, setActiveTab] = useState<ProgressTab>("overview");
  const [historyModule, setHistoryModule] = useState("すべて");
  const [historyWorkstyle, setHistoryWorkstyle] = useState("すべて");
  const [historyPeriod, setHistoryPeriod] = useState("月");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const userName = bloomUser?.name ?? userEmail ?? "東海林 美樹";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/progress" }));

  const filteredHistory = useMemo(() => {
    const start = historyPeriod === "日付指定" && historyFrom ? new Date(`${historyFrom}T00:00:00+09:00`) : periodStartDate(historyPeriod);
    const end = historyPeriod === "日付指定" && historyTo ? new Date(`${historyTo}T23:59:59+09:00`) : latestHistoryDate();

    return historyLogs.filter((log) => {
      const byWorkstyle = historyWorkstyle === "すべて" || log.workstyle === historyWorkstyle;
      const byModule = historyModule === "すべて" || log.work.some((item) => item.module === historyModule) || log.tomorrow.some((item) => item.module === historyModule);
      const logDate = parseHistoryDate(log.date);
      const byDate = historyPeriod === "全期間" || ((!start || logDate >= start) && (!end || logDate <= end));
      return byWorkstyle && byModule && byDate;
    });
  }, [historyFrom, historyModule, historyPeriod, historyTo, historyWorkstyle]);

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
            title="Garden 開発進捗"
            titleJp="庭の育ち"
            subtitle="12モジュールの育ち方を、一望に"
            accessBadge={{ icon: "限定", label: "admin 3名のみ閲覧可" }}
          />
        </div>

        <nav className={styles.tabs} aria-label="progress sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cx(styles.tab, activeTab === tab.key && styles.tabActive)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "modules" && <ModulesTab />}
        {activeTab === "history" && (
          <HistoryTab
            historyModule={historyModule}
            historyWorkstyle={historyWorkstyle}
            historyPeriod={historyPeriod}
            historyFrom={historyFrom}
            historyTo={historyTo}
            setHistoryModule={setHistoryModule}
            setHistoryWorkstyle={setHistoryWorkstyle}
            setHistoryPeriod={setHistoryPeriod}
            setHistoryFrom={setHistoryFrom}
            setHistoryTo={setHistoryTo}
            filteredHistory={filteredHistory}
          />
        )}
      </div>
    </GardenShell>
  );
}

function OverviewTab() {
  return (
    <>
      <div className={styles.heroGrid}>
        <section className={cx(styles.panel, styles.overallCard)} aria-labelledby="progress-overall">
          <h2 id="progress-overall" className={styles.sectionTitle}>OVERALL / 全体進捗</h2>
          <p>12モジュールの育ち具合</p>
          <div className={styles.overallBody}>
            <div className={styles.ring}>
              <div className={styles.ringValue}>
                <strong>{progressSummary.percent}</strong>
                <span>%</span>
                <small>全体進捗</small>
              </div>
            </div>
            <div className={styles.legend}>
              <span><i className={styles.greenDot} />リリース済 {progressSummary.released} / 12</span>
              <span><i className={styles.goldDot} />開発中 {progressSummary.developing} / 12</span>
              <span><i className={styles.grayDot} />未着手 {progressSummary.pending} / 12</span>
            </div>
          </div>
        </section>

        <section className={cx(styles.panel, styles.milestoneCard)} aria-labelledby="progress-milestones">
          <h2 id="progress-milestones" className={styles.sectionTitle}>MILESTONES / マイルストーン</h2>
          <p>直近の達成と次の目標</p>
          <div className={styles.milestoneGrid}>
            <article>
              <h3>直近の達成（5件）</h3>
              {milestones.recent.map((item) => <p key={item.title}><time>{item.date}</time>{item.title}</p>)}
            </article>
            <article>
              <h3>次のマイルストーン（3件）</h3>
              {milestones.next.map((item) => <p key={item.title}><time>{item.date}</time>{item.title}</p>)}
            </article>
          </div>
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="progress-overview-modules">
        <h2 id="progress-overview-modules" className={styles.sectionTitle}>12 MODULES / モジュール別進捗</h2>
        <div className={styles.moduleGrid}>
          {progressModules.map((module, index) => <ModuleSummaryCard key={module.code} module={module} index={index} />)}
        </div>
      </section>
    </>
  );
}

function ModuleSummaryCard({ module, index }: { module: ProgressModule; index: number }) {
  return (
    <article className={styles.moduleCard}>
      <Image src={module.iconSrc} alt="" width={56} height={56} />
      <div className={styles.moduleInfo}>
        <div className={styles.moduleTop}><span>{index + 1}</span><h3>{module.name}</h3><b className={styles[module.status]}>{statusLabel(module.status)}</b></div>
        <div className={styles.progressTrack}><div style={{ width: `${module.percent}%` }} /></div>
        <div className={styles.moduleFoot}><small>{module.phase}</small><strong>{module.percent}%</strong></div>
      </div>
    </article>
  );
}

function ModulesTab() {
  const groups = Array.from(new Set(progressModules.map((module) => module.group)));

  return (
    <section className={styles.modulesLayout} aria-label="module details">
      <aside className={cx(styles.panel, styles.modulesToc)}>
        <h2 className={styles.sectionTitle}>MODULE INDEX</h2>
        {groups.map((group) => (
          <div key={group} className={styles.tocGroup}>
            <h3>{group}</h3>
            {progressModules.filter((module) => module.group === group).map((module) => (
              <a key={module.code} href={`#progress-module-${module.code}`}>
                <Image src={module.iconSrc} alt="" width={24} height={24} />
                <span>{module.name}</span>
                <b>{module.phase}</b>
              </a>
            ))}
          </div>
        ))}
      </aside>

      <div className={styles.modulesDetail}>
        {progressModules.map((module) => (
          <article key={module.code} id={`progress-module-${module.code}`} className={cx(styles.panel, styles.moduleDetailCard)}>
            <div className={styles.moduleDetailHead}>
              <Image src={module.iconSrc} alt="" width={54} height={54} />
              <div>
                <h2>{module.name}</h2>
                <p>{module.purpose}</p>
              </div>
              <span className={cx(styles.phasePill, styles[module.status])}>{statusLabel(module.status)}</span>
            </div>
            <PhaseScale phase={module.phase} />
            <div className={styles.moduleDetailBody}>
              <ModuleEvidence title="完了したこと" body={module.done} />
              <ModuleEvidence title="今ここ" body={module.now} accent />
              <ModuleEvidence title="次にやること" body={module.next} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PhaseScale({ phase }: { phase: string }) {
  return (
    <div className={styles.phaseScale} aria-label={`現在の段階: ${phase}`}>
      {phaseSteps.map((step) => (
        <span key={step} className={cx(step === phase && styles.phaseCurrent)}>
          <i />
          {step}
        </span>
      ))}
    </div>
  );
}

function ModuleEvidence({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div className={cx(styles.evidenceCard, accent && styles.evidenceNow)}>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function HistoryTab({
  historyModule,
  historyWorkstyle,
  historyPeriod,
  historyFrom,
  historyTo,
  setHistoryModule,
  setHistoryWorkstyle,
  setHistoryPeriod,
  setHistoryFrom,
  setHistoryTo,
  filteredHistory,
}: {
  historyModule: string;
  historyWorkstyle: string;
  historyPeriod: string;
  historyFrom: string;
  historyTo: string;
  setHistoryModule: (value: string) => void;
  setHistoryWorkstyle: (value: string) => void;
  setHistoryPeriod: (value: string) => void;
  setHistoryFrom: (value: string) => void;
  setHistoryTo: (value: string) => void;
  filteredHistory: typeof historyLogs;
}) {
  const latest = latestHistoryDate();
  const defaultFrom = toDateInputValue(periodStartDate("月") ?? latest);
  const defaultTo = toDateInputValue(latest);

  return (
    <>
      <section className={cx(styles.panel, styles.historyFilter)} aria-label="history filters">
        <label>
          <span>モジュール</span>
          <select value={historyModule} onChange={(event) => setHistoryModule(event.target.value)}>
            <option>すべて</option>
            {progressModules.map((module) => <option key={module.code}>{module.name}</option>)}
          </select>
        </label>
        <label>
          <span>勤務形態</span>
          <select value={historyWorkstyle} onChange={(event) => setHistoryWorkstyle(event.target.value)}>
            <option value="すべて">すべて</option>
            <option value="office">出社 / Office</option>
            <option value="home">在宅 / Home</option>
            <option value="irregular">イレギュラー / Irregular</option>
          </select>
        </label>
        <div className={styles.periodGroup} aria-label="period filter">
          {historyPeriods.map((label) => (
            <button
              key={label}
              type="button"
              className={cx(historyPeriod === label && styles.periodActive)}
              onClick={() => setHistoryPeriod(label)}
            >
              {label}
            </button>
          ))}
        </div>
        {historyPeriod === "日付指定" && (
          <div className={styles.dateRange} aria-label="date range filter">
            <label>
              <span>開始日</span>
              <input
                type="date"
                value={historyFrom}
                placeholder={defaultFrom}
                onChange={(event) => setHistoryFrom(event.currentTarget.value)}
                onInput={(event) => setHistoryFrom(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>終了日</span>
              <input
                type="date"
                value={historyTo}
                placeholder={defaultTo}
                onChange={(event) => setHistoryTo(event.currentTarget.value)}
                onInput={(event) => setHistoryTo(event.currentTarget.value)}
              />
            </label>
          </div>
        )}
      </section>

      <section className={styles.historyList} aria-label="history list">
        {filteredHistory.length === 0 && (
          <article className={cx(styles.panel, styles.emptyHistory)}>
            <p>指定した条件の履歴はありません。</p>
          </article>
        )}
        {filteredHistory.map((log) => (
          <article key={log.date} className={cx(styles.panel, styles.historyCard)}>
            <div className={styles.historyHead}>
              <span className={cx(styles.workPill, styles[log.workstyle])}>{workstyleLabel(log.workstyle)}</span>
              <strong>{log.date}</strong>
              <span>({log.day})</span>
            </div>
            <div className={styles.historyCols}>
              <HistoryColumn title="本日の作業" items={log.work} />
              <HistoryColumn title="明日の予定" items={log.tomorrow} />
            </div>
            <div className={styles.specialBlock}>
              <h3>特記事項</h3>
              <p>{log.special || "記録なし"}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function HistoryColumn({ title, items }: { title: string; items: Array<{ module: string; code: string; text: string }> }) {
  return (
    <div className={styles.historyCol}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item.module}-${item.text}`}>
            <Image src={`/themes/garden-shell/images/icons_bloom/orb_${item.code}.png`} alt="" width={24} height={24} />
            <strong>{item.module}</strong>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function workstyleLabel(workstyle: "office" | "home" | "irregular") {
  if (workstyle === "office") return "出社";
  if (workstyle === "home") return "在宅";
  return "不定期";
}
