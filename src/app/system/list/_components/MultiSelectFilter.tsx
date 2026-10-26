"use client";

import { useMemo, useState } from "react";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { EMPTY_OPTION_VALUE, type SoilListOptionItem } from "../_lib/list-fields";

export type MultiSelectOptionGroup = { label?: string; options: SoilListOptionItem[] };
type MultiSelectFilterProps = {
  label: string;
  value: string[];
  groups: MultiSelectOptionGroup[];
  onChange(value: string[]): void;
  searchable?: boolean;
  initialLimit?: number;
  countNote?: string;
  columns?: number;
  emptyLabel?: string;
  panelMinWidth?: number;
};

const ALL = "__garden_filter_all__";

// 絞り込みの確定操作・表示は BoxSelect に集約する。候補検索と件数表示は残す。
export default function MultiSelectFilter({ label, value, groups, onChange, searchable, initialLimit, countNote, emptyLabel = "指定なし" }: MultiSelectFilterProps) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const unique = new Map<string, { value: string; label: string }>();
    for (const [index, option] of groups.flatMap(group => group.options).entries()) {
      const key = option.empty ? EMPTY_OPTION_VALUE : option.value;
      if (query && !value.includes(key) && !`${option.label} ${option.value}`.toLocaleLowerCase("ja-JP").includes(query.toLocaleLowerCase("ja-JP"))) continue;
      if (!query && searchable && initialLimit && index >= initialLimit && !value.includes(key)) continue;
      unique.set(key, { value: key, label: `${option.label}（${option.count.toLocaleString("ja-JP")}）` });
    }
    return [{ value: ALL, label: emptyLabel }, ...unique.values()];
  }, [groups, query, value, emptyLabel, searchable, initialLimit]);
  return <div>
    {searchable && <input aria-label={`${label}の候補を検索`} placeholder="候補を検索" value={query} onChange={event => setQuery(event.target.value)} />}
    <div data-garden-box-select><BoxSelect label={label} value={value.length ? value : [ALL]} options={options} onChange={next => {
      onChange(value.length && next.includes(ALL) ? [] : next.filter(item => item !== ALL));
      setQuery("");
    }} /></div>
    {searchable && initialLimit && !query && groups.reduce((count, group) => count + group.options.length, 0) > initialLimit && <small>上位 {initialLimit.toLocaleString("ja-JP")} 件を表示中（全 {groups.reduce((count, group) => count + group.options.length, 0).toLocaleString("ja-JP")} 件）。名前で絞ると全体から探せます</small>}
    {countNote && <small>{countNote}</small>}
  </div>;
}
