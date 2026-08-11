export const CALL_INGEST_BATCH_LIMIT = 500;
export const CALL_INGEST_SOURCE = "callcenter-fm-agent";

const AUDIT_FIELDS = [
  "DATA0", "DATA1", "無効コール件数", "無効件数", "d_結果フラグ", "コール数",
  "トス", "獲得", "無効", "留守", "担当不在", "見込み", "有効",
  "s_コール数", "s_トス", "s_獲得", "s_無効", "s_留守", "s_担当不在", "s_見込み", "s_有効",
  "コール時間MAX", "コール時間MIN", "現在稼働時間", "一時間毎のコール数",
] as const;

export type CallIngestRow = Record<string, unknown>;
export type CallHistoryPayload = {
  source: typeof CALL_INGEST_SOURCE;
  external_call_id: string;
  fm_created_at_raw: string | null;
  fm_created_by: string | null;
  fm_modified_at_raw: string | null;
  fm_modified_by: string | null;
  employee_name: string | null;
  call_date: string;
  call_time: string | null;
  relationship: string | null;
  result_flag: string | null;
  note: string | null;
  external_call_code: string | null;
  phone_number: string | null;
  employee_id_raw: string | null;
  external_sales_id: string | null;
  sales_count: string | null;
  call_ended_time: string | null;
  list_name: string | null;
  previous_list_name: string | null;
  fm_aggregate_raw: Record<string, unknown>;
  imported_at: string;
};

export type RejectedCallRow = { index: number; code: string; message: string };
export type CallIngestMetadata = {
  runId: string;
  batchIndex: number;
  rangeFrom: string | null;
  rangeTo: string | null;
};

export class CallIngestValidationError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

const text = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

function decimalId(value: unknown) {
  const normalized = text(value);
  if (!normalized || !/^\d+(?:\.0+)?$/.test(normalized)) return null;
  return normalized.replace(/\.0+$/, "");
}

function dateOnly(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) return null;
  return match[1];
}

function timeOnly(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  const match = normalized.match(/(?:T|^)(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)/);
  return match?.[1] ?? null;
}

function auditValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function mapFileMakerCallRow(row: CallIngestRow, importedAt: string): CallHistoryPayload {
  const externalCallId = decimalId(row["主キー"]);
  if (!externalCallId) throw new CallIngestValidationError("INVALID_EXTERNAL_CALL_ID", "主キーが有効なDECIMALではありません");
  const callDate = dateOnly(row["コール日"]);
  if (!callDate) throw new CallIngestValidationError("INVALID_CALL_DATE", "コール日がYYYY-MM-DD形式ではありません");
  const aggregateRaw = Object.fromEntries(AUDIT_FIELDS.map((key) => [key, auditValue(row[key])]));
  return {
    source: CALL_INGEST_SOURCE,
    external_call_id: externalCallId,
    fm_created_at_raw: text(row["作成日"]), fm_created_by: text(row["作成者"]),
    fm_modified_at_raw: text(row["修正日"]), fm_modified_by: text(row["修正者"]),
    employee_name: text(row["社員名"]), call_date: callDate, call_time: timeOnly(row["コール時間"]),
    relationship: text(row["続柄"]), result_flag: text(row["結果フラグ"]), note: text(row["備考"]),
    external_call_code: text(row["コールID"]), phone_number: text(row["電話番号"]),
    employee_id_raw: text(row["社員ID"]), external_sales_id: decimalId(row["営業ID"]),
    sales_count: text(row["営業回数"]), call_ended_time: timeOnly(row["コール終了時間"]),
    list_name: text(row["新リスト名"]), previous_list_name: text(row["旧リスト名"]),
    fm_aggregate_raw: aggregateRaw, imported_at: importedAt,
  };
}

function optionalDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = dateOnly(value);
  if (!normalized) throw new CallIngestValidationError("INVALID_REQUEST", `${field} must be YYYY-MM-DD`);
  return normalized;
}

export function parseCallIngestBody(value: unknown, importedAt = new Date().toISOString()) {
  if (!value || typeof value !== "object") throw new CallIngestValidationError("INVALID_REQUEST", "JSON object is required");
  const body = value as Record<string, unknown>;
  const runId = text(body.run_id);
  if (!runId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    throw new CallIngestValidationError("INVALID_REQUEST", "run_id must be a UUID");
  }
  if (!Number.isInteger(body.batch_index) || Number(body.batch_index) < 0) {
    throw new CallIngestValidationError("INVALID_REQUEST", "batch_index must be a non-negative integer");
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > CALL_INGEST_BATCH_LIMIT) {
    throw new CallIngestValidationError("INVALID_REQUEST", `rows must contain 1-${CALL_INGEST_BATCH_LIMIT} items`);
  }
  const valid: CallHistoryPayload[] = [];
  const rejected: RejectedCallRow[] = [];
  const batchIds = new Set<string>();
  body.rows.forEach((raw, index) => {
    try {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CallIngestValidationError("INVALID_ROW", "行はJSON objectである必要があります");
      const mapped = mapFileMakerCallRow(raw as CallIngestRow, importedAt);
      if (batchIds.has(mapped.external_call_id)) throw new CallIngestValidationError("DUPLICATE_EXTERNAL_CALL_ID", "同一バッチ内で主キーが重複しています");
      batchIds.add(mapped.external_call_id);
      valid.push(mapped);
    } catch (error) {
      rejected.push({
        index,
        code: error instanceof CallIngestValidationError ? error.code : "INVALID_ROW",
        message: error instanceof Error ? error.message : "行を検証できません",
      });
    }
  });
  const metadata: CallIngestMetadata = {
    runId, batchIndex: Number(body.batch_index),
    rangeFrom: optionalDate(body.range_from, "range_from"), rangeTo: optionalDate(body.range_to, "range_to"),
  };
  return { metadata, valid, rejected, fetched: body.rows.length };
}
