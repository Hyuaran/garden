export type DbError = { message: string } | null;

export type UploadResult = {
  assignments: number;
  assignments_new: number;
  assignments_updated: number;
  parent_updated: number;
  parent_inserted: number;
  parent_kept: number;
  skipped: number;
  remaining: number;
  purchase_inserted: number;
  duplicate_rows?: number;
  warning?: string;
};

export type UploadApplyDb = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: UploadResult[] | UploadResult | null; error: DbError }>;
};

export const APPLY_UPLOAD_LIMIT = 1000;
export const APPLY_UPLOAD_MAX_ROUNDS = 60;

const EMPTY_RESULT: UploadResult = {
  assignments: 0,
  assignments_new: 0,
  assignments_updated: 0,
  parent_updated: 0,
  parent_inserted: 0,
  parent_kept: 0,
  skipped: 0,
  remaining: 0,
  purchase_inserted: 0,
};

export class UploadApplyError extends Error {
  constructor(
    message: string,
    public readonly result: UploadResult,
  ) {
    super(message);
  }
}

export function emptyUploadResult(overrides: Partial<UploadResult> = {}): UploadResult {
  return { ...EMPTY_RESULT, ...overrides };
}

export function normalizeApplyResult(data: UploadResult[] | UploadResult | null): UploadResult {
  const row = Array.isArray(data) ? data[0] : data;
  return emptyUploadResult({
    assignments: row?.assignments ?? 0,
    assignments_new: row?.assignments_new ?? 0,
    assignments_updated: row?.assignments_updated ?? 0,
    parent_updated: row?.parent_updated ?? 0,
    parent_inserted: row?.parent_inserted ?? 0,
    parent_kept: row?.parent_kept ?? 0,
    skipped: row?.skipped ?? 0,
    remaining: row?.remaining ?? 0,
    purchase_inserted: row?.purchase_inserted ?? 0,
  });
}

export function addUploadResults(left: UploadResult, right: UploadResult): UploadResult {
  return {
    assignments: left.assignments + right.assignments,
    assignments_new: left.assignments_new + right.assignments_new,
    assignments_updated: left.assignments_updated + right.assignments_updated,
    parent_updated: left.parent_updated + right.parent_updated,
    parent_inserted: left.parent_inserted + right.parent_inserted,
    parent_kept: left.parent_kept + right.parent_kept,
    skipped: left.skipped + right.skipped,
    remaining: right.remaining,
    purchase_inserted: left.purchase_inserted + right.purchase_inserted,
    duplicate_rows: left.duplicate_rows ?? right.duplicate_rows,
    warning: left.warning ?? right.warning,
  };
}

export function reflectedRows(result: UploadResult): number {
  return Math.max(0, result.assignments);
}

export function uploadStoppedMessage(result: UploadResult, totalRows: number): string {
  return `途中で止まりました（電話番号台帳へ反映 ${reflectedRows(result).toLocaleString("ja-JP")} / ${totalRows.toLocaleString("ja-JP")}）。記録から「反映をやり直す」を押してください`;
}

export async function applyUploadInBatches(
  db: UploadApplyDb,
  uploadId: string,
  initialResult: UploadResult = emptyUploadResult(),
): Promise<UploadResult> {
  let result = initialResult;
  for (let round = 0; round < APPLY_UPLOAD_MAX_ROUNDS; round += 1) {
    const { data, error } = await db.rpc("soil_list_apply_upload", { p_upload_id: uploadId, p_limit: APPLY_UPLOAD_LIMIT });
    if (error) throw new UploadApplyError(error.message, result);
    const current = normalizeApplyResult(data);
    result = addUploadResults(result, current);
    if (current.remaining <= 0) return result;
  }
  throw new UploadApplyError("反映が最大回数に達しました", result);
}
