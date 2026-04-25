"use client";

/**
 * Forest ダッシュボード (/forest/dashboard)
 *
 * 認証・権限・ゲートをすべて ForestStateContext で管理。
 * ここではゲート通過済みならデータ表示、未通過なら login にリダイレクト。
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccessDenied } from "../_components/AccessDenied";
import { MacroChart } from "../_components/MacroChart";
import { MicroGrid } from "../_components/MicroGrid";
import { ShinkoukiEditModal } from "../_components/ShinkoukiEditModal";
import { SummaryCards } from "../_components/SummaryCards";
import { TaxCalendar } from "../_components/TaxCalendar";
import { TaxDetailModal } from "../_components/TaxDetailModal";
import { FOREST_THEME } from "../_constants/theme";
import { isForestAdmin } from "../_lib/permissions";
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
    nouzeiSchedules,
    forestUser,
    refreshData,
  } = useForestState();

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const isAdmin = isForestAdmin(forestUser);

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

  const editingIndex = editingCompanyId
    ? companies.findIndex((c) => c.id === editingCompanyId)
    : -1;
  const editingCompany = editingIndex >= 0 ? companies[editingIndex] : null;
  const editingShinkouki = editingCompanyId
    ? shinkouki.find((s) => s.company_id === editingCompanyId) ?? null
    : null;

  function handleNavigate(direction: 1 | -1) {
    if (editingIndex < 0) return;
    const next = editingIndex + direction;
    if (next >= 0 && next < companies.length) {
      setEditingCompanyId(companies[next].id);
    }
  }

  // T-F11-01: pill クリック時に選択 schedule とその法人を解決
  const selectedSchedule = selectedScheduleId
    ? nouzeiSchedules.find((s) => s.id === selectedScheduleId) ?? null
    : null;
  const selectedCompany = selectedSchedule
    ? companies.find((c) => c.id === selectedSchedule.company_id) ?? null
    : null;

  return (
    <>
      <SummaryCards companies={companies} periods={periods} />
      <TaxCalendar
        companies={companies}
        schedules={nouzeiSchedules}
        onPillClick={(id) => setSelectedScheduleId(id)}
      />
      <MacroChart companies={companies} periods={periods} />
      <MicroGrid
        companies={companies}
        periods={periods}
        shinkouki={shinkouki}
        onEditShinkouki={isAdmin ? setEditingCompanyId : undefined}
      />

      {editingCompany && editingShinkouki && (
        <ShinkoukiEditModal
          company={editingCompany}
          shinkouki={editingShinkouki}
          onClose={() => setEditingCompanyId(null)}
          onSaved={refreshData}
          onNavigate={handleNavigate}
          navIndex={{ current: editingIndex, total: companies.length }}
        />
      )}

      {selectedScheduleId && selectedCompany && (
        <TaxDetailModal
          scheduleId={selectedScheduleId}
          company={selectedCompany}
          onClose={() => setSelectedScheduleId(null)}
        />
      )}
    </>
  );
}
