"use client";
import Link from "next/link";
import { useNotices } from "./NoticeProvider";
import styles from "./notices.module.css";
export function NoticeBell() { const count = useNotices()?.unreadCount ?? 0; return <Link href="/system/notices" className={styles.bell} aria-label={`お知らせ${count ? `（未確認 ${count} 件）` : ""}`}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4"/></svg>{count > 0 && <span>{count}</span>}</Link>; }
