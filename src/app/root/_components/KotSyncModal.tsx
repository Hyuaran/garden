"use client";

import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { colors } from "../_constants/colors";
import { previewKotMonthlySync, commitKotSyncResult, commitKotSyncFailure } from "../_actions/kot-sync";
import type { KotSyncPreviewResult, KotSyncPreviewRow } from "../_types/kot";
import { upsertAttendance } from "../_lib/queries";
import { writeAudit } from "../_lib/audit";
import { useRootState } from "../_state/RootStateContext";
import { sanitizeUpsertPayload, NULLABLE_DATE_KEYS } from "../_lib/sanitize-payload";
import type { Attendance } from "../_constants/types";

type Stage = "idle" | "fetching" | "preview" | "error" | "importing" | "done";

function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * KoT プレビュー行を root_attendance の upsert payload に変換。
 *
 * timestamptz 列の安全性は `sanitizeUpsertPayload` に委譲（Phase A-3-f 以降、7 マスタ共通化）。
 * - created_at / updated_at は helper が自動除外 → Postgres DEFAULT / trigger に任せる
 * - imported_at は nullable、明示的に現在時刻を入れる
 */
function toAttendanceRow(
  r: KotSyncPreviewRow,
  employee_id: string,
): Partial<Attendance> & { attendance_id: string } {
  const attendance_id = `ATT-${r.values!.target_month}-${employee_id.replace("EMP-", "")}`;
  const raw: Attendance = {
    attendance_id,
    employee_id,
    target_month: r.values!.target_month,
    working_days: r.values!.working_days,
    absence_days: r.values!.absence_days,
    paid_leave_days: r.values!.paid_leave_days,
    scheduled_hours: r.values!.scheduled_hours,
    actual_hours: r.values!.actual_hours,
    overtime_hours: r.values!.overtime_hours,
    legal_overtime_hours: r.values!.legal_overtime_hours,
    night_hours: r.values!.night_hours,
    holiday_hours: r.values!.holiday_hours,
    late_hours: r.values!.late_hours,
    early_leave_hours: r.values!.early_leave_hours,
    training_hours: null,
    office_hours: null,
    imported_at: new Date().toISOString(),
    import_status: "取込済",
    kot_record_id: r.kot_record_id,
    created_at: "",
    updated_at: "",
  };
  return sanitizeUpsertPayload(raw, {
    nullableDateKeys: NULLABLE_DATE_KEYS.attendance,
  }) as Partial<Attendance> & { attendance_id: string };
}

export function KotSyncModal({
  open,
  onClose,
  onCompleted,
  defaultMonth,
}: {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
  defaultMonth?: string;
}) {
  const { canWrite, rootUser } = useRootState();
  const [targetMonth, setTargetMonth] = useState<string>(defaultMonth ?? lastMonth());
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<KotSyncPreviewResult | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importedCount, setImportedCount] = useState<number>(0);

  const resolvable = useMemo(() => {
    if (!preview || !preview.ok) return [];
    return preview.rows.filter((r) => r.resolution.kind !== "unresolved" && r.values);
  }, [preview]);
  const unresolvable = useMemo(() => {
    if (!preview || !preview.ok) return [];
    return preview.rows.filter((r) => r.resolution.kind === "unresolved");
  }, [preview]);
  const warnings = useMemo(() => {
    if (!preview || !preview.ok) return [];
    return preview.rows.filter((r) => r.resolution.kind === "warning");
  }, [preview]);

  function reset() {
    setStage("idle");
    setPreview(null);
    setImportErrors([]);
    setImportedCount(0);
  }

  async function handleFetch() {
    setStage("fetching");
    const r = await previewKotMonthlySync(targetMonth, rootUser?.user_id ?? undefined);
    setPreview(r);
    setStage(r.ok ? "preview" : "error");
  }

  async function handleImport() {
    if (!preview || !preview.ok || !canWrite) return;
    setStage("importing");
    setImportErrors([]);
    setImportedCount(0);
    const errs: Array<{ row: number; message: string }> = [];
    let ok = 0;
    for (const r of resolvable) {
      if (r.resolution.kind === "unresolved") continue;
      const employee_id = r.resolution.employee_id;
      const row = toAttendanceRow(r, employee_id);
      try {
        await upsertAttendance(row);
        ok++;
      } catch (e) {
        errs.push({ row: r.index, message: (e as Error).message });
      }
    }

    // 既存 audit（master_update）はそのまま残す。監査とシステム履歴の二層構造。
    await writeAudit({
      action: "master_update",
      actorUserId: rootUser?.user_id ?? null,
      actorEmpNum: rootUser?.employee_number ?? null,
      targetType: "root_attendance",
      targetId: `kot-sync:${targetMonth}`,
      payload: {
        source: "kot_api",
        target_month: targetMonth,
        imported: ok,
        unresolvable: unresolvable.length,
        warnings: warnings.length,
        upsert_errors: errs.length,
      },
    });

    // Phase A-3-a: root_kot_sync_log へ最終結果を書き戻す（log_id が取れていれば）
    if (preview.log_id) {
      if (ok === 0 && errs.length > 0) {
        await commitKotSyncFailure(preview.log_id, {
          error_code: "ALL_UPSERT_FAILED",
          error_message: `全 ${errs.length} 行 upsert 失敗: ${errs[0]?.message ?? "(詳細なし)"}`,
          records_fetched: preview.rows.length,
        });
      } else {
        await commitKotSyncResult(preview.log_id, {
          records_fetched: preview.rows.length,
          // records_inserted/updated は upsert では区別付きにくいため、成功数を inserted に寄せる
          // （A-3-b UI では合計値だけ参照するので実害なし。より厳密に分けるなら RPC 化）
          records_inserted: ok,
          records_updated: 0,
          records_skipped: unresolvable.length + warnings.length,
          upsert_errors: errs.length,
        });
      }
    }

    setImportedCount(ok);
    setImportErrors(errs);
    setStage("done");
    if (ok > 0) onCompleted();
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="KING OF TIME から月次勤怠を取込" width={960}>
      {/* idle: 月選択 */}
      {stage === "idle" && (
        <div>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 12px 0" }}>
            KoT から月別勤怠を取得し、プレビュー → 確認 → `root_attendance` に一括 upsert します。
            取得対象は KoT /employees と /monthly-workings です。既存のデータは上書きされます（冪等）。
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: colors.textMuted }}>対象月（YYYY-MM）</label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}
            />
          </div>
          {!canWrite && <div style={{ background: colors.warningBg, color: colors.warning, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12 }}>取込には編集権限（管理者以上）が必要です</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            <Button variant="secondary" onClick={close}>キャンセル</Button>
            <Button variant="primary" onClick={handleFetch} disabled={!canWrite}>KoT から取得してプレビュー</Button>
          </div>
        </div>
      )}

      {stage === "fetching" && <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>KoT API 呼出中…（従業員一覧 + 月別勤怠）</div>}

      {stage === "error" && preview && !preview.ok && (
        <div>
          <div style={{ background: colors.dangerBg, color: colors.danger, padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>KoT API エラー（{preview.error_code}）</div>
            <div>{preview.message}</div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            <Button variant="secondary" onClick={close}>閉じる</Button>
            <Button variant="primary" onClick={handleFetch}>再試行</Button>
          </div>
        </div>
      )}

      {stage === "preview" && preview && preview.ok && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            <SummaryCard label="対象月" value={preview.target_month} />
            <SummaryCard label="取込可能" value={`${resolvable.length} 行`} tone={resolvable.length > 0 ? "success" : "muted"} />
            <SummaryCard label="警告（退職者等）" value={`${warnings.length} 行`} tone={warnings.length > 0 ? "warning" : "muted"} />
            <SummaryCard label="未解決（スキップ）" value={`${unresolvable.length} 行`} tone={unresolvable.length > 0 ? "danger" : "muted"} />
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: colors.bg }}>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th style={cellTH}>#</th>
                  <th style={cellTH}>KoT code</th>
                  <th style={cellTH}>氏名</th>
                  <th style={{ ...cellTH, textAlign: "right" }}>出勤</th>
                  <th style={{ ...cellTH, textAlign: "right" }}>実労働</th>
                  <th style={{ ...cellTH, textAlign: "right" }}>所定外</th>
                  <th style={{ ...cellTH, textAlign: "right" }}>深夜</th>
                  <th style={cellTH}>状態</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const bg =
                    r.resolution.kind === "unresolved" ? colors.dangerBg :
                    r.resolution.kind === "warning" ? colors.warningBg : undefined;
                  const name =
                    r.resolution.kind === "resolved" || r.resolution.kind === "warning"
                      ? r.resolution.employee_name : "—";
                  return (
                    <tr key={r.index} style={{ borderBottom: `1px solid ${colors.border}`, background: bg }}>
                      <td style={cellTD}>{r.index}</td>
                      <td style={cellTD}>{r.employee_code ?? "—"}</td>
                      <td style={cellTD}>{name}</td>
                      <td style={{ ...cellTD, textAlign: "right" }}>{r.values?.working_days ?? "—"}日</td>
                      <td style={{ ...cellTD, textAlign: "right" }}>{r.values?.actual_hours ?? "—"}h</td>
                      <td style={{ ...cellTD, textAlign: "right" }}>{r.values?.overtime_hours ?? "—"}h</td>
                      <td style={{ ...cellTD, textAlign: "right" }}>{r.values?.night_hours ?? "—"}h</td>
                      <td style={cellTD}>
                        {r.resolution.kind === "unresolved" && <span style={{ color: colors.danger }}>未解決: {r.resolution.reason}</span>}
                        {r.resolution.kind === "warning" && <span style={{ color: colors.warning }}>警告: {r.resolution.reason}</span>}
                        {r.resolution.kind === "resolved" && <span style={{ color: colors.success }}>取込可</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            <Button variant="secondary" onClick={reset}>別の月を指定</Button>
            <Button variant="primary" onClick={handleImport} disabled={resolvable.length === 0 || !canWrite}>
              {resolvable.length} 行を取込（既存は上書き）
            </Button>
          </div>
        </div>
      )}

      {stage === "importing" && <div style={{ padding: 40, textAlign: "center", color: colors.textMuted }}>root_attendance へ upsert 中…</div>}

      {stage === "done" && (
        <div>
          <div style={{ background: colors.successBg, color: colors.success, padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
            取込完了：{importedCount} 行が upsert されました
          </div>
          {importErrors.length > 0 && (
            <details style={{ marginBottom: 12, background: colors.dangerBg, border: `1px solid ${colors.danger}`, borderRadius: 6, padding: 8 }}>
              <summary style={{ color: colors.danger, fontSize: 13, cursor: "pointer" }}>upsert エラー {importErrors.length} 件</summary>
              <ul style={{ fontSize: 12, margin: "8px 0 0 16px" }}>
                {importErrors.map((e, i) => <li key={i}>行 {e.row}: {e.message}</li>)}
              </ul>
            </details>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
            <Button variant="secondary" onClick={reset}>別の月を取込</Button>
            <Button variant="primary" onClick={close}>閉じる</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const cellTH: React.CSSProperties = { padding: "8px 10px", fontSize: 11, fontWeight: 600, color: colors.textMuted, textAlign: "left", whiteSpace: "nowrap" };
const cellTD: React.CSSProperties = { padding: "6px 10px", color: colors.text, verticalAlign: "middle" };

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" | "muted" }) {
  const toneColor = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.danger : colors.textMuted;
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 6, padding: "8px 10px", background: colors.bgPanel }}>
      <div style={{ fontSize: 11, color: colors.textMuted }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: toneColor, marginTop: 2 }}>{value}</div>
    </div>
  );
}
