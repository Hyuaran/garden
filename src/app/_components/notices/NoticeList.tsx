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
    // 「公開する」を選んだときだけ出す確認（東海林さん 2026-10-19「公開するを選択した場合のみ本当に公開しますか？」）
    const [confirming, setConfirming] = useState<Notice | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    useEffect(() => { if (!loading && !isAuthenticated)
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); }, [loading, isAuthenticated, router, pathname]);
    if (loading || !isAuthenticated)
        return <p>ログインを確認しています…</p>;
    if (!state)
        return null;
    const { snapshot, published } = state;
    const notices = published.filter(n => (!kind || n.kind === kind) && (!module || n.module === module) && (!unreadOnly || !snapshot?.readIds.includes(n.id)));
    // 全権には、下書きと公開済みのすべて（見せる相手に関係なく）を並べ、公開する／しないを切り替えられるようにする
    const managed = role === "super_admin"
        ? [...(snapshot?.notices ?? [])].sort((a, b) => Number(a.status === "published") - Number(b.status === "published") || (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
        : [];
    const draftCount = managed.filter(n => n.status === "draft").length;

    async function change(notice: Notice, publish: boolean) {
        setBusy(notice.id);
        setFailed(null);
        try {
            if (publish)
                await state!.publish(notice.id);
            else
                await state!.unpublish(notice.id);
        }
        catch {
            setFailed(publish ? "公開できませんでした。もう一度お試しください。" : "下書きに戻せませんでした。もう一度お試しください。");
        }
        finally {
            setBusy(null);
        }
    }

    return <section className={styles.page}><h1>お知らせ</h1><div className={styles.filters}><label>種類 <select value={kind} onChange={e => setKind(e.target.value)}><option value="">すべて</option>{Object.entries(NOTICE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>モジュール <select value={module} onChange={e => setModule(e.target.value)}><option value="">すべて</option>{[...new Set(published.map(n => n.module))].sort().map(m => <option key={m}>{m}</option>)}</select></label><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/> 未確認だけ表示</label></div>
 {state.error ? <p role="alert">お知らせを読み込めませんでした。<button onClick={state.refresh}>もう一度読み込む</button></p> : !snapshot ? <p>読み込み中…</p> : !notices.length ? <p>該当するお知らせはありません。</p> : notices.map(notice => <div key={notice.id}><NoticeCard notice={notice} unread={!snapshot.readIds.includes(notice.id)}/>{!snapshot.readIds.includes(notice.id) && <button className={styles.confirm} onClick={() => state.acknowledge([notice.id])}>確認しました</button>}</div>)}
 {role === "super_admin" && <section className={styles.drafts}><h2>公開の管理（下書き {draftCount} 件）</h2>{failed && <p role="alert">{failed}</p>}{managed.map(notice => {
        const isPublished = notice.status === "published";
        return <div key={notice.id}><NoticeCard notice={notice}/><div className={styles.buttons}><fieldset className={styles.publishChoice} disabled={busy !== null}><legend className={styles.srOnly}>{notice.title} の公開</legend><label><input type="radio" name={`publish-${notice.id}`} checked={isPublished} onChange={() => setConfirming(notice)}/> 公開する</label><label><input type="radio" name={`publish-${notice.id}`} checked={!isPublished} onChange={() => void change(notice, false)}/> 公開しない</label>{busy === notice.id && <span>切り替えています…</span>}</fieldset><button onClick={() => setPreview(notice)}>モーダルでの見え方</button></div></div>;
    })}</section>}
 {confirming && <NoticeDialog title="本当に公開しますか？" onClose={() => setConfirming(null)} footer={<div className={styles.buttons}><button onClick={() => setConfirming(null)}>やめる</button><button className={styles.primary} onClick={() => { const n = confirming; setConfirming(null); void change(n, true); }}>公開する</button></div>}><p>公開すると、次に Garden を開いた対象の人にお知らせのモーダルが出ます。</p><NoticeCard notice={confirming}/></NoticeDialog>}
 {preview && <NoticeDialog title="Garden からのお知らせ（見え方の確認）" onClose={() => setPreview(null)} footer={<button onClick={() => setPreview(null)}>閉じる</button>}><NoticeCard notice={preview}/></NoticeDialog>}</section>;
}
