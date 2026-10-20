"use client";
import type { ReactNode } from "react";
import { formatSyncStamp } from "./formatSyncStamp";
import styles from "./updated-stamp.module.css";

export function UpdatedStampRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export default function UpdatedStamp({ label, date, emptyText = "未取得", onRefresh, busy = false, disabled = false, refreshLabel, title, hideRefresh = false, children }: {
  children?: ReactNode; hideRefresh?: boolean; label: string; date?: string | Date | null; emptyText?: string;
  onRefresh?: () => void; busy?: boolean; disabled?: boolean; refreshLabel?: string; title?: string;
}) {
  const stamp = date ? formatSyncStamp(date) : "";
  return <div className={styles.stamp}>
    <span>{label}最終更新：{stamp || emptyText}</span>
    {children}
    {!hideRefresh && <span className={styles.refresh} tabIndex={!onRefresh ? 0 : undefined}>
    <button type="button" className={styles.button} onClick={onRefresh} disabled={!onRefresh || busy || disabled} aria-busy={busy} aria-label={onRefresh ? refreshLabel : "自動で更新されます（手動の取り直しはできません）"} title={onRefresh ? title ?? refreshLabel : "自動で更新されます（手動の取り直しはできません）"}>
      <svg className={busy ? styles.busy : undefined} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M19.8 4.6v4.2h-4.2z" fill="currentColor" />
      </svg>
    </button>
    {!onRefresh && <span className={styles.tooltip} role="tooltip">自動で更新されます（手動の取り直しはできません）</span>}
    </span>}
  </div>;
}
