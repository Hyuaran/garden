import {
  SOIL_LIST_COLUMNS,
  SOIL_LIST_TABLES,
  getColumnName,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
  type SoilListSortKey,
} from "@/app/system/list/_lib/list-fields";

import { SoilListRequestError } from "./validation";

type SqlState = {
  values: unknown[];
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

function orderBySql(sortKey: SoilListSortKey): string {
  const listDirection = sortKey === "listLoadedOnDesc" ? "desc" : "asc";
  return `${columnSql("listLoadedOn")} ${listDirection} nulls last, ${columnSql("phoneNumber")} asc`;
}

function whereSql(condition: SoilListConditionPayload, state: SqlState): string {
  const parts = condition.filters.map((filter) => filterToSql(filter, state));
  return parts.length > 0 ? `where ${parts.join(" and ")}` : "";
}

export function buildExportCountSql(condition: SoilListConditionPayload): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const text = [
    "select count(*)::bigint as count",
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSql(condition, state),
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

export function buildExportSelectSql(
  condition: SoilListConditionPayload,
  columns: SoilListColumnKey[],
  sortKey: SoilListSortKey,
  limit: number,
  offset: number,
): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const select = columns.map((key) => `${columnSql(key)} as ${quoteIdentifier(key)}`).join(", ");
  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSql(condition, state),
    `order by ${orderBySql(sortKey)}`,
    `limit ${Math.max(0, Math.floor(limit))} offset ${Math.max(0, Math.floor(offset))}`,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

/** 書き出し本体用：limit/offset なし（サーバー側カーソルで少しずつ読む） */
export function buildExportStreamSql(
  condition: SoilListConditionPayload,
  columns: SoilListColumnKey[],
  sortKey: SoilListSortKey,
): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const select = columns.map((key) => `${columnSql(key)} as ${quoteIdentifier(key)}`).join(", ");
  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSql(condition, state),
    `order by ${orderBySql(sortKey)}`,
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

export function buildExportPhoneSql(
  condition: SoilListConditionPayload,
  sortKey: SoilListSortKey,
  limit: number,
): { text: string; values: unknown[] } {
  return buildExportSelectSql(condition, ["phoneNumber"], sortKey, limit, 0);
}

