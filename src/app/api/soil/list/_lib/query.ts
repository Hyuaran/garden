import {
  MAX_SEARCH_ROWS,
  SOIL_LIST_COLUMNS,
  SOIL_LIST_TABLES,
  SOIL_LIST_SEARCH_COLUMNS,
  getColumnName,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
  type SoilListSortKey,
} from "@/app/system/list/_lib/list-fields";

import { SoilListRequestError } from "./validation";

export type SearchRow = {
  phoneNumber: string;
  name: string;
  addressCity: string;
  listName: string;
  lastCalledOn: string;
  callCount: number | null;
  purchaseStatus: string;
};

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
};

type FilterQuery<T> = {
  eq(column: string, value: unknown): T;
  neq(column: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  in(column: string, values: unknown[]): T;
  not(column: string, operator: string, value: unknown): T;
  or(filters: string): T;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): T;
  range(from: number, to: number): T;
  limit(count: number): T;
};

export interface SoilQuery extends FilterQuery<SoilQuery>, PromiseLike<QueryResult> {}

export type SoilListDb = {
  from(table: string): {
    select(columns: string, options?: { count?: "exact"; head?: boolean }): SoilQuery;
  };
};

export function buildSelect(keys: SoilListColumnKey[]): string {
  return keys.map(getColumnName).join(",");
}

function applyFilter<T extends FilterQuery<T>>(query: T, filter: SoilListFilter): T {
  if (!(filter.field in SOIL_LIST_COLUMNS)) {
    throw new SoilListRequestError("使えない条件が含まれています");
  }
  const column = getColumnName(filter.field);
  switch (filter.op) {
    case "eq":
      return query.eq(column, filter.value);
    case "empty":
      return query.or(`${column}.is.null,${column}.eq.`);
    case "notEmpty":
      return query.not(column, "is", null).neq(column, "");
    case "contains":
      return query.ilike(column, `%${String(filter.value).replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
    case "gte":
      return query.gte(column, filter.value);
    case "lte":
      return query.lte(column, filter.value);
    case "in":
      if (!Array.isArray(filter.value)) {
        throw new SoilListRequestError("条件の値が正しくありません");
      }
      return query.in(column, filter.value);
    case "inOrEmpty":
      if (!Array.isArray(filter.value)) {
        throw new SoilListRequestError("条件の値が正しくありません");
      }
      return query.or(`${column}.in.(${filter.value.map(quotePostgrestValue).join(",")}),${column}.is.null,${column}.eq.`);
    default:
      return query;
  }
}

function quotePostgrestValue(value: string | number): string {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function applyParentFilters<T extends FilterQuery<T>>(query: T, filters: SoilListFilter[]): T {
  return filters.reduce((current, filter) => applyFilter(current, filter), query);
}

export function applySort<T extends FilterQuery<T>>(query: T, sortKey: SoilListSortKey): T {
  switch (sortKey) {
    case "listLoadedOnDesc":
      return query.order(getColumnName("listLoadedOn"), { ascending: false, nullsFirst: false });
    case "listLoadedOnAsc":
    default:
      return query.order(getColumnName("listLoadedOn"), { ascending: true, nullsFirst: false });
  }
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}

function maskName(name: string): string {
  if (!name) return "";
  return `${name.slice(0, 1)}*`;
}

export function toSearchRow(row: Record<string, unknown>): SearchRow {
  const callCount = row[getColumnName("callCount")];
  const phone = String(row[getColumnName("phoneNumber")] ?? "");
  const prefecture = String(row[getColumnName("prefecture")] ?? "");
  const city = String(row[getColumnName("city")] ?? "");
  return {
    phoneNumber: maskPhone(phone),
    name: maskName(String(row[getColumnName("name")] ?? "")),
    addressCity: `${prefecture}${city}`,
    listName: String(row[getColumnName("listName")] ?? ""),
    lastCalledOn: String(row[getColumnName("lastCalledOn")] ?? ""),
    callCount: typeof callCount === "number" ? callCount : callCount === null || callCount === undefined ? null : Number(callCount),
    purchaseStatus: String(row[getColumnName("purchaseStatus")] ?? ""),
  };
}

export async function buildBasePhoneQuery(
  db: SoilListDb,
  condition: SoilListConditionPayload,
  selectColumns: string,
  options?: { count?: "exact"; head?: boolean },
): Promise<{ query: SoilQuery }> {
  let query = db.from(SOIL_LIST_TABLES.phone).select(selectColumns, options);
  query = applyParentFilters(query, condition.filters);
  return { query };
}

export function searchSelect(): string {
  return buildSelect(SOIL_LIST_SEARCH_COLUMNS);
}

export function clampSearchRange<T extends FilterQuery<T>>(query: T): T {
  return query.range(0, MAX_SEARCH_ROWS - 1);
}
