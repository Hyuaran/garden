"use client";

/**
 * Garden-Leaf 関電業務委託 — ステータス進行バー（Phase A-2）
 *
 * 詳細モーダル内に配置。現在のステータスを「▶ 次へ進める」「◀ 戻す」で操作。
 *
 * ロジック（PoC v8 の advanceStatus を踏襲）:
 *   - 次へ進める: status を次に更新し、その dateField を today にセット
 *   - スキップ条件:
 *       awaiting_specs は specs_ready_on_submit=true なら自動スキップ
 *       awaiting_payout は is_direct_operation=true なら自動スキップ（直営案件）
 *   - 戻す: 1段前のステータスに戻し、現在ステータスの dateField をクリア
 *   - completed からは進めない / ordered からは戻せない
 */

import { useState } from "react";
import { colors } from "../../_constants/colors";
import { updateCaseStatus } from "../../_lib/queries";
import type { KandenCase, KandenStatus } from "../../_lib/types";
import { STATUS_FLOW } from "../../_lib/types";

interface Props {
  c: KandenCase;
  onUpdated: (updated: KandenCase) => void;
}

/** 現在のステータス → 次のステータス（スキップ考慮） */
function getNextStatus(current: KandenStatus, c: KandenCase): KandenStatus | null {
  const idx = STATUS_FLOW.findIndex((s) => s.key === current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  let nextIdx = idx + 1;
  // 諸元が最初から揃っていれば「諸元待ち」をスキップ
  if (STATUS_FLOW[nextIdx].key === "awaiting_specs" && c.specs_ready_on_submit) {
    nextIdx++;
  }
  // 直営案件なら「支払待ち」をスキップ（会社から別途支払いがない）
  if (STATUS_FLOW[nextIdx]?.key === "awaiting_payout" && c.is_direct_operation) {
    nextIdx++;
  }
  if (nextIdx >= STATUS_FLOW.length) nextIdx = STATUS_FLOW.length - 1;
  return STATUS_FLOW[nextIdx].key;
}

/** 現在のステータス → 前のステータス（スキップ考慮） */
function getPrevStatus(current: KandenStatus, c: KandenCase): KandenStatus | null {
  const idx = STATUS_FLOW.findIndex((s) => s.key === current);
  if (idx <= 0) return null;
  let prevIdx = idx - 1;
  if (STATUS_FLOW[prevIdx].key === "awaiting_specs" && c.specs_ready_on_submit) {
    prevIdx--;
  }
  if (STATUS_FLOW[prevIdx]?.key === "awaiting_payout" && c.is_direct_operation) {
    prevIdx--;
  }
  if (prevIdx < 0) prevIdx = 0;
  return STATUS_FLOW[prevIdx].key;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StatusAdvanceBar({ c, onUpdated }: Props) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = getNextStatus(c.status, c);
  const prevStatus = getPrevStatus(c.status, c);
  const nextLabel = nextStatus ? STATUS_FLOW.find((s) => s.key === nextStatus)?.label : null;
  const prevLabel = prevStatus ? STATUS_FLOW.find((s) => s.key === prevStatus)?.label : null;
  const nextDateLabel = nextStatus
    ? STATUS_FLOW.find((s) => s.key === nextStatus)?.dateLabel
    : null;

  async function handleAdvance() {
    if (!nextStatus) return;
    setError(null);
    setProcessing(true);
    try {
      // 新ステータスの dateField が未セットなら today をセット
      const newSpec = STATUS_FLOW.find((s) => s.key === nextStatus)!;
      const patch: Partial<KandenCase> = { status: nextStatus };
      const dateField = newSpec.dateField;
      if (!c[dateField]) {
        (patch as Record<string, unknown>)[dateField] = todayStr();
      }
      const updated = await updateCaseStatus(c.case_id, patch);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRevert() {
    if (!prevStatus) return;
    if (!confirm(`ステータスを「${prevLabel}」に戻します。よろしいですか？\n現在ステータスの日付はクリアされます。`))
      return;
    setError(null);
    setProcessing(true);
    try {
      // 現在ステータスの dateField をクリア、status を前に戻す
      const curSpec = STATUS_FLOW.find((s) => s.key === c.status)!;
      const patch: Partial<KandenCase> = { status: prevStatus };
      (patch as Record<string, unknown>)[curSpec.dateField] = null;
      const updated = await updateCaseStatus(c.case_id, patch);
      onUpdated(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div
      style={{
        background: colors.accentLight,
        border: `1px solid ${colors.accent}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600 }}>
            ステータス操作
          </div>
          <div style={{ fontSize: 13, color: colors.text, marginTop: 2 }}>
            {nextStatus ? (
              <>
                次へ進めると{" "}
                <b style={{ color: colors.accent }}>{nextLabel}</b>
                {nextDateLabel && (
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>
                    （{nextDateLabel} を今日の日付で記録）
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: colors.textMuted }}>完了済み（これ以上進められません）</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {prevStatus && (
            <button
              onClick={handleRevert}
              disabled={processing}
              style={{
                padding: "7px 14px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: "#fff",
                color: colors.textMuted,
                fontSize: 12,
                cursor: processing ? "not-allowed" : "pointer",
              }}
              title={`${prevLabel} に戻す（現在ステータスの日付はクリア）`}
            >
              ◀ 戻す
            </button>
          )}
          {nextStatus && (
            <button
              onClick={handleAdvance}
              disabled={processing}
              style={{
                padding: "7px 18px",
                borderRadius: 6,
                border: "none",
                background: processing ? colors.textMuted : colors.accent,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: processing ? "not-allowed" : "pointer",
              }}
            >
              {processing ? "更新中..." : `▶ ${nextLabel} へ進める`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 8,
            background: colors.dangerBg,
            color: colors.danger,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
