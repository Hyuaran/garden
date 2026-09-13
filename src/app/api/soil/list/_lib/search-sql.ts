import {
  MAX_SEARCH_PAGE,
  MAX_SEARCH_ROWS,
  SOIL_LIST_COLUMNS,
  SOIL_LIST_SEARCH_COLUMNS,
  SOIL_LIST_TABLES,
  getColumnName,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
} from "@/app/system/list/_lib/list-fields";

import { SoilListRequestError } from "./validation";

export type SearchSortKey =
  | "phoneNumber"
  | "name"
  | "addressCity"
  | "listName"
  | "lastCalledOn"
  | "callCount"
  | "purchaseStatus";

export type SearchSortDirection = "asc" | "desc";

export type SearchSort = {
  key: SearchSortKey;
  direction: SearchSortDirection;
};

type SqlState = {
  values: unknown[];
};

const SORT_COLUMNS: Record<SearchSortKey, SoilListColumnKey> = {
  phoneNumber: "phoneNumber",
  name: "name",
  addressCity: "prefecture",
  listName: "listName",
  lastCalledOn: "lastCalledOn",
  callCount: "callCount",
  purchaseStatus: "purchaseStatus",
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function columnSql(key: SoilListColumnKey): string {
  return quoteIdentifier(getColumnName(key));
}

function nextParam(state: SqlState, value: unknown): string {
  state.values.push(value);
  return `$${state.values.length}`;
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function filterToSql(filter: SoilListFilter, state: SqlState): string {
  if (!(filter.field in SOIL_LIST_COLUMNS)) {
    throw new SoilListRequestError("使えない条件が含まれています");
  }
  const column = columnSql(filter.field);
  switch (filter.op) {
    case "eq":
      return `${column} = ${nextParam(state, filter.value)}`;
    case "empty":
      return `(${column} is null or ${column} = '')`;
    case "notEmpty":
      return `(${column} is not null and ${column} <> '')`;
    case "contains":
      return `${column} ilike ${nextParam(state, `%${escapeLike(String(filter.value))}%`)} escape '\\'`;
    case "gte":
      return `${column} >= ${nextParam(state, filter.value)}`;
    case "lte":
      return `${column} <= ${nextParam(state, filter.value)}`;
    case "in":
      if (!Array.isArray(filter.value)) throw new SoilListRequestError("条件の値が正しくありません");
      return `${column} = any(${nextParam(state, filter.value)})`;
    case "inOrEmpty":
      if (!Array.isArray(filter.value)) throw new SoilListRequestError("条件の値が正しくありません");
      return `(${column} = any(${nextParam(state, filter.value)}) or ${column} is null or ${column} = '')`;
    default:
      return "true";
  }
}

/** 「住所（市区町村まで）」の列は 都道府県 → 市区町村 の順で並べる */
function orderColumns(sort: SearchSort): string {
  const direction = sort.direction === "desc" ? "desc" : "asc";
  if (sort.key === "addressCity") {
    return `${columnSql("prefecture")} ${direction} nulls last, ${columnSql("city")} ${direction}`;
  }
  return `${columnSql(SORT_COLUMNS[sort.key])} ${direction}`;
}

export function normalizeSearchSort(input: unknown): SearchSort | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const key = raw.key;
  const direction = raw.direction;
  if (typeof key !== "string" || !(key in SORT_COLUMNS)) {
    throw new SoilListRequestError("使えない並べ替えが含まれています");
  }
  if (direction !== "asc" && direction !== "desc") {
    throw new SoilListRequestError("並べ替えの向きが正しくありません");
  }
  return { key: key as SearchSortKey, direction };
}

export function normalizeSearchPage(input: unknown): number {
  const page = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), MAX_SEARCH_PAGE);
}

export function buildSearchSql(condition: SoilListConditionPayload, sort: SearchSort | null, page: number): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const select = SOIL_LIST_SEARCH_COLUMNS.map((key) => columnSql(key)).join(", ");
  const where = condition.filters.map((filter) => filterToSql(filter, state));
  const offset = (Math.max(1, page) - 1) * MAX_SEARCH_ROWS;
  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    where.length > 0 ? `where ${where.join(" and ")}` : "",
    // 並びを指定しないときも電話番号順に固定する（順序が無いと offset のページ送りで同じ行が出たり抜けたりする）
    sort ? `order by ${orderColumns(sort)} nulls last, ${columnSql("phoneNumber")} asc` : `order by ${columnSql("phoneNumber")} asc`,
    `limit ${MAX_SEARCH_ROWS} offset ${offset}`,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}
