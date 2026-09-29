import {
  SOIL_LIST_TABLES,
  getColumnName,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListSortKey,
} from "@/app/system/list/_lib/list-fields";

import { filterToSql } from "./search-sql";

type SqlState = {
  values: unknown[];
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function columnSql(key: SoilListColumnKey): string {
  return quoteIdentifier(getColumnName(key));
}

function selectColumnSql(key: SoilListColumnKey): string {
  if (key === "contractElapsed") {
    return `case when ${columnSql("contractMonth")} is null then null else concat(extract(year from age(current_date, ${columnSql("contractMonth")}))::int, '年', extract(month from age(current_date, ${columnSql("contractMonth")}))::int, 'か月') end`;
  }
  return columnSql(key);
}

function orderBySql(sortKey: SoilListSortKey): string {
  const listDirection = sortKey === "listLoadedOnDesc" ? "desc" : "asc";
  return `${columnSql("listLoadedOn")} ${listDirection} nulls last, ${columnSql("phoneNumber")} asc`;
}

function whereSqlExcludingInternalBlock(condition: SoilListConditionPayload, state: SqlState): string {
  const parts = [
    ...condition.filters.map((filter) => filterToSql(filter, state)),
    // 自社アポ禁は NOT NULL（既定 false）。「is not true」だと部分索引が使われず全件読みになる（2026-09-29 実測 6.5 秒）ので「= false」で書く
    `${columnSql("internalBlocked")} = false`,
  ];
  return `where ${parts.join(" and ")}`;
}

export function buildExportCountSql(condition: SoilListConditionPayload): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const text = [
    "select count(*)::bigint as count",
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSqlExcludingInternalBlock(condition, state),
  ].filter(Boolean).join("\n");
  return { text, values: state.values };
}

export function buildInternalBlockExcludedCountSql(condition: SoilListConditionPayload): { text: string; values: unknown[] } {
  const state: SqlState = { values: [] };
  const parts = [
    ...condition.filters.map((filter) => filterToSql(filter, state)),
    `${columnSql("internalBlocked")} = true`,
  ];
  const text = [
    "select count(*)::bigint as count",
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    `where ${parts.join(" and ")}`,
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
  const select = columns.map((key) => `${selectColumnSql(key)} as ${quoteIdentifier(key)}`).join(", ");
  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSqlExcludingInternalBlock(condition, state),
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
  const select = columns.map((key) => `${selectColumnSql(key)} as ${quoteIdentifier(key)}`).join(", ");
  const text = [
    `select ${select}`,
    `from ${quoteIdentifier(SOIL_LIST_TABLES.phone)}`,
    whereSqlExcludingInternalBlock(condition, state),
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
