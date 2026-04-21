"use client";

/**
 * Forest ダッシュボード (/forest/dashboard)
 *
 * 認証・権限・ゲートをすべて ForestStateContext で管理。
 * ここではゲート通過済みならデータ表示、未通過なら login にリダイレクト。
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AccessDenied } from "../_components/AccessDenied";
import { MacroChart } from "../_components/MacroChart";
import { MicroGrid } from "../_components/MicroGrid";
import { SummaryCards } from "../_components/SummaryCards";
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
    <>
      <SummaryCards companies={companies} periods={periods} />
      <MacroChart companies={companies} periods={periods} />
      <MicroGrid companies={companies} periods={periods} shinkouki={shinkouki} />
    </>
  );
}
