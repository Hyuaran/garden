"use client";

import { DataTable, type Column } from "../../_components/DataTable";
import { StatusBadge } from "../../_components/StatusBadge";
import { colors } from "../../_constants/colors";
import type { RootKotSyncLog, KotSyncStatus, KotSyncType } from "../../_types/kot-sync-log";

const SYNC_TYPE_LABEL: Record<KotSyncType, string> = {
  masters: "マスタ",
  monthly_attendance: "月次",
  daily_attendance: "日次",
};

const STATUS_COLOR: Record<KotSyncStatus, { bg: string; fg: string; label: string }> = {
  running:  { bg: colors.infoBg,    fg: colors.info,    label: "実行中" },
  success:  { bg: colors.successBg, fg: colors.success, label: "成功" },
  partial:  { bg: colors.warningBg, fg: colors.warning, label: "部分成功" },
  failure:  { bg: colors.dangerBg,  fg: colors.danger,  label: "失敗" },
};

/** ISO 文字列 → JST YYYY/MM/DD HH:mm:ss */
function formatJst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}:${ss}`;
}

/** 分数 or ms → 人間可読な duration（"1.2s" / "12m 34s" / "—"） */
function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

/** triggered_by が uuid っぽいかどうかをざっくり判定（'cron' は除外） */
function formatTriggeredBy(v: string): string {
  if (v === "cron") return "cron";
  if (v === "rerun") return "再実行";
  if (v === "unknown") return "不明";
  // user_id（uuid）は先頭 8 文字だけ表示（プライバシー配慮）
  if (/^[0-9a-f-]{32,}$/i.test(v)) return `user:${v.slice(0, 8)}…`;
  return v;
}

export function SyncHistoryTable({
  logs,
  onRowClick,
}: {
  logs: RootKotSyncLog[];
  onRowClick: (log: RootKotSyncLog) => void;
}) {
  const columns: Column<RootKotSyncLog>[] = [
    { key: "triggered_at", header: "実行日時", width: 160,
      render: (r) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{formatJst(r.triggered_at)}</span> },
    { key: "sync_type", header: "種別", width: 90,
      render: (r) => SYNC_TYPE_LABEL[r.sync_type] ?? r.sync_type },
    { key: "sync_target", header: "対象", width: 110,
      render: (r) => r.sync_target ?? "—" },
    { key: "triggered_by", header: "起動者", width: 140,
      render: (r) => (
        <span style={{
          padding: "2px 8px",
          borderRadius: 3,
          fontSize: 11,
          background: r.triggered_by === "cron" ? colors.infoBg : colors.bg,
          color: r.triggered_by === "cron" ? colors.info : colors.textMuted,
        }}>
          {formatTriggeredBy(r.triggered_by)}
        </span>
      ) },
    { key: "status", header: "状態", width: 90, align: "center",
      render: (r) => {
        const s = STATUS_COLOR[r.status];
        return (
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 600,
            background: s.bg,
            color: s.fg,
          }}>
            {s.label}
          </span>
        );
      } },
    { key: "duration", header: "処理時間", width: 90, align: "right",
      render: (r) => <span style={{ fontFamily: "ui-monospace, monospace", color: colors.textMuted }}>{formatDuration(r.duration_ms)}</span> },
    { key: "records_fetched", header: "取得", width: 60, align: "right",
      render: (r) => r.records_fetched ?? 0 },
    { key: "records_inserted", header: "追加", width: 60, align: "right",
      render: (r) => r.records_inserted ?? 0 },
    { key: "records_updated", header: "更新", width: 60, align: "right",
      render: (r) => r.records_updated ?? 0 },
    { key: "records_skipped", header: "スキップ", width: 76, align: "right",
      render: (r) => r.records_skipped ?? 0 },
    { key: "actions", header: "", width: 90, align: "right",
      render: (r) => (
        <span style={{ color: colors.textMuted, fontSize: 11 }}>
          {(r.status === "failure" || r.status === "partial") ? "再実行 →" : "詳細 →"}
        </span>
      ) },
  ];

  // StatusBadge は is_active boolean 用なので、独自 badge を columns 内で描画した。
  // StatusBadge export は互換のため参照だけ保持（lint 警告回避）
  void StatusBadge;

  return (
    <DataTable
      columns={columns}
      rows={logs}
      emptyMessage="履歴がありません（fetch フィルタに該当する KoT 同期ログが無し）"
      onRowClick={onRowClick}
    />
  );
}
