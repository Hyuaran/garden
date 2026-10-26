"use client";
import type { HTMLAttributes, ReactNode } from "react";
import styles from "./system-tabs.module.css";

type Props = HTMLAttributes<HTMLDivElement> & {
  /** タブの行の右端に置く操作（並び替え・設定などの線画アイコン）。下線はタブと共通で右端まで続く */
  actions?: ReactNode;
};

/** Shared panel navigation. Children retain their handlers, IDs and link destinations. */
export default function SystemTabs({ children, className, actions, ...props }: Props) {
  const tablist = <div role="tablist" {...props} className={[styles.tabs, actions ? styles.inRow : "", className].filter(Boolean).join(" ")}>{children}</div>;
  if (!actions) return tablist;
  return <div className={styles.row}>{tablist}<div className={styles.actions}>{actions}</div></div>;
}

/** タブの行の右端に置く線画アイコンのボタン（社長スタイル §2.5） */
export function TabActionButton({ label, pressed, icon, ...props }: Omit<HTMLAttributes<HTMLButtonElement>, "children"> & { label: string; pressed?: boolean; icon: "sort" | "settings" | "plus"; disabled?: boolean }) {
  return <button type="button" {...props} className={styles.actionButton} aria-label={label} title={label} aria-pressed={pressed}>
    {icon === "plus" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> : icon === "sort"
      ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5" /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>}
  </button>;
}
