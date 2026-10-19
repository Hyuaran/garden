"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { NOTICE_KINDS, type Notice } from "@/lib/notices";
import { useNotices } from "./NoticeProvider";
import { NoticeCard } from "./NoticeCard";
import { NoticeDialog } from "./NoticeDialog";
import styles from "./notices.module.css";
export function NoticeList() {
    const { loading, isAuthenticated, role } = useAuthUnified();
    const router = useRouter();
    const pathname = usePathname();
    const state = useNotices();
    const [kind, setKind] = useState("");
    const [module, setModule] = useState("");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [preview, setPreview] = useState<Notice | null>(null);
    const [publishing, setPublishing] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => { if (!loading && !isAuthenticated)
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); }, [loading, isAuthenticated, router, pathname]);
    if (loading || !isAuthenticated)
        return <p>ログインを確認しています…</p>;
    if (!state)
        return null;
    const { snapshot, published } = state;
    const notices = published.filter(n => (!kind || n.kind === kind) && (!module || n.module === module) && (!unreadOnly || !snapshot?.readIds.includes(n.id)));
    const drafts = role === "super_admin" ? (snapshot?.notices ?? []).filter(n => n.status === "draft") : [];
    async function publish(id: string) { setPublishing(id); setFailed(false); try {
        await state!.publish(id);
    }
    catch {
        setFailed(true);
    }
    finally {
        setPublishing(null);
    } }
    return <section className={styles.page}><h1>お知らせ</h1><div className={styles.filters}><label>種類 <select value={kind} onChange={e => setKind(e.target.value)}><option value="">すべて</option>{Object.entries(NOTICE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>モジュール <select value={module} onChange={e => setModule(e.target.value)}><option value="">すべて</option>{[...new Set(published.map(n => n.module))].sort().map(m => <option key={m}>{m}</option>)}</select></label><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/> 未確認だけ表示</label></div>
 {state.error ? <p role="alert">お知らせを読み込めませんでした。<button onClick={state.refresh}>もう一度読み込む</button></p> : !snapshot ? <p>読み込み中…</p> : !notices.length ? <p>該当するお知らせはありません。</p> : notices.map(notice => <div key={notice.id}><NoticeCard notice={notice} unread={!snapshot.readIds.includes(notice.id)}/>{!snapshot.readIds.includes(notice.id) && <button className={styles.confirm} onClick={() => state.acknowledge([notice.id])}>確認しました</button>}</div>)}
 {role === "super_admin" && <section className={styles.drafts}><h2>下書き {drafts.length} 件</h2>{failed && <p role="alert">公開できませんでした。もう一度お試しください。</p>}{drafts.map(notice => <div key={notice.id}><NoticeCard notice={notice}/><div className={styles.buttons}><button onClick={() => setPreview(notice)}>モーダルでの見え方</button><button className={styles.primary} disabled={publishing !== null} onClick={() => void publish(notice.id)}>{publishing === notice.id ? "公開しています…" : "公開する"}</button></div></div>)}</section>}
 {preview && <NoticeDialog title="Garden からのお知らせ（見え方の確認）" onClose={() => setPreview(null)} footer={<button onClick={() => setPreview(null)}>閉じる</button>}><NoticeCard notice={preview}/></NoticeDialog>}</section>;
}
