import { NOTICE_KINDS, japanDate, type Notice } from "@/lib/notices";
import styles from "./notices.module.css";
export function NoticeCard({ notice, unread = false }: {
    notice: Notice;
    unread?: boolean;
}) {
    const href = notice.manual_href?.startsWith("/system/manuals/") ? notice.manual_href : null;
    return <article className={styles.card}><div className={styles.meta}>{unread && <span aria-label="未確認" className={styles.dot}/>}<span className={styles.tag}>{NOTICE_KINDS[notice.kind]}</span>{notice.published_at && <time dateTime={notice.published_at}>{japanDate(new Date(notice.published_at))}</time>}<span>{notice.module}</span></div><h3>{notice.title}</h3><p>{notice.body}</p>{notice.kind !== "feature" && <><p><strong>これまで：</strong>{notice.before_text}</p><p><strong>これから：</strong>{notice.after_text}</p></>}{href && <a className={styles.link} href={href}>マニュアルを見る →</a>}</article>;
}
