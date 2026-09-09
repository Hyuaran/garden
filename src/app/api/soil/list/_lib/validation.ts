import {
  DEFAULT_EXPORT_LIMIT,
  MAX_EXPORT_LIMIT,
  SOIL_LIST_COLUMNS,
  SOIL_LIST_EXPORT_COLUMNS,
  SOIL_LIST_SORT_OPTIONS,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
  type SoilListOperator,
  type SoilListSortKey,
} from "@/app/system/list/_lib/list-fields";

const ALLOWED_OPERATORS: SoilListOperator[] = ["eq", "contains", "gte", "lte", "in", "inOrEmpty", "empty", "notEmpty"];
const MAX_MULTI_SELECT_VALUES = 100;

export class SoilListRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function isAllowedField(field: string): field is SoilListFilter["field"] {
  return field in SOIL_LIST_COLUMNS;
}

function isAllowedOperator(op: string): op is SoilListOperator {
  return ALLOWED_OPERATORS.includes(op as SoilListOperator);
}

function normalizeFilter(value: unknown): SoilListFilter {
  if (!value || typeof value !== "object") {
    throw new SoilListRequestError("条件の形が正しくありません");
  }

  const raw = value as Record<string, unknown>;
  const legacyPurchaseHistory = raw.field === "purchaseHistory";
  if (typeof raw.field !== "string" || (!isAllowedField(raw.field) && !legacyPurchaseHistory)) {
    throw new SoilListRequestError("使えない条件が含まれています");
  }
  if (typeof raw.op !== "string" || !isAllowedOperator(raw.op)) {
    throw new SoilListRequestError("使えない比較方法が含まれています");
  }

  const field: SoilListFilter["field"] = legacyPurchaseHistory
    ? "purchaseHistoryExists"
    : (raw.field as SoilListFilter["field"]);

  if (raw.op === "empty" || raw.op === "notEmpty") {
    return { field, op: raw.op };
  }

  const filterValue = raw.value;
  if (legacyPurchaseHistory) {
    if (filterValue === "あり") return { field: "purchaseHistoryExists", op: "eq", value: true };
    if (filterValue === "なし") return { field: "purchaseHistoryExists", op: "eq", value: false };
    throw new SoilListRequestError("条件の値が正しくありません");
  }

  if (raw.op === "in" || raw.op === "inOrEmpty") {
    if (!Array.isArray(filterValue) || filterValue.length === 0) {
      throw new SoilListRequestError("条件の値が正しくありません");
    }
    if (filterValue.length > MAX_MULTI_SELECT_VALUES) {
      throw new SoilListRequestError("選べるのは 100 件までです");
    }
    if (!filterValue.every((item) => typeof item === "string")) {
      throw new SoilListRequestError("条件の値が正しくありません");
    }
    return { field, op: raw.op, value: filterValue };
  }

  const validValue = typeof filterValue === "string" || typeof filterValue === "number" || typeof filterValue === "boolean";

  if (!validValue) {
    throw new SoilListRequestError("条件の値が正しくありません");
  }

  return { field, op: raw.op, value: filterValue };
}

export function normalizeConditionPayload(input: unknown): SoilListConditionPayload {
  if (!input || typeof input !== "object") return { filters: [] };
  const filters = (input as Record<string, unknown>).filters;
  if (!Array.isArray(filters)) return { filters: [] };
  return { filters: filters.map(normalizeFilter).filter((filter) => filter.op === "empty" || filter.op === "notEmpty" || filter.value !== "") };
}

export function normalizeConditionRequestPayload(input: unknown): SoilListConditionPayload {
  if (!input || typeof input !== "object") return { filters: [] };
  return normalizeConditionPayload((input as Record<string, unknown>).condition);
}

export function normalizeExportColumns(input: unknown): SoilListColumnKey[] {
  const fallback = SOIL_LIST_EXPORT_COLUMNS.filter((column) => column.defaultChecked).map((column) => column.key);
  if (!Array.isArray(input)) return fallback;

  const allowed = new Set(SOIL_LIST_EXPORT_COLUMNS.map((column) => column.key));
  const keys = input.filter(
    (item): item is SoilListColumnKey => typeof item === "string" && allowed.has(item as SoilListColumnKey),
  );

  return keys.length > 0 ? keys : fallback;
}

export function normalizeExportLimit(input: unknown): number {
  if (input === undefined || input === null || input === "") return DEFAULT_EXPORT_LIMIT;
  const parsed = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new SoilListRequestError("上限は 1 以上で指定してください");
  }
  if (parsed > MAX_EXPORT_LIMIT) {
    throw new SoilListRequestError(`上限は ${MAX_EXPORT_LIMIT.toLocaleString("ja-JP")} 件までです`);
  }
  return Math.floor(parsed);
}

export function normalizeSortKey(input: unknown): SoilListSortKey {
  if (typeof input !== "string") return "listLoadedOnAsc";
  const keys = SOIL_LIST_SORT_OPTIONS.map((option) => option.key);
  return keys.includes(input as SoilListSortKey) ? (input as SoilListSortKey) : "listLoadedOnAsc";
}
