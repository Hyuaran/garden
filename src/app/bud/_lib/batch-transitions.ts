import type { TransferStatus } from "../_constants/types";
import type { TransitionErrorCode } from "./transition-validator";

export const BATCH_MAX_COUNT = 100;

export interface BatchTransitionResult {
  succeeded: string[];
  failed: Array<{ transferId: string; error: string; code: TransitionErrorCode }>;
}

export function validateBatchSize(
  transferIds: string[],
): { ok: true } | { ok: false; message: string } {
  if (transferIds.length === 0) {
    return { ok: false, message: "対象が選択されていません" };
  }
  if (transferIds.length > BATCH_MAX_COUNT) {
    return {
      ok: false,
      message: `一括操作は ${BATCH_MAX_COUNT} 件までです（選択中 ${transferIds.length} 件）`,
    };
  }
  const seen = new Set<string>();
  for (const id of transferIds) {
    if (seen.has(id)) {
      return { ok: false, message: `重複する対象 ID が含まれています: ${id}` };
    }
    seen.add(id);
  }
  return { ok: true };
}

export function filterIdsByStatus(
  rows: Array<{ transfer_id: string; status: TransferStatus }>,
  expectedStatus: TransferStatus,
): {
  matching: string[];
  mismatch: Array<{ transferId: string; actualStatus: TransferStatus }>;
} {
  const matching: string[] = [];
  const mismatch: Array<{ transferId: string; actualStatus: TransferStatus }> = [];
  for (const row of rows) {
    if (row.status === expectedStatus) {
      matching.push(row.transfer_id);
    } else {
      mismatch.push({ transferId: row.transfer_id, actualStatus: row.status });
    }
  }
  return { matching, mismatch };
}

export function summarizeBatchResult(result: BatchTransitionResult): string {
  const total = result.succeeded.length + result.failed.length;
  if (result.failed.length === 0) {
    return `${total} 件すべて成功しました`;
  }
  if (result.succeeded.length === 0) {
    return `${total} 件すべて失敗しました`;
  }
  return `${result.succeeded.length} 件成功、${result.failed.length} 件失敗`;
}
