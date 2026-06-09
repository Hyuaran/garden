"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import PageHeader from "@/app/_components/layout/GardenShell/PageHeader";

import { AccessDenied } from "../_components/AccessDenied";
import styles from "../_components/ForestDesign.module.css";
import { MacroChart } from "../_components/MacroChart";
import { MicroGrid } from "../_components/MicroGrid";
import { SummaryCards } from "../_components/SummaryCards";
import { FOREST_THEME } from "../_constants/theme";
import { useForestState } from "../_state/ForestStateContext";

type DashboardTab = "overview" | "matrix";

export default function ForestDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const {
    loading,
    isAuthenticated,
    hasPermission,
    isUnlocked,
    companies,
    periods,
    shinkouki,
  } = useForestState();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isUnlocked) {
      router.replace("/forest/login");
    }
  }, [loading, isAuthenticated, isUnlocked, router]);

  const shinkoukiByCompany = useMemo(
    () =>
      companies.map((company) => ({
        company,
        shinkouki: shinkouki.find((row) => row.company_id === company.id) ?? null,
      })),
    [companies, shinkouki],
  );

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: FOREST_THEME.textMuted, fontSize: 14 }}>
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission) {
    return <AccessDenied />;
  }

  if (!isUnlocked) return null;

  return (
    <div className={styles.pageStack}>
      <PageHeader
        title="ダッシュボード"
        subtitle="グループ全体の財務状況を俯瞰できる経営ダッシュボードです。主要指標と進行状況をリアルタイムで確認できます。"
        accessBadge={{ icon: "🌱", label: "Forest" }}
        moduleMark="forest"
        favoriteIcon="/themes/garden-shell/images/icons_bloom/orb_forest.png"
      />

      <div className={styles.dashboardTabs} role="tablist" aria-label="Forest dashboard tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className={`${styles.dashboardTab} ${activeTab === "overview" ? styles.dashboardTabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "matrix"}
          className={`${styles.dashboardTab} ${activeTab === "matrix" ? styles.dashboardTabActive : ""}`}
          onClick={() => setActiveTab("matrix")}
        >
          6法人マトリクス
        </button>
      </div>

      {activeTab === "overview" ? (
        <>
          <SummaryCards companies={companies} periods={periods} />
          <div className={styles.mockDashboardGrid}>
            <MacroChart companies={companies} periods={periods} />
            <div className={styles.rightColumn}>
              <section className={styles.panel}>
                <h3 className={styles.panelTitle}>進行期インジケーター</h3>
                <div className={styles.periodList}>
                  {shinkoukiByCompany.map(({ company, shinkouki: row }, index) => {
                    const [from = "", to = ""] = row?.range.split("~") ?? [];
                    const preparing = Boolean(row) && index === shinkoukiByCompany.length - 1;
                    return (
                      <button
                        key={company.id}
                        type="button"
                        className={styles.periodItem}
                        onClick={() => router.push(`/forest/shinkouki/${company.id}`)}
                      >
                        <span className={styles.companyLine}>
                          <span className={styles.companyDot} style={{ background: company.color }} />
                          <span className={styles.companyName}>{company.short}</span>
                        </span>
                        <span className={`${styles.periodBadge} ${row && !preparing ? styles.periodBadgeGlow : ""} ${preparing ? styles.periodBadgeWarm : ""}`}>
                          {row ? (preparing ? "準備中" : "進行中") : "未設定"}
                        </span>
                        <span className={styles.periodDate}>
                          {row ? `${from} - ${to}` : "進行期データなし"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <TaxCalendar />
            </div>
          </div>
        </>
      ) : (
        <MicroGrid
          companies={companies}
          periods={periods}
          shinkouki={shinkouki}
          onEditShinkouki={(companyId) => router.push(`/forest/shinkouki/${companyId}`)}
        />
      )}
    </div>
  );
}

function TaxCalendar() {
  const items = [
    { date: "6月10日（水）", kind: "固定資産税", label: "第1期 納期限", status: "期限間近" },
    { date: "6月15日（月）", kind: "源泉所得税", label: "5月分 納期限", status: "3日後" },
    { date: "6月30日（火）", kind: "住民税（特別徴収）", label: "5月分 納期限", status: "18日後" },
  ];

  return (
    <section className={`${styles.panel} ${styles.taxPanel}`}>
      <div className={styles.taxHeader}>
        <h3 className={styles.panelTitle}>納税カレンダー</h3>
        <div className={styles.taxMonthNav}>
          <span>‹</span>
          <strong>2026年6月</strong>
          <span>›</span>
        </div>
      </div>
      <div className={styles.taxList}>
        {items.map((item) => (
          <div key={`${item.date}-${item.kind}`} className={styles.taxItem}>
            <span className={styles.taxDate}>{item.date}</span>
            <span className={styles.taxKind}>{item.kind}</span>
            <span className={styles.taxLabel}>{item.label}</span>
            <span className={styles.taxStatus}>{item.status}</span>
          </div>
        ))}
      </div>
      <button type="button" className={styles.taxMore}>
        すべての納税予定を表示
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
}
