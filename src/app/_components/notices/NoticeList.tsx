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
    // 並び＝未確認 → 公開しない → 公開する。「未確認だけ表示」では未確認（まだ決めていない）だけ＝わざと公開しないと決めたものは出さない
    const ORDER = { draft: 0, hidden: 1, published: 2 } as const;
    const all = role === "super_admin"
        ? [...(snapshot?.notices ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
        : [];
    const managed = unreadOnly ? all.filter(n => n.status === "draft") : all;
    const draftCount = all.filter(n => n.status === "draft").length;
    const hiddenCount = all.filter(n => n.status === "hidden").length;

    async function change(notice: Notice, to: Notice["status"]) {
        setBusy(notice.id);
        setFailed(null);
        try {
            if (to === "published")
                await state!.publish(notice.id);
            else
                await state!.unpublish(notice.id, to);
        }
        catch {
            setFailed("切り替えられませんでした。もう一度お試しください。");
        }
        finally {
            setBusy(null);
        }
    }

    // 公開する／公開しない／未確認 の切り替え（全権だけ）。上の一覧（公開中のもの）と公開の管理の両方に出す
    // 東海林さん 2026-10-19「公開するにしたあとに公開しないにできない（ラジオボタンが消える）」→ 上の一覧にも出す
    const publishControl = (notice: Notice, place: string) => {
        const radio = (to: Notice["status"], label: string, onPick: () => void) => <label><input type="radio" name={`publish-${place}-${notice.id}`} checked={notice.status === to} onChange={onPick}/> {label}</label>;
        return <div className={styles.buttons}><fieldset className={styles.publishChoice} disabled={busy !== null}><legend className={styles.srOnly}>{notice.title} の公開</legend>{radio("published", "公開する", () => setConfirming(notice))}{radio("hidden", "公開しない", () => void change(notice, "hidden"))}{radio("draft", "未確認", () => void change(notice, "draft"))}{busy === notice.id && <span>切り替えています…</span>}</fieldset><button onClick={() => setPreview(notice)}>モーダルでの見え方</button></div>;
    };
    const publishedCount = all.filter(n => n.status === "published").length;

    return <section className={styles.page}><h1>お知らせ</h1><div className={styles.filters}><label>種類 <select value={kind} onChange={e => setKind(e.target.value)}><option value="">すべて</option>{Object.entries(NOTICE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>モジュール <select value={module} onChange={e => setModule(e.target.value)}><option value="">すべて</option>{[...new Set(published.map(n => n.module))].sort().map(m => <option key={m}>{m}</option>)}</select></label><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/> 未確認だけ表示</label></div>
 {state.error ? <p role="alert">お知らせを読み込めませんでした。<button onClick={state.refresh}>もう一度読み込む</button></p> : !snapshot ? <p>読み込み中…</p> : !notices.length ? <p>該当するお知らせはありません。</p> : notices.map(notice => <div key={notice.id}><NoticeCard notice={notice} unread={!snapshot.readIds.includes(notice.id)}/>{!snapshot.readIds.includes(notice.id) && <button className={styles.confirm} onClick={() => state.acknowledge([notice.id])}>確認しました</button>}{role === "super_admin" && publishControl(notice, "list")}</div>)}
 {role === "super_admin" && <section className={styles.drafts}><h2>公開の管理（未確認 {draftCount} 件・公開しない {hiddenCount} 件・公開中 {publishedCount} 件）</h2>{failed && <p role="alert">{failed}</p>}{managed.map(notice => <div key={notice.id}><NoticeCard notice={notice}/>{publishControl(notice, "manage")}</div>)}</section>}
 {confirming && <NoticeDialog title="本当に公開しますか？" onClose={() => setConfirming(null)} footer={<div className={styles.buttons}><button onClick={() => setConfirming(null)}>やめる</button><button className={styles.primary} onClick={() => { const n = confirming; setConfirming(null); void change(n, "published"); }}>公開する</button></div>}><p>公開すると、次に Garden を開いた対象の人にお知らせのモーダルが出ます。</p><NoticeCard notice={confirming}/></NoticeDialog>}
 {preview && <NoticeDialog title="Garden からのお知らせ（見え方の確認）" onClose={() => setPreview(null)} footer={<button onClick={() => setPreview(null)}>閉じる</button>}><NoticeCard notice={preview}/></NoticeDialog>}</section>;
}
