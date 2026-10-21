"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./BoxSelect.module.css";
export type BoxOption = { value: string; label: string };
export function selectionLabel(values: string[], options: BoxOption[], noun: string) {
  return values.length >= 3 ? `${values.length} つの${noun}` : values.map(value => options.find(o => o.value === value)?.label ?? value).join("・");
}
export default function BoxSelect({ label, value, options, onChange, multiple = true }: { multiple?: boolean; label: string; value: string[]; options: BoxOption[]; onChange: (value: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [position, setPosition] = useState({left:8,top:8});
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLFormElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLInputElement>("input")?.focus();
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    const dismiss = () => setOpen(false);
    document.addEventListener("pointerdown",outside); document.addEventListener("keydown",key); window.addEventListener("resize",dismiss); 
    return () => { document.removeEventListener("pointerdown",outside); document.removeEventListener("keydown",key); window.removeEventListener("resize",dismiss);  };
  },[open]);
  return <div className={styles.root}><button ref={trigger} type="button" className={styles.trigger} aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
    if (open) { close(); return; }
    const rect = trigger.current!.getBoundingClientRect();
    setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-328)),top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-400))});
    setDraft(value); setOpen(true);
  }}><small>{label}</small><span><em className={styles.valueText} title={selectionLabel(value,options,label)}>{selectionLabel(value,options,label)}</em><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span></button>
  {open && <form ref={menu} role="dialog" aria-label={label} className={styles.menu} style={position} onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); e.currentTarget.requestSubmit(); } }} onSubmit={e => { e.preventDefault(); if (draft.length) { onChange(options.filter(o => draft.includes(o.value)).map(o => o.value)); close(); } }}>
    <div className={styles.options}>{options.map(option => <label key={option.value}><input type={multiple ? "checkbox" : "radio"} name={multiple ? undefined : label} checked={draft.includes(option.value)} onChange={e => setDraft(!multiple ? [option.value] : e.target.checked ? [...draft,option.value] : draft.filter(v => v !== option.value))} />{option.label}</label>)}</div>
    <div className={styles.actions}>{multiple && <button type="button" onClick={() => setDraft(draft.length ? [] : options.map(o => o.value))}>{draft.length ? "すべて解除" : "すべて選択"}</button>}<button type="submit" className={styles.primary} disabled={!draft.length}>OK</button></div>
  </form>}</div>;
}
