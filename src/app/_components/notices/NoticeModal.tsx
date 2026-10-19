"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { excludedNoticePath, japanDate, modalNotices } from "@/lib/notices";
import { useNotices } from "./NoticeProvider";
import { NoticeDialog } from "./NoticeDialog";
import { NoticeCard } from "./NoticeCard";
import styles from "./notices.module.css";
export default function NoticeModal() {
    const pathname = usePathname();
    const { role, userId, loading } = useAuthUnified();
    const state = useNotices();
    const [dismissed, setDismissed] = useState<string | null>(null);
    const key = `${userId}:${japanDate()}`;
    if (!state?.snapshot || loading || !userId || excludedNoticePath(pathname) || dismissed === key || state.snapshot.snoozedOn === japanDate())
        return null;
    const notices = modalNotices(state.snapshot, role);
    if (!notices.length)
        return null;
    const shown = notices.slice(0, 5);
    function close(ack = false) { setDismissed(key); if (ack)
        state?.acknowledge(shown.map(n => n.id));
    else
        state?.snooze(); }
    return <NoticeDialog title={`Garden からのお知らせ（${shown.length} 件）`} onClose={() => close()} footer={<><Link href="/system/notices" onClick={() => close()}>すべてのお知らせを見る</Link><div className={styles.buttons}><button onClick={() => close()}>あとで</button><button className={styles.primary} onClick={() => close(true)}>確認しました</button></div></>}>{shown.map(notice => <NoticeCard key={notice.id} notice={notice}/>)}{notices.length > 5 && <p>ほか {notices.length - 5} 件はお知らせページで</p>}</NoticeDialog>;
}
