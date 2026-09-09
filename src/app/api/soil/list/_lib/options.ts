import type { SoilListOptionItem } from "@/app/system/list/_lib/list-fields";

export type OptionRow = { value?: string | null; row_count?: number | string | null };

export function toOptionItems(rows: OptionRow[]): SoilListOptionItem[] {
  return rows
    .map((row) => {
      const rawValue = row.value;
      const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
      const empty = value === "";
      const count = Number(row.row_count ?? 0);
      return {
        value,
        label: empty ? "（空欄）" : value,
        count: Number.isFinite(count) ? count : 0,
        empty,
      };
    })
    .sort((left, right) => {
      if (left.empty !== right.empty) return left.empty ? -1 : 1;
      return right.count - left.count || left.label.localeCompare(right.label, "ja");
    });
}

/** 件数の多い順の上位と「（空欄）」などの補完行を合わせる（同じ値は 1 つに） */
export function mergeOptionRows(topRows: OptionRow[], emptyRows: OptionRow[], extraRows: OptionRow[] = []): OptionRow[] {
  const seen = new Set<string>();
  const merged: OptionRow[] = [];
  [...emptyRows, ...topRows, ...extraRows].forEach((row) => {
    const key = row.value === null || row.value === undefined ? "" : String(row.value);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });
  return merged;
}
