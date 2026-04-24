"use client";

/**
 * Garden Root — KoT 同期履歴画面（Phase A-3-b）
 *
 * admin / super_admin 専用。manager 以下は RootGate で弾かれる（`canWrite=false`）。
 * 既存 Root モジュールが client-side Supabase auth を使う前提のため、本ページも
 * client component で統一（spec の「Server Component ベース」は現 Root 構造に
 * 未対応のため、実装上は client で妥協。後日 @supabase/ssr 導入時に再検討）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { fetchSyncLogs } from "../_lib/kot-sync-log";
import type {
  RootKotSyncLog,
  KotSyncStatus,
  KotSyncType,
} from "../_types/kot-sync-log";
import { SyncHistoryTable } from "./_components/SyncHistoryTable";
import { SyncLogDetailModal } from "./_components/SyncLogDetailModal";

const PAGE_SIZE = 50;

const SYNC_TYPE_LABEL: Record<KotSyncType, string> = {
  masters: "マスタ",
  monthly_attendance: "月次",
  daily_attendance: "日次",
};

const STATUS_LABEL: Record<KotSyncStatus, string> = {
  running: "実行中",
  success: "成功",
  partial: "部分成功",
  failure: "失敗",
};

export default function KotSyncHistoryPage() {
  const { canWrite, loading: authLoading } = useRootState();
  const [logs, setLogs] = useState<RootKotSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<KotSyncType | "">("");
  const [filterStatus, setFilterStatus] = useState<KotSyncStatus | "">("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<RootKotSyncLog | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSyncLogs({
        sync_type: filterType || null,
        status: filterStatus || null,
        from: filterFrom || null,
        to: filterTo || null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterFrom, filterTo, page]);

  useEffect(() => {
    if (authLoading) return;
    if (!canWrite) return; // manager 以下は fetch しない（RootGate 側でリダイレクト想定）
    void load();
  }, [authLoading, canWrite, load]);

  // 5 分超の running ステータスがあるかどうか（警告表示用）
  const staleRunning = useMemo(() => {
    const now = Date.now();
    const THRESHOLD_MS = 5 * 60 * 1000;
    return logs.filter(
      (l) => l.status === "running" && now - new Date(l.triggered_at).getTime() > THRESHOLD_MS,
    );
  }, [logs]);

  // 自動 refetch（running が残っている場合のみ 30 秒ごと）
  const refetchTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const hasRunning = logs.some((l) => l.status === "running");
    if (refetchTimerRef.current) {
      window.clearInterval(refetchTimerRef.current);
      refetchTimerRef.current = null;
    }
    if (hasRunning) {
      refetchTimerRef.current = window.setInterval(() => void load(), 30_000);
    }
    return () => {
      if (refetchTimerRef.current) window.clearInterval(refetchTimerRef.current);
    };
  }, [logs, load]);

  const resetFilter = () => {
    setFilterType("");
    setFilterStatus("");
    setFilterFrom("");
    setFilterTo("");
    setPage(0);
  };

  if (!authLoading && !canWrite) {
    return (
      <>
        <PageHeader title="KoT 同期履歴" />
        <div style={{ background: colors.dangerBg, color: colors.danger, padding: 16, borderRadius: 6, fontSize: 14 }}>
          この画面は管理者（admin / super_admin）のみアクセス可能です。
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="KoT 同期履歴"
        description="KoT 連携（月次・日次・マスタ）の同期ログを閲覧・再実行。admin/super_admin 専用。"
        actions={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "読込中..." : "再読込"}
          </Button>
        }
      />

      {/* フィルタ */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <LabeledSelect label="種別" value={filterType} onChange={(v) => { setFilterType(v as KotSyncType | ""); setPage(0); }}>
          <option value="">すべて</option>
          {Object.entries(SYNC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </LabeledSelect>
        <LabeledSelect label="ステータス" value={filterStatus} onChange={(v) => { setFilterStatus(v as KotSyncStatus | ""); setPage(0); }}>
          <option value="">すべて</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </LabeledSelect>
        <LabeledInput label="from" type="date" value={filterFrom} onChange={(v) => { setFilterFrom(v); setPage(0); }} />
        <LabeledInput label="to" type="date" value={filterTo} onChange={(v) => { setFilterTo(v); setPage(0); }} />
        <Button variant="ghost" onClick={resetFilter}>リセット</Button>
      </div>

      {staleRunning.length > 0 && (
        <div style={{ background: colors.warningBg, color: colors.warning, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
          ⚠ 5 分以上「実行中」のまま滞留しているログが {staleRunning.length} 件あります。Server Action 途中終了 / クライアント upsert 未完了の可能性。
          詳細は行をクリックして確認し、必要に応じて再実行してください。
        </div>
      )}

      {error && (
        <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div>
      ) : (
        <>
          <SyncHistoryTable
            logs={logs}
            onRowClick={setSelectedLog}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            currentCount={logs.length}
            onChange={setPage}
          />
        </>
      )}

      <SyncLogDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onRerunCompleted={() => void load()}
      />
    </>
  );
}

// ------------------------------------------------------------
// 内部コンポーネント
// ------------------------------------------------------------

function LabeledSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: colors.textMuted }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13, minWidth: 140 }}>{children}</select>
    </label>
  );
}

function LabeledInput({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: colors.textMuted }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }} />
    </label>
  );
}

function Pagination({ page, pageSize, currentCount, onChange }: { page: number; pageSize: number; currentCount: number; onChange: (p: number) => void }) {
  const hasPrev = page > 0;
  const hasNext = currentCount >= pageSize; // 次ページに行がある可能性がある
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", marginTop: 12, fontSize: 13, color: colors.textMuted }}>
      <span>{page * pageSize + 1} – {page * pageSize + currentCount} 件</span>
      <Button variant="secondary" onClick={() => onChange(page - 1)} disabled={!hasPrev}>前へ</Button>
      <Button variant="secondary" onClick={() => onChange(page + 1)} disabled={!hasNext}>次へ</Button>
    </div>
  );
}
