"use client";
import Link from "next/link";
import { useNotices } from "./NoticeProvider";
import styles from "./notices.module.css";

// ベル。className を渡すと、その外枠のアイコンボタン（テーマ切替・ログアウトと同じ大きさ）に合わせる
export function NoticeBell({ className, href = "/system/notices" }: { className?: string; href?: string }) {
    const count = useNotices()?.unreadCount ?? 0;
    return <Link href={href} className={`${className ?? styles.bell} ${styles.bellLink}`} aria-label={`お知らせ${count ? `（未確認 ${count} 件）` : ""}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9.5a6 6 0 0 1 12 0c0 5.5 2.2 7.5 2.2 7.5H3.8S6 15 6 9.5"/><path d="M10 20.2a2.2 2.2 0 0 0 4 0"/></svg>
        {count > 0 && <span className={styles.bellBadge}>{count > 99 ? "99+" : count}</span>}
    </Link>;
}
