import {
  DEFAULT_SOIL_LIST_CONDITION,
  FILTER_FIRST_THRESHOLD,
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
  | "purchaseStatus"
  | "contractMonth";

export type SearchSortDirection = "asc" | "desc";

export type SearchSort = {
  key: SearchSortKey;
  direction: SearchSortDirection;
};

type SqlState = {
  values: unknown[];
};

type BuildSearchSqlOptions = {
  filterFirst?: boolean;
};

const SORT_COLUMNS: Record<SearchSortKey, SoilListColumnKey> = {
  phoneNumber: "phoneNumber",
  name: "name",
  addressCity: "prefecture",
  listName: "listName",
  lastCalledOn: "lastCalledOn",
  callCount: "callCount",
  purchaseStatus: "purchaseStatus",
  contractMonth: "contractMonth",
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function columnSql(key: SoilListColumnKey): string {
  return quoteIdentifier(getColumnName(key));
}

function selectColumnSql(key: SoilListColumnKey): string {
  if (key === "contractElapsed") {
    return `case when ${columnSql("contractMonth")} is null then null else concat(extract(year from age(current_date, ${columnSql("contractMonth")}))::int, '年', extract(month from age(current_date, ${columnSql("contractMonth")}))::int, 'か月') end as ${quoteIdentifier(getColumnName(key))}`;
  }
  return columnSql(key);
}

function nextParam(state: SqlState, value: unknown): string {
  state.values.push(value);
  return `$${state.values.length}`;
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function defaultAuAvailabilityValue(): unknown {
  return DEFAULT_SOIL_LIST_CONDITION.filters.find((filter) => filter.field === "auCallAvailability" && filter.op === "eq")?.value;
}

function filterToSql(filter: SoilListFilter, state: SqlState): string {
  if (!(filter.field in SOIL_LIST_COLUMNS) || filter.field === "contractElapsed") {
    throw new SoilListRequestError("使えない条件が含まれています");
  }
  const column = columnSql(filter.field);
  switch (filter.op) {
    case "eq":
      if (filter.field === "auCallAvailability" && filter.value === defaultAuAvailabilityValue()) {
        return `${column} = ${quoteLiteral(String(defaultAuAvailabilityValue() ?? ""))}`;
      }
      if (filter.field === "internalBlocked" && typeof filter.value === "boolean") {
        return `${column} = ${filter.value ? "true" : "false"}`;
      }
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

function buildWhereSql(condition: SoilListConditionPayload, state: SqlState): string {
  const where = condition.filters.map((filter) => filterToSql(filter, state));
  return where.length > 0 ? `where ${where.join(" and ")}` : "";
}

/** 「住所（市区町村まで）」の列は 都道府県 → 市区町村 の順で並べる */
function orderColumns(sort: SearchSort): string {
  const direction = sort.direction === "desc" ? "desc" : "asc";
  if (sort.key === "addressCity") {
    return `${columnSql("prefecture")} ${direction} nulls last, ${columnSql("city")} ${direction}`;
  }
  return `${columnSql(SORT_COLUMNS[sort.key])} ${direction}`;
}

function orderColumnKeys(sort: SearchSort | null): SoilListColumnKey[] {
  if (!sort) return ["phoneNumber"];
  if (sort.key === "addressCity") return ["prefecture", "city", "phoneNumber"];
  const key = SORT_COLUMNS[sort.key];
  return key === "phoneNumber" ? ["phoneNumber"] : [key, "phoneNumber"];
}

function orderBySql(sort: SearchSort | null): string {
  return sort ? `order by ${orderColumns(sort)} nulls last, ${columnSql("phoneNumber")} asc` : `order by ${columnSql("phoneNumber")} asc`;
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

export function buildSearchSql(
  condition: SoilListConditionPayload,
  sort: SearchSort | null,
  page: number,
  options: BuildSearchSqlOptions = {},
): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const select = SOIL_LIST_SEARCH_COLUMNS.map((key) => selectColumnSql(key)).join(", ");
  const where = buildWhereSql(condition, state);
  const offset = (Math.max(1, page) - 1) * MAX_SEARCH_ROWS;
  const orderBy = orderBySql(sort);

  if (options.filterFirst) {
    const materializedColumns = orderColumnKeys(sort).map((key) => columnSql(key)).join(", ");
    const text = [
      "with m as materialized (",
      `  select ctid as _rid, ${materializedColumns}`,
      `  from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
      where ? `  ${where}` : "",
      "), k as (",
      "  select _rid from m",
      `  ${orderBy}`,
      `  limit ${MAX_SEARCH_ROWS} offset ${offset}`,
      ")",
      `select ${select}`,
      `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)} p join k on p.ctid = k._rid`,
      orderBy,
    ].filter(Boolean).join("\n");
    return { text, values: state.values };
  }

  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    where,
    orderBy,
    `limit ${MAX_SEARCH_ROWS} offset ${offset}`,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

export function buildSearchPlanSql(condition: SoilListConditionPayload): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const where = buildWhereSql(condition, state);
  const text = [
    "explain (format json)",
    "select 1",
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    where,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

export function shouldUseFilterFirstSearch(planRows: number | null): boolean {
  return typeof planRows === "number" && Number.isFinite(planRows) && planRows < FILTER_FIRST_THRESHOLD;
}

export function buildCountSql(condition: SoilListConditionPayload): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const where = buildWhereSql(condition, state);
  const text = [
    "select count(*)::bigint as count",
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    where,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}
