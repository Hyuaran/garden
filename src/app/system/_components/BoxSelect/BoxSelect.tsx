"use client";
import { rootZoom } from "@/app/_lib/font-size";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./BoxSelect.module.css";
export type BoxOption = { value: string; label: string };
export function selectionLabel(values: string[], options: BoxOption[], noun: string) {
  return values.length >= 3 ? `${values.length} つの${noun}` : values.map(value => options.find(o => o.value === value)?.label ?? value).join("・");
}
export default function BoxSelect({ label, value, options, onChange, multiple = true, hideLabel = false, required = false, allowEmpty = false, disabled = false, compact = false }: { compact?: boolean; required?: boolean; allowEmpty?: boolean; disabled?: boolean; multiple?: boolean; /** フォームの行の見出しがあるときは、箱の中の小さな見出しを出さない */ hideLabel?: boolean; label: string; value: string[]; options: BoxOption[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [position, setPosition] = useState<Record<string, string | number>>({left:8,top:8});
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLFormElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLInputElement>("input")?.focus();
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown",outside); document.addEventListener("keydown",key); window.addEventListener("resize",dismiss); window.addEventListener("garden-font-size-change",dismiss);
    return () => { document.removeEventListener("pointerdown",outside); document.removeEventListener("keydown",key); window.removeEventListener("resize",dismiss); window.removeEventListener("garden-font-size-change",dismiss);  };
  },[open]);
  const popup = open && <form ref={menu} role="dialog" aria-label={label} className={styles.menu} style={position as React.CSSProperties} onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.currentTarget.requestSubmit(); } }} onSubmit={e => { e.preventDefault(); if (compact) e.stopPropagation(); if (allowEmpty || draft.length) { onChange(options.filter(o => draft.includes(o.value)).map(o => o.value)); close(); } }}>
    <div className={styles.options}>{options.map(option => <label key={option.value}><input type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : label} checked={draft.includes(option.value)} onChange={e => setDraft(!multiple ? [option.value] : e.target.checked ? [...draft,option.value] : draft.filter(v => v !== option.value))} />{option.label}</label>)}</div>
    <div className={styles.actions}>{multiple && <button type="button" onClick={() => setDraft(draft.length ? [] : options.map(o => o.value))}>{draft.length ? "すべて解除" : "すべて選択"}</button>}<button type="submit" className={styles.primary} disabled={disabled || (!allowEmpty && !draft.length)}>OK</button></div>
  </form>;
  return <div className={compact ? styles.compact : styles.root}><button ref={trigger} type="button" disabled={disabled} className={styles.trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
    if (open) { close(); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const zoom = rootZoom();
    // body に出すときは、画面ごとの色（明暗）が届かないので、押したボタンの場所の色を写す（2026-11-21）
    const theme: Record<string, string> = {};
    if (compact) {
      const css = getComputedStyle(trigger.current!);
      for (const name of ["--card", "--line", "--teal", "--ink", "--sub"]) { const v = css.getPropertyValue(name).trim(); if (v) theme[name] = v; }
      const page = trigger.current!.closest("table") ?? trigger.current!;
      theme.color = getComputedStyle(page).color;
      if (!theme["--card"]) theme.background = getComputedStyle(page).backgroundColor;
    }
    setPosition({...theme, left:Math.max(8,Math.min(rect.left/zoom,window.innerWidth/zoom-328)),top:Math.max(8,Math.min(rect.bottom/zoom+4,window.innerHeight/zoom-400))});
    setDraft(value); setOpen(true);
  }}>{!compact && !hideLabel && <small>{label}{required && <span className="garden-required" aria-hidden="true">＊</span>}</small>}<span><em className={styles.valueText} title={selectionLabel(value,options,label)}>{compact ? label : selectionLabel(value,options,label)}</em>{compact && value.length > 0 && <span aria-label="絞り込み中">（{value.length}）</span>}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span></button>
    {compact && popup ? createPortal(popup, document.body) : popup}
  </div>;
}
