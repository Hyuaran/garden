"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { BLOOM_GARDEN_PAGE_MENU } from "../../_components/bloom-garden-menu";
import { useBloomState } from "../../_state/BloomStateContext";
import {
  actionCards,
  companies,
  consolidatedCharts,
  companyDetails,
  decisions,
  divisions,
  gardenModules,
  gardenProgress,
  meeting,
  performanceAlerts,
  performanceKpis,
  reports,
  shojiStatus,
  type CeoStatusTab,
  type ConsolidatedChart,
} from "../_data";
import styles from "./CeoStatusDashboard.module.css";

const TABS: Array<{ key: CeoStatusTab; jp: string; en: string }> = [
  { key: "overview", jp: "全体", en: "Overview" },
  { key: "performance", jp: "業績", en: "Performance" },
  { key: "decisions", jp: "判断・会議", en: "Decisions" },
  { key: "settings", jp: "設定", en: "Settings" },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function roleLabel(role: string | null) {
  if (role === "super_admin") return "正社員 / 全権管理者";
  if (role) return `Garden role: ${role}`;
  return "Garden Bloom";
}

function moduleStatusLabel(status: string) {
  if (status === "released") return "リリース済";
  if (status === "developing") return "開発中";
  return "未着手";
}

function readPreviewRole(): "admin" | "staff" | null {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS !== "1") return null;
  const roleParam = new URLSearchParams(window.location.search).get("ceoPreviewRole");
  if (roleParam === "admin" || roleParam === "staff") return roleParam;
  return null;
}

function subscribePreviewRole() {
  return () => {};
}

function ConsolidatedChartSvg({ chart }: { chart: ConsolidatedChart }) {
  if (chart.kind === "line") {
    const points = chart.values.map((value, index) => `${index === 5 ? 195 : 10 + index * 40},${value}`).join(" ");
    return (
      <svg className={styles.consolidatedChartSvg} viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} stroke="#7a9968" strokeWidth="1.8" fill="none" />
        {chart.values.map((value, index) => {
          const x = index === 5 ? 195 : 10 + index * 40;
          return <circle key={`${chart.title}-${index}`} cx={x} cy={value} r="2.5" fill="#7a9968" />;
        })}
        {chart.labels.map((label, index) => {
          const x = index === 5 ? 195 : 10 + index * 40;
          return <text key={label} x={x} y="66" fill="#a89b78" fontSize="6" textAnchor="middle">{label}</text>;
        })}
      </svg>
    );
  }

  return (
    <svg className={styles.consolidatedChartSvg} viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
      {chart.values.map((height, index) => {
        const x = 10 + index * 30;
        return (
          <rect
            key={`${chart.title}-${index}`}
            x={x}
            y={57 - height}
            width="20"
            height={height}
            fill={index < 3 ? "#9bb88a" : "#7a9968"}
            opacity="0.85"
          />
        );
      })}
      {chart.labels.map((label, index) => (
        <text key={label} x={20 + index * 30} y="66" fill="#a89b78" fontSize="6" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

export default function CeoStatusDashboard() {
  const { bloomUser, userEmail, role, loading, lockAndLogout } = useBloomState();
  const [activeTab, setActiveTab] = useState<CeoStatusTab>("overview");
  const previewRole = useSyncExternalStore(subscribePreviewRole, readPreviewRole, () => null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = previewRole === "admin" || (previewRole !== "staff" && bloomUser?.garden_role === "super_admin");
  const userName = bloomUser?.name ?? (previewRole === "admin" ? "東海林 美琴" : userEmail) ?? "東海林 美琴";
  const activeMenu = BLOOM_GARDEN_PAGE_MENU.map((item) => ({ ...item, active: item.href === "/bloom/ceo-status" }));

  const switchTab = (tab: CeoStatusTab, shouldScroll = true) => {
    setActiveTab(tab);
    if (shouldScroll) {
      window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

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
        <PageHeader
          title="経営状況"
          titleJp="経営の全景を、一望に"
          subtitle="経営判断のための統合ダッシュボード"
          accessBadge={{ icon: "👑", label: "限定公開 admin 3名のみ閲覧可能" }}
        />

        <nav className={styles.tabNav} role="tablist" aria-label="CEO status tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={cx(styles.tabItem, activeTab === tab.key && styles.tabItemActive, tab.key === "settings" && styles.tabItemSettings)}
              onClick={() => switchTab(tab.key)}
              aria-selected={activeTab === tab.key}
            >
              <span className={styles.tabItemJp}>{tab.jp}</span>/ {tab.en}
            </button>
          ))}
        </nav>

        <div ref={contentRef}>
          {loading && !previewRole ? (
            <div className={styles.placeholderPanel}>経営状況を読み込んでいます</div>
          ) : !isSuperAdmin ? (
            <div className={styles.permissionPanel}>
              <strong>権限がありません</strong>
              <span>admin 3名のみ閲覧可能です。</span>
            </div>
          ) : (
            <>
              {activeTab === "overview" && <OverviewTab onJump={(tab) => switchTab(tab)} />}
              {activeTab === "performance" && <PerformanceTab />}
              {activeTab === "decisions" && <DecisionsTab />}
              {activeTab === "settings" && <SettingsTab />}
            </>
          )}
        </div>
      </div>
    </GardenShell>
  );
}

function OverviewTab({ onJump }: { onJump: (tab: "performance" | "decisions") => void }) {
  return (
    <section className={styles.tabContent} aria-label="全体 Overview">
      <div className={styles.shojiStatusBar}>
        <div className={styles.shojiStatusIcon}>
          <Image src={shojiStatus.avatar} alt="東海林" width={48} height={48} />
        </div>
        <div className={styles.shojiStatusText}>
          <span className={styles.shojiStatusName}><strong>{shojiStatus.name}</strong>: {shojiStatus.status}</span>
          <span className={styles.shojiStatusDivider}>/</span>
          <span className={styles.shojiStatusTask}>{shojiStatus.task}</span>
          <span className={styles.shojiStatusDivider}>/</span>
          <span className={styles.shojiStatusTime}>{shojiStatus.until}</span>
        </div>
        <span className={styles.shojiStatusBadge}>{shojiStatus.status}</span>
      </div>

      <div className={cx(styles.ceoCard, styles.gardenProgressCard)}>
        <div className={styles.gardenProgressHeader}>
          <span className={styles.gardenProgressTitle}>Garden開発進捗</span>
          <div className={styles.gardenProgressBarWrap}>
            <span className={styles.gardenProgressLabel}>全体進捗</span>
            <span className={styles.gardenProgressValue}>{gardenProgress.percent}%</span>
            <div className={styles.gardenProgressBar}>
              <div className={styles.gardenProgressFill} style={{ width: `${gardenProgress.percent}%` }} />
            </div>
          </div>
          <div className={styles.gardenProgressSummary}>
            <span><i className={cx(styles.gpDot, styles.dotReleased)} />リリース済 {gardenProgress.released}</span>
            <span><i className={cx(styles.gpDot, styles.dotDeveloping)} />開発中 {gardenProgress.developing}</span>
            <span><i className={cx(styles.gpDot, styles.dotPending)} />未着手 {gardenProgress.pending}</span>
          </div>
        </div>
        <div className={styles.gardenOrbs}>
          {gardenModules.map((module) => (
            <div key={module.name} className={cx(styles.gardenOrb, styles[module.status])}>
              <div className={styles.gardenOrbImg}>
                <Image src={module.icon} alt="" width={38} height={38} />
              </div>
              <span className={styles.gardenOrbName}>{module.name}</span>
              <span className={styles.gardenOrbStatus}>{moduleStatusLabel(module.status)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ceoCard}>
        <div className={styles.ceoCardTitle}>6法人サマリ<span className={styles.ceoCardTitleSub}>— グループ全体と各社の業績</span></div>
        <div className={styles.companiesGrid}>
          {companies.map((company) => (
            <div key={company.name} className={cx(styles.companyCard, company.warning && styles.companyWarning)}>
              <div className={styles.companyName}>{company.name}</div>
              <div className={styles.companyMiniChart}>
                {company.bars.map((bar, index) => <span key={`${company.name}-${index}`} style={{ height: `${bar}%` }} />)}
              </div>
              <div className={styles.companyMetricsGrid}>
                <div className={styles.companyMetric}>利益</div>
                <div className={styles.companyMetricValue}>{company.profit}</div>
                <div className={styles.companyMetric}>現預金</div>
                <div className={styles.companyMetricValue}>{company.cash}</div>
              </div>
              <div className={styles.companyYoy}>
                <span className={styles.companyYoyLabel}>前年比</span>
                <span className={cx(styles.companyYoyValue, company.warning && styles.negative)}>{company.yoy}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.consolidatedCharts}>
          {consolidatedCharts.map((chart) => (
            <div key={chart.title} className={styles.consolidatedChartCard}>
              <div className={styles.consolidatedChartTitle}>{chart.title}<small>({chart.subtitle})</small></div>
              <ConsolidatedChartSvg chart={chart} />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actionDivider}>
        <span className={styles.actionDividerText}>
          <span className={styles.actionDividerFlower} aria-hidden="true"><svg viewBox="0 0 18 18"><g fill="#e8b4b8" opacity="0.85"><circle cx="9" cy="9" r="3" /></g></svg></span>
          Action Items
          <span className={styles.actionDividerTextJp}>判断・報告</span>
        </span>
      </div>

      <div className={styles.actionGrid}>
        {actionCards.map((card) => (
          <button key={card.title} type="button" className={cx(styles.actionCard, card.tone === "fuji" && styles.actionCardFuji)} onClick={() => onJump(card.target)}>
            <span className={styles.actionCardHeader}><span className={styles.actionCardTitle}>{card.title}</span><span className={styles.actionCardLink}>↗</span></span>
            <span className={styles.actionCardList}>
              {card.items.map((item) => <span key={`${card.title}-${item.text}`} className={styles.actionCardItem}><span className={styles.actionCardItemNum}>{item.marker}</span>{item.text}</span>)}
            </span>
            <span className={styles.actionCardHint}>クリックで詳細タブへ</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PerformanceTab() {
  const divisionAreaRef = useRef<HTMLDivElement>(null);
  const [divisionSlider, setDivisionSlider] = useState({ left: 0, width: 70 });

  const updateDivisionSlider = () => {
    const area = divisionAreaRef.current;
    if (!area) return;
    const max = area.scrollWidth - area.clientWidth;
    if (max <= 0) {
      setDivisionSlider({ left: 0, width: 100 });
      return;
    }
    const width = (area.clientWidth / area.scrollWidth) * 100;
    setDivisionSlider({ width, left: (area.scrollLeft / max) * (100 - width) });
  };

  const scrollDivisions = (direction: -1 | 1) => {
    divisionAreaRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });
    window.setTimeout(updateDivisionSlider, 300);
  };

  return (
    <section className={styles.tabContent} aria-label="業績 Performance">
      <div className={styles.ceoCardLarge}>
        <div className={styles.ceoCardTitle}>業績ハイライト<span className={styles.ceoCardTitleSub}>Performance Highlights — KPIと推移</span></div>
        <div className={styles.kpiIntegratedGrid}>
          {performanceKpis.map((kpi) => (
            <div key={kpi.label} className={styles.kpiIntegratedCard}>
              <div className={styles.kpiIntegratedHeader}>
                <div className={styles.kpiIntegratedIcon}>{kpi.icon}</div>
                <div className={styles.kpiIntegratedLabel}>{kpi.label}{kpi.subLabel && <small>{kpi.subLabel}</small>}</div>
              </div>
              <div className={styles.kpiIntegratedValue}>
                {kpi.prefix && <span className={styles.kpiIntegratedValueYen}>{kpi.prefix}</span>}
                {kpi.value}
                {kpi.unit && <span className={styles.kpiIntegratedValueUnit}>{kpi.unit}</span>}
              </div>
              <div className={styles.kpiIntegratedYoy}>
                <span className={styles.kpiIntegratedYoyLabel}>{kpi.yoyLabel}</span>
                <span className={styles.kpiIntegratedYoyArrow}>↑</span>
                <span>{kpi.yoy}</span>
              </div>
              <svg className={styles.kpiIntegratedChart} viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true">
                {kpi.polylines.map((line) => (
                  <polyline key={line.points} points={line.points} stroke={line.stroke} strokeWidth={line.strokeWidth} fill="none" strokeDasharray={line.dash} />
                ))}
              </svg>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.divisionsSection}>
        <div className={styles.divisionsHeader}>
          <div className={styles.divisionsTitle}>事業部別売上<span className={styles.divisionsTitleSub}>— 全社事業ポートフォリオ(マトリクス集計)</span></div>
          <div className={styles.scrollControls}>
            <button type="button" className={styles.scrollBtn} onClick={() => scrollDivisions(-1)} aria-label="事業別ステータスを左へスクロール">◀</button>
            <button type="button" className={styles.scrollBtn} onClick={() => scrollDivisions(1)} aria-label="事業別ステータスを右へスクロール">▶</button>
          </div>
        </div>
        <div className={styles.scrollWrap}>
          <div className={styles.scrollArea} ref={divisionAreaRef} onScroll={updateDivisionSlider}>
            <div className={styles.divisionsTrack}>
              {divisions.map((division) => (
                <div key={division.name} className={cx(styles.divisionCard, division.future && styles.future)}>
                  <div className={styles.divisionIcon}>{division.icon}</div>
                  <div className={styles.divisionName}>{division.name}</div>
                  <div className={cx(styles.divisionRevenue, division.future && styles.mutedRevenue)}>{division.revenue}<span className={styles.divisionRevenueUnit}>{division.revenueUnit}</span></div>
                  <div className={styles.divisionRatio}>{division.ratio}</div>
                  <div className={cx(styles.divisionYoy, division.yoyTone && styles[division.yoyTone], division.future && styles.futureYoy)}>{division.yoy}</div>
                  <svg className={styles.divisionMiniChart} viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
                    {division.chart.type === "line" ? (
                      <line x1="5" y1="20" x2="195" y2="20" stroke={division.chart.stroke} strokeWidth="1" strokeDasharray="3,2" />
                    ) : (
                      <polyline points={division.chart.points} stroke={division.chart.stroke} strokeWidth="1.5" fill="none" />
                    )}
                  </svg>
                  <span className={cx(styles.divisionStatusBadge, styles[division.statusTone])}>{division.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.scrollSlider}>
          <div className={styles.scrollSliderThumb} style={{ width: `${divisionSlider.width}%`, left: `${divisionSlider.left}%` }} />
        </div>
      </div>

      <div className={styles.ceoCardLarge}>
        <div className={styles.ceoCardTitle}>6法人 業績詳細<span className={styles.ceoCardTitleSub}>— 各社のKPI比較</span></div>
        <div className={styles.companiesDetailGrid}>
          {companyDetails.map((company) => (
            <div key={company.name} className={styles.companyDetailCard}>
              <div className={styles.companyDetailHeader}>
                <span className={styles.companyDetailName}>{company.name}</span>
                <span className={cx(styles.companyDetailBadge, styles[company.statusTone])}>{company.status}</span>
              </div>
              {company.rows.map((row) => (
                <div key={`${company.name}-${row.label}`} className={styles.companyDetailRow}>
                  <span className={styles.companyDetailRowLabel}>{row.label}</span>
                  <span className={cx(styles.companyDetailRowValue, row.tone && styles[row.tone])}>{row.value}</span>
                </div>
              ))}
              <svg className={styles.companyDetailMiniChart} viewBox="0 0 200 32" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={company.chartPoints} stroke={company.chartStroke} strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.ceoCardLarge}>
        <div className={styles.ceoCardTitle}>業績アラート 全件</div>
        <div className={styles.alertsTable}>
          <div className={styles.alertsTableHeader}>
            <span />
            <span>アラート</span>
            <span>詳細</span>
            <span>推奨アクション</span>
            <span>担当者</span>
            <span>ステータス</span>
          </div>
          {performanceAlerts.map((alert) => (
            <div key={alert.title} className={styles.alertsTableRow}>
              <span className={styles.alertIconCell}>{alert.icon}</span>
              <span className={styles.alertTitle}>{alert.title}</span>
              <span className={styles.alertDetail}>{alert.detail}</span>
              <span className={styles.alertAction}>{alert.action}</span>
              <span>{alert.owner}</span>
              <span><span className={cx(styles.alertStatusBadge, styles[alert.statusTone])}>{alert.status}</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DecisionsTab() {
  const decisionAreaRef = useRef<HTMLDivElement>(null);
  const [decisionSlider, setDecisionSlider] = useState({ left: 0, width: 70 });
  const [priority, setPriority] = useState("全件");
  const [reportFilter, setReportFilter] = useState("全て");

  const updateDecisionSlider = () => {
    const area = decisionAreaRef.current;
    if (!area) return;
    const max = area.scrollWidth - area.clientWidth;
    if (max <= 0) {
      setDecisionSlider({ left: 0, width: 100 });
      return;
    }
    const width = (area.clientWidth / area.scrollWidth) * 100;
    setDecisionSlider({ width, left: (area.scrollLeft / max) * (100 - width) });
  };

  const scrollDecisions = (direction: -1 | 1) => {
    decisionAreaRef.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
    window.setTimeout(updateDecisionSlider, 300);
  };

  return (
    <section className={styles.tabContent} aria-label="判断・会議 Decisions">
      <div className={styles.decisionsSection}>
        <div className={styles.decisionsHeader}>
          <div className={styles.decisionsTitle}>1. 経営判断待ち案件<span className={styles.decisionsTitleSub}>— 後道代表のご判断をお願いいたします</span></div>
          <div className={styles.decisionsControls}>
            <div className={styles.priorityFilter}>
              <span className={styles.priorityFilterLabel}>優先度フィルタ:</span>
              {["全件", "重要", "高", "中"].map((item) => (
                <button key={item} type="button" className={cx(styles.priorityFilterBtn, priority === item && styles.active)} onClick={() => setPriority(item)}>{item}</button>
              ))}
            </div>
            <div className={styles.decisionsCounter}>現在 <strong>8件</strong></div>
            <div className={styles.scrollControls}>
              <button type="button" className={styles.scrollBtn} onClick={() => scrollDecisions(-1)} aria-label="判断カードを左へスクロール">◀</button>
              <button type="button" className={styles.scrollBtn} onClick={() => scrollDecisions(1)} aria-label="判断カードを右へスクロール">▶</button>
            </div>
          </div>
        </div>

        <div className={styles.scrollWrap}>
          <div className={styles.scrollArea} ref={decisionAreaRef} onScroll={updateDecisionSlider}>
            <div className={styles.decisionsTrack}>
              {decisions.map((decision) => (
                <div key={decision.number} className={cx(styles.decisionCard, decision.hoverDemo && styles.hoverDemo)}>
                  <span className={styles.decisionCardArrow}>↗</span>
                  <div className={styles.decisionCardHeader}>
                    <span className={cx(styles.priorityBadge, styles[decision.priorityTone])}>{decision.priority}</span>
                    <span className={styles.decisionCardNum}>{decision.number}</span>
                    <span className={styles.decisionCardName}>{decision.name}</span>
                  </div>
                  <div className={styles.decisionCardBody}>
                    {decision.rows.map((row) => (
                      <div key={`${decision.number}-${row.label}`} className={styles.decisionCardRow}>
                        <span className={styles.decisionCardRowLabel}>{row.label}</span>
                        <span className={cx(styles.decisionCardRowValue, row.tone && styles[row.tone])}>
                          {row.tone === "assignee" && <span className={styles.decisionCardAvatar}><Image src={decision.avatar} alt="" width={22} height={22} /></span>}
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.decisionCardActions}>
                    {["承認", "差戻", "保留"].map((label, index) => (
                      <button key={label} type="button" className={cx(styles.decisionActionBtn, index === 0 && styles.approve, index === 1 && styles.reject, index === 2 && styles.hold)} onClick={(event) => event.stopPropagation()}>{label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.scrollSlider}>
          <div className={styles.scrollSliderThumb} style={{ width: `${decisionSlider.width}%`, left: `${decisionSlider.left}%` }} />
        </div>
      </div>

      <div className={styles.meetingsReportsGrid}>
        <div className={styles.meetingsCard}>
          <div className={styles.meetingsCardTitle}>2. 責任者会議<small>— 議題プレビュー & 過去アーカイブ</small></div>
          <div className={styles.meetingNext}>
            <div className={styles.meetingNextHeader}>{meeting.title}</div>
            <div className={styles.meetingNextInfo}>
              {meeting.details.map((detail) => (
                <span key={detail.label} className={styles.detailPair}>
                  <span className={styles.meetingNextInfoLabel}>{detail.label}</span>
                  <span className={styles.meetingNextInfoValue}>{detail.value}</span>
                </span>
              ))}
            </div>
            <ul className={styles.meetingAgendaList}>
              {meeting.agenda.map((agenda) => (
                <li key={agenda.number} className={styles.meetingAgendaItem}>
                  <span className={styles.meetingAgendaNum}>{agenda.number}</span>
                  <span className={styles.meetingAgendaName}>{agenda.name} <small>(担当:{agenda.owner})</small></span>
                  <span className={cx(styles.meetingAgendaStatus, styles[agenda.statusTone])}>{agenda.status}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.meetingArchiveTitle}>過去会議アーカイブ</div>
          <div className={styles.meetingArchiveList}>
            {meeting.archives.map((archive) => (
              <div key={archive.date} className={styles.meetingArchiveItem}>
                <span className={styles.meetingArchiveDate}>{archive.date}</span>
                <div className={styles.meetingArchiveContent}>
                  <strong>{archive.title}</strong>
                  <span>{archive.summary}</span>
                </div>
                <a href="#" className={styles.meetingArchiveLink}>サマリ閲覧</a>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.reportsCard}>
          <div className={styles.reportsCardHeader}>
            <div className={styles.reportsCardTitle}>3. 後道代表への報告履歴</div>
            <div className={styles.reportsFilter}>
              {["全て", "順調", "対応中", "要判断", "計画通り"].map((item) => (
                <button key={item} type="button" className={cx(styles.reportsFilterBtn, reportFilter === item && styles.active)} onClick={() => setReportFilter(item)}>{item}</button>
              ))}
            </div>
          </div>
          <div className={styles.reportsTableWrap}>
            <table className={styles.reportsTable}>
              <thead>
                <tr>
                  <th className={styles.colNum}>#</th>
                  <th className={styles.colDate}>報告日</th>
                  <th className={styles.colContent}>報告内容</th>
                  <th className={styles.colAuthor}>担当</th>
                  <th className={styles.colStatus}>ステータス</th>
                  <th className={styles.colAttach}>添付</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.number}>
                    <td className={styles.colNum}>{report.number}</td>
                    <td className={styles.colDate}>{report.date}</td>
                    <td className={styles.colContent}>{report.content}</td>
                    <td className={styles.colAuthor}>{report.author}</td>
                    <td className={styles.colStatus}><span className={cx(styles.reportStatusBadge, styles[report.statusTone])}>{report.status}</span></td>
                    <td className={styles.colAttach}>📎</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsTab() {
  return (
    <section className={styles.tabContent} aria-label="設定 Settings">
      <div className={styles.settingsPlaceholder}>
        <div className={styles.settingsPlaceholderIcon}>
          <Image src="/themes/garden-shell/images/header_icons/D-04_settings_simple.png" alt="" width={64} height={64} />
        </div>
        <h2 className={styles.settingsPlaceholderTitle}>Bloom 設定</h2>
        <p className={styles.settingsPlaceholderText}>準備中です</p>
        <p className={styles.settingsPlaceholderSub}>テーマ・通知・表示カスタマイズ等を、この画面で一元管理できるようになります。</p>
      </div>
    </section>
  );
}
