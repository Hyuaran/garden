"use client";

import { useState } from "react";
import { Modal } from "../../_components/Modal";
import { Button } from "../../_components/Button";
import { colors } from "../../_constants/colors";
import { useRootState } from "../../_state/RootStateContext";
import { rerunSync } from "../../_actions/kot-sync-rerun";
import type { RootKotSyncLog, KotSyncStatus, KotSyncType } from "../../_types/kot-sync-log";

const SYNC_TYPE_LABEL: Record<KotSyncType, string> = {
  masters: "マスタ",
  monthly_attendance: "月次勤怠",
  daily_attendance: "日次勤怠",
};

const STATUS_LABEL: Record<KotSyncStatus, string> = {
  running: "実行中",
  success: "成功",
  partial: "部分成功",
  failure: "失敗",
};

/** 非技術者向けに、よくあるエラーコードを日本語補足に変換 */
function friendlyErrorHint(code: string | null): string | null {
  if (!code) return null;
  if (code === "UNAUTHORIZED" || code === "111" || code === "100") {
    return "KoT の認証トークンが期限切れ・失効、または許可 IP 設定の問題です。管理者にトークンと IP 許可を確認してもらってください。";
  }
  if (code === "RATE_LIMITED" || code === "105" || code === "303" || code === "308") {
    return "KoT API のレート制限に達しました。時間を置いて再試行してください。";
  }
  if (code === "NETWORK_ERROR") return "KoT API ホストへの通信に失敗しました。ネットワーク・DNS を確認してください。";
  if (code === "SERVER_ERROR") return "KoT 側が一時的に障害中の可能性。時間を置いて再試行してください。";
  if (code === "ALL_UPSERT_FAILED") return "Garden 側への保存（upsert）が全件失敗しました。RLS ポリシーや権限を確認してください。";
  if (code === "SUPABASE_ERROR") return "Garden 従業員マスタ取得時のエラーです。Supabase 側の問題が疑われます。";
  return null;
}

function formatJst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ja-JP", { hour12: false });
}

export function SyncLogDetailModal({
  log,
  onClose,
  onRerunCompleted,
}: {
  log: RootKotSyncLog | null;
  onClose: () => void;
  onRerunCompleted: () => void;
}) {
  const { canWrite, rootUser } = useRootState();
  const [rerunning, setRerunning] = useState(false);
  const [rerunMessage, setRerunMessage] = useState<{ ok: boolean; message: string } | null>(null);

  if (!log) {
    return <Modal open={false} onClose={onClose} title="" width={720}>{null}</Modal>;
  }

  const hint = friendlyErrorHint(log.error_code);
  const canRerun = canWrite && (log.status === "failure" || log.status === "partial") && log.sync_type === "monthly_attendance";

  async function handleRerun() {
    if (!log) return;
    setRerunning(true);
    setRerunMessage(null);
    try {
      const r = await rerunSync(log.id, rootUser?.user_id ?? "rerun");
      if (r.ok) {
        setRerunMessage({ ok: true, message: r.message });
        onRerunCompleted();
      } else {
        setRerunMessage({ ok: false, message: `${r.error_code}: ${r.message}` });
      }
    } catch (e) {
      setRerunMessage({ ok: false, message: (e as Error).message });
    } finally {
      setRerunning(false);
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`同期ログ詳細 (${SYNC_TYPE_LABEL[log.sync_type] ?? log.sync_type} / ${STATUS_LABEL[log.status] ?? log.status})`} width={800}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 8, columnGap: 12, fontSize: 13 }}>
        <Field label="ID" value={log.id} mono />
        <Field label="種別" value={SYNC_TYPE_LABEL[log.sync_type] ?? log.sync_type} />
        <Field label="対象" value={log.sync_target ?? "—"} />
        <Field label="起動者" value={log.triggered_by} mono />
        <Field label="ステータス" value={STATUS_LABEL[log.status] ?? log.status} />
        <Field label="起動日時" value={formatJst(log.triggered_at)} mono />
        <Field label="開始日時" value={formatJst(log.started_at)} mono />
        <Field label="完了日時" value={formatJst(log.completed_at)} mono />
        <Field label="処理時間" value={log.duration_ms !== null ? `${log.duration_ms} ms` : "—"} mono />

        <Field label="取得件数" value={String(log.records_fetched ?? 0)} />
        <Field label="追加件数" value={String(log.records_inserted ?? 0)} />
        <Field label="更新件数" value={String(log.records_updated ?? 0)} />
        <Field label="スキップ件数" value={String(log.records_skipped ?? 0)} />
      </div>

      {log.error_code && (
        <div style={{ background: colors.dangerBg, border: `1px solid ${colors.danger}`, borderRadius: 6, padding: 12, marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.danger, marginBottom: 4 }}>
            エラーコード: <span style={{ fontFamily: "ui-monospace, monospace" }}>{log.error_code}</span>
          </div>
          {log.error_message && (
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", color: colors.text }}>
              {log.error_message}
            </pre>
          )}
          {hint && (
            <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 4, padding: 8, marginTop: 8, fontSize: 12, color: colors.text }}>
              💡 <strong>このエラーの対処</strong>：{hint}
            </div>
          )}
          {log.error_stack && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, cursor: "pointer", color: colors.textMuted }}>スタックトレース（開発者向け）</summary>
              <pre style={{ margin: "4px 0 0 0", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 240, overflow: "auto", color: colors.textMuted }}>
                {log.error_stack}
              </pre>
            </details>
          )}
        </div>
      )}

      {rerunMessage && (
        <div style={{
          background: rerunMessage.ok ? colors.successBg : colors.dangerBg,
          color: rerunMessage.ok ? colors.success : colors.danger,
          padding: "8px 12px",
          borderRadius: 4,
          marginTop: 12,
          fontSize: 13,
        }}>
          {rerunMessage.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
        <Button variant="secondary" onClick={onClose}>閉じる</Button>
        {canRerun && (
          <Button variant="primary" onClick={handleRerun} disabled={rerunning}>
            {rerunning ? "再実行中..." : "再実行（プレビュー起票）"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <div style={{ fontSize: 12, color: colors.textMuted }}>{label}</div>
      <div style={{ fontSize: 13, color: colors.text, fontFamily: mono ? "ui-monospace, monospace" : undefined, wordBreak: "break-all" }}>{value}</div>
    </>
  );
}
