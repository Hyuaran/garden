export const SHINEIGYO_INGEST_BATCH_LIMIT = 1000;

export type ShineigyoIngestRow = Record<string, unknown>;
export type ShineigyoPayload = {
  "主キー": string;
  "電話番号": string | null;
  "携帯番号": string | null;
  "リスト名": string | null;
  "営業ID": string | null;
  "受注日": string | null;
  "既契約情報": string | null;
  "既契約回線タイプ": string | null;
  "既契約継続有無": string | null;
  "修正日": string | null;
  run_id: string;
  "取込日時": string;
};

export type RejectedShineigyoRow = { index: number; code: string; message: string };
export type ShineigyoIngestMetadata = { runId: string; batchIndex: number };

export class ShineigyoIngestValidationError extends Error {
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

export function normalizeShineigyoPhone(value: unknown) {
  const normalized = text(value)?.normalize("NFKC");
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  return digits || null;
}

function dateOnly(value: unknown) {
  const normalized = text(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) return null;
  return match[1];
}

export function mapFileMakerShineigyoRow(row: ShineigyoIngestRow, runId: string, importedAt: string): ShineigyoPayload {
  const primaryKey = decimalId(row["主キー"]);
  if (!primaryKey) throw new ShineigyoIngestValidationError("INVALID_PRIMARY_KEY", "主キーが有効なDECIMALではありません");
  const orderDate = dateOnly(row["受注日"]);
  if (text(row["受注日"]) && !orderDate) throw new ShineigyoIngestValidationError("INVALID_ORDER_DATE", "受注日がYYYY-MM-DD形式ではありません");
  return {
    "主キー": primaryKey,
    "電話番号": normalizeShineigyoPhone(row["電話番号_ハイフンなし"]),
    "携帯番号": normalizeShineigyoPhone(row["携帯番号_ハイフンなし"]),
    "リスト名": text(row["リスト名"]),
    "営業ID": decimalId(row["営業ID"]) ?? text(row["営業ID"]),
    "受注日": orderDate,
    "既契約情報": text(row["既契約情報"]),
    "既契約回線タイプ": text(row["既契約回線タイプ"]),
    "既契約継続有無": text(row["既契約継続有無"]),
    "修正日": text(row["修正日"]),
    run_id: runId,
    "取込日時": importedAt,
  };
}

function bodyText(body: Record<string, unknown>, camel: string, snake: string) {
  return text(body[camel] ?? body[snake]);
}

function bodyNumber(body: Record<string, unknown>, camel: string, snake: string) {
  return body[camel] ?? body[snake];
}

export function parseShineigyoIngestBody(value: unknown, importedAt = new Date().toISOString()) {
  if (!value || typeof value !== "object") throw new ShineigyoIngestValidationError("INVALID_REQUEST", "JSON object is required");
  const body = value as Record<string, unknown>;
  const runId = bodyText(body, "runId", "run_id");
  if (!runId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    throw new ShineigyoIngestValidationError("INVALID_REQUEST", "runId must be a UUID");
  }
  const batchIndex = bodyNumber(body, "batchIndex", "batch_index");
  if (!Number.isInteger(batchIndex) || Number(batchIndex) < 0) {
    throw new ShineigyoIngestValidationError("INVALID_REQUEST", "batchIndex must be a non-negative integer");
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > SHINEIGYO_INGEST_BATCH_LIMIT) {
    throw new ShineigyoIngestValidationError("INVALID_REQUEST", `rows must contain 1-${SHINEIGYO_INGEST_BATCH_LIMIT} items`);
  }

  const valid: ShineigyoPayload[] = [];
  const rejected: RejectedShineigyoRow[] = [];
  const batchIds = new Set<string>();
  body.rows.forEach((raw, index) => {
    try {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ShineigyoIngestValidationError("INVALID_ROW", "行はJSON objectである必要があります");
      const mapped = mapFileMakerShineigyoRow(raw as ShineigyoIngestRow, runId, importedAt);
      if (batchIds.has(mapped["主キー"])) throw new ShineigyoIngestValidationError("DUPLICATE_PRIMARY_KEY", "同一バッチ内で主キーが重複しています");
      batchIds.add(mapped["主キー"]);
      valid.push(mapped);
    } catch (error) {
      rejected.push({
        index,
        code: error instanceof ShineigyoIngestValidationError ? error.code : "INVALID_ROW",
        message: error instanceof Error ? error.message : "行を検証できません",
      });
    }
  });

  return { metadata: { runId, batchIndex: Number(batchIndex) }, valid, rejected, fetched: body.rows.length };
}

export function parseShineigyoCompleteBody(value: unknown): { runId: string; total: number } {
  if (!value || typeof value !== "object") throw new ShineigyoIngestValidationError("INVALID_REQUEST", "JSON object is required");
  const body = value as Record<string, unknown>;
  const runId = bodyText(body, "runId", "run_id");
  if (!runId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    throw new ShineigyoIngestValidationError("INVALID_REQUEST", "runId must be a UUID");
  }
  if (!Number.isInteger(body.total) || Number(body.total) < 0) {
    throw new ShineigyoIngestValidationError("INVALID_REQUEST", "total must be a non-negative integer");
  }
  return { runId, total: Number(body.total) };
}
