"use client";

/**
 * Forest ダッシュボード (/forest/dashboard)
 *
 * 認証・権限・ゲートをすべて ForestStateContext で管理。
 * ここではゲート通過済みならデータ表示、未通過なら login にリダイレクト。
 */

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { AccessDenied } from "../_components/AccessDenied";
import { MacroChart } from "../_components/MacroChart";
import { MicroGrid } from "../_components/MicroGrid";
import { SummaryCards } from "../_components/SummaryCards";
import styles from "../_components/ForestDesign.module.css";
import { FOREST_THEME } from "../_constants/theme";
import { useForestState } from "../_state/ForestStateContext";

export default function ForestDashboardPage() {
  const router = useRouter();
  const {
    loading,
    isAuthenticated,
    hasPermission,
    isUnlocked,
    companies,
    periods,
    shinkouki,
  } = useForestState();

  // 未認証 or ゲート未通過 → login へ
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
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: FOREST_THEME.textMuted,
          fontSize: 14,
        }}
      >
        読み込み中...
      </div>
    );
  }

  if (!isAuthenticated || !hasPermission) {
    return <AccessDenied />;
  }

  if (!isUnlocked) {
    return null; // useEffect でリダイレクト中
  }

  return (
    <div className={styles.pageStack}>
      <section className={styles.pageHero}>
        <p className={styles.eyebrow}>Garden Forest</p>
        <h1 className={styles.heroTitle}>Dashboard</h1>
        <p className={styles.heroLead}>
          6法人の確定期と進行期を、森の入口で一覧するための経営ボードです。
          サマリー、推移グラフ、6法人マトリクスは既存データのまま維持しています。
        </p>
        <div className={styles.heroActions}>
          <button type="button" className={styles.subtleButton}>
            6法人マトリクス
          </button>
          <button type="button" className={styles.subtleButton}>
            進行期 {shinkouki.length}件
          </button>
        </div>
      </section>
      <SummaryCards companies={companies} periods={periods} />
      <div className={styles.dashboardGrid}>
        <MacroChart companies={companies} periods={periods} />
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>進行期インジケーター</h3>
          <div className={styles.periodList}>
            {shinkoukiByCompany.map(({ company, shinkouki: row }) => {
              const [from = "", to = ""] = row?.range.split("~") ?? [];
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
                  <span className={`${styles.periodBadge} ${row ? styles.periodBadgeGlow : ""}`}>
                    {row ? "進行期" : "未設定"}
                  </span>
                  <span className={styles.periodDate}>
                    {row ? `${from} - ${to}` : "進行期データなし"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <MicroGrid
        companies={companies}
        periods={periods}
        shinkouki={shinkouki}
        onEditShinkouki={(companyId) => router.push(`/forest/shinkouki/${companyId}`)}
      />
    </div>
  );
}
