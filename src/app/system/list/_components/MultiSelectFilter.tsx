"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import { EMPTY_OPTION_VALUE, type SoilListOptionItem } from "../_lib/list-fields";

import styles from "./list-master.module.css";

export type MultiSelectOptionGroup = {
  label?: string;
  options: SoilListOptionItem[];
};

type MultiSelectFilterProps = {
  label: string;
  value: string[];
  groups: MultiSelectOptionGroup[];
  onChange(value: string[]): void;
  searchable?: boolean;
};

function optionText(option: SoilListOptionItem): string {
  return `${option.label}（${option.count.toLocaleString("ja-JP")}）`;
}

function summarizeSelection(value: string[], options: SoilListOptionItem[]): string {
  if (value.length === 0) return "指定なし";
  const labels = value.map((selected) => options.find((option) => (option.empty ? EMPTY_OPTION_VALUE : option.value) === selected)?.label ?? selected);
  if (labels.length <= 2) return labels.join("、");
  const rest = labels.length - 2;
  return `${labels.slice(0, 2).join("、")} ほか${rest}（${labels.length}）`;
}

export default function MultiSelectFilter({ label, value, groups, onChange, searchable = false }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();
  const allOptions = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const visibleGroups = useMemo(() => {
    const keyword = searchQuery.trim().toLocaleLowerCase("ja-JP");
    if (!searchable || !keyword) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => `${option.label} ${option.value}`.toLocaleLowerCase("ja-JP").includes(keyword)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, searchQuery, searchable]);
  const visibleOptions = useMemo(() => visibleGroups.flatMap((group) => group.options), [visibleGroups]);
  const selected = new Set(value);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  // パネルは絞り込みの枠（親）の中に収める：幅は枠の幅まで、右にはみ出すなら左へずらす
  useEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    const parent = wrapper?.parentElement;
    if (!wrapper || !parent) return;
    const place = () => {
      const parentWidth = parent.clientWidth;
      const offset = wrapper.getBoundingClientRect().left - parent.getBoundingClientRect().left;
      const width = Math.min(940, parentWidth);
      const left = Math.max(-offset, parentWidth - offset - width);
      // 列数はパネルの幅で決める（県名＋件数が 1 行に収まる幅＝約 180px）
      const columns = width >= 880 ? 5 : width >= 700 ? 4 : width >= 500 ? 3 : 2;
      setPanelStyle({ width, left, "--cols": columns } as CSSProperties);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function optionValue(option: SoilListOptionItem): string {
    return option.empty ? EMPTY_OPTION_VALUE : option.value;
  }

  function toggle(nextValue: string) {
    onChange(selected.has(nextValue) ? value.filter((item) => item !== nextValue) : [...value, nextValue]);
  }

  function groupState(group: MultiSelectOptionGroup) {
    const groupValues = group.options.map(optionValue);
    const selectedCount = groupValues.filter((item) => selected.has(item)).length;
    return { groupValues, all: selectedCount === groupValues.length && groupValues.length > 0, some: selectedCount > 0 && selectedCount < groupValues.length };
  }

  // 地方の見出しのチェック：全部入っていれば全部外す、そうでなければ全部入れる
  function toggleGroup(group: MultiSelectOptionGroup) {
    const { groupValues, all } = groupState(group);
    onChange(all ? value.filter((item) => !groupValues.includes(item)) : Array.from(new Set([...value, ...groupValues])));
  }

  const toggleAllOptions = searchable ? visibleOptions : allOptions;
  const allValues = toggleAllOptions.map(optionValue);
  const everythingSelected = allValues.length > 0 && allValues.every((item) => selected.has(item));

  // 右上のボタン：全部入っていれば「すべて外す」、そうでなければ「すべて選ぶ」
  function toggleAll() {
    onChange(everythingSelected ? [] : allValues);
  }

  return (
    <div className={styles.multiSelect} ref={wrapperRef}>
      <span id={labelId} className={styles.filterLabel}>
        {label}
      </span>
      <button
        type="button"
        className={styles.multiSelectButton}
        aria-labelledby={`${labelId} ${panelId}-summary`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span id={`${panelId}-summary`}>{summarizeSelection(value, allOptions)}</span>
        <span aria-hidden="true">▼</span>
      </button>
      {open && (
        <div className={styles.multiSelectPanel} id={panelId} style={panelStyle}>
          <div className={styles.multiSelectHeader}>
            <strong>{label}</strong>
            <span>
              <button type="button" className={styles.secondaryButton} onClick={toggleAll}>
                {everythingSelected ? "すべて外す" : "すべて選ぶ"}
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </span>
          </div>
          {searchable && (
            <label className={styles.multiSelectSearch}>
              名前で絞る
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="含む" />
            </label>
          )}
          <div className={styles.multiSelectOptions}>
            {visibleGroups.map((group, groupIndex) => (
              <div className={styles.optionGroup} key={`${label}-${group.label ?? groupIndex}`}>
                {group.label ? (() => {
                  const state = groupState(group);
                  const total = group.options.reduce((sum, option) => sum + option.count, 0);
                  return (
                    <label className={styles.groupButton}>
                      <input
                        type="checkbox"
                        checked={state.all}
                        ref={(element) => { if (element) element.indeterminate = state.some; }}
                        onChange={() => toggleGroup(group)}
                        aria-label={`${group.label}をすべて選ぶ`}
                      />
                      {group.label}（{total.toLocaleString("ja-JP")}）
                    </label>
                  );
                })() : (
                  groupIndex > 0 && <div className={styles.groupDivider} aria-hidden="true" />
                )}
                <div className={styles.checkboxGrid}>
                  {group.options.map((option) => {
                    const currentValue = optionValue(option);
                    return (
                      <label key={`${label}-${currentValue}`}>
                        <input type="checkbox" checked={selected.has(currentValue)} onChange={() => toggle(currentValue)} />
                        {optionText(option)}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
