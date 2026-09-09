"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

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
};

function optionText(option: SoilListOptionItem): string {
  return `${option.label}（${option.count.toLocaleString("ja-JP")}）`;
}

function summarizeSelection(value: string[], options: SoilListOptionItem[]): string {
  if (value.length === 0) return "指定なし";
  const labels = value.map((selected) => options.find((option) => (option.empty ? EMPTY_OPTION_VALUE : option.value) === selected)?.label ?? selected);
  if (labels.length === 1) return labels[0];
  const rest = labels.length - 2;
  return `${labels.slice(0, 2).join("、")} ほか${rest}（${labels.length}）`;
}

export default function MultiSelectFilter({ label, value, groups, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();
  const allOptions = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const selected = new Set(value);

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

  function toggleGroup(group: MultiSelectOptionGroup) {
    const groupValues = group.options.map(optionValue);
    const allSelected = groupValues.every((item) => selected.has(item));
    onChange(allSelected ? value.filter((item) => !groupValues.includes(item)) : Array.from(new Set([...value, ...groupValues])));
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
        <div className={styles.multiSelectPanel} id={panelId}>
          <div className={styles.multiSelectHeader}>
            <strong>{label}</strong>
            <span>
              <button type="button" className={styles.secondaryButton} onClick={() => onChange([])}>
                すべて外す
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </span>
          </div>
          <div className={styles.multiSelectOptions}>
            {groups.map((group, groupIndex) => (
              <div className={styles.optionGroup} key={`${label}-${group.label ?? groupIndex}`}>
                {group.label && (
                  <button type="button" className={styles.groupButton} onClick={() => toggleGroup(group)}>
                    {group.label}
                  </button>
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
