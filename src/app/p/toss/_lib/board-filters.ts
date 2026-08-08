import type { TossBoardRow } from "./board";

export type BoardColumnKey = Exclude<keyof TossBoardRow, "id" | "partnerCode" | "latestCall">;
export type BoardColumnFilters = Partial<Record<BoardColumnKey, string[]>>;

export function boardFilterValues(row: TossBoardRow, key: BoardColumnKey): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.length ? value : ["—"] : [value || "—"];
}

export function matchesBoardColumnFilters(row: TossBoardRow, filters: BoardColumnFilters) {
  return Object.entries(filters).every(([key, selected]) => !selected?.length || selected.some(value => boardFilterValues(row, key as BoardColumnKey).includes(value)));
}
