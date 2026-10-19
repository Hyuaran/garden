"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { NOTICE_KINDS, type Notice } from "@/lib/notices";
import { useNotices } from "./NoticeProvider";
import { NoticeCard } from "./NoticeCard";
import { NoticeDialog } from "./NoticeDialog";
import styles from "./notices.module.css";

// 公開の管理での呼び名。読む人の「未確認」（まだ確認しました を押していない）とぶつからないよう、決めていないものは「未決定」
// 東海林さん 2026-10-19「未確認なのか、普通のお知らせなのかが全権管理者にはわかりづらい」→ タブ分け・未決定・色つきの札・状態の絞り込み
export const NOTICE_STATUS_LABELS: Record<Notice["status"], string> = { draft: "未決定", published: "公開中", hidden: "公開しない" };
type Tab = "list" | "manage";
type StatusFilter = "all" | Notice["status"];

export function NoticeList() {
    const { loading, isAuthenticated, role } = useAuthUnified();
    const router = useRouter();
    const pathname = usePathname();
    const state = useNotices();
    const [tab, setTab] = useState<Tab>("list");
    const [kind, setKind] = useState("");
    const [module, setModule] = useState("");
    // 既定は「未確認だけ表示」にチェックあり（東海林さん 2026-10-19）
    const [unreadOnly, setUnreadOnly] = useState(true);
    // 公開の管理の既定は「未決定」だけ
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("draft");
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
    const isAdmin = role === "super_admin";
    const notices = published.filter(n => (!kind || n.kind === kind) && (!module || n.module === module) && (!unreadOnly || !snapshot?.readIds.includes(n.id)));
    // 全権には、未決定・公開しない・公開中のすべて（見せる相手に関係なく）を並べる。並び＝未決定 → 公開中 → 公開しない
    const ORDER = { draft: 0, published: 1, hidden: 2 } as const;
    const all = isAdmin
        ? [...(snapshot?.notices ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
        : [];
    const count = (s: Notice["status"]) => all.filter(n => n.status === s).length;
    const managed = statusFilter === "all" ? all : all.filter(n => n.status === statusFilter);

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

    const publishControl = (notice: Notice) => {
        const radio = (to: Notice["status"], onPick: () => void) => <label><input type="radio" name={`publish-${notice.id}`} checked={notice.status === to} onChange={onPick}/> {to === "published" ? "公開する" : NOTICE_STATUS_LABELS[to]}</label>;
        return <div className={styles.buttons}><fieldset className={styles.publishChoice} disabled={busy !== null}><legend className={styles.srOnly}>{notice.title} の公開</legend>{radio("published", () => setConfirming(notice))}{radio("hidden", () => void change(notice, "hidden"))}{radio("draft", () => void change(notice, "draft"))}{busy === notice.id && <span>切り替えています…</span>}</fieldset><button onClick={() => setPreview(notice)}>モーダルでの見え方</button></div>;
    };

    const listView = <>
        <div className={styles.filters}><label>種類 <select value={kind} onChange={e => setKind(e.target.value)}><option value="">すべて</option>{Object.entries(NOTICE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>モジュール <select value={module} onChange={e => setModule(e.target.value)}><option value="">すべて</option>{[...new Set(published.map(n => n.module))].sort().map(m => <option key={m}>{m}</option>)}</select></label><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}/> 未確認だけ表示</label></div>
        {state.error ? <p role="alert">お知らせを読み込めませんでした。<button onClick={state.refresh}>もう一度読み込む</button></p> : !snapshot ? <p>読み込み中…</p> : !notices.length ? <p>{unreadOnly ? "未確認のお知らせはありません。" : "該当するお知らせはありません。"}</p> : notices.map(notice => <div key={notice.id}><NoticeCard notice={notice} unread={!snapshot.readIds.includes(notice.id)}/>{!snapshot.readIds.includes(notice.id) && <button className={styles.confirm} onClick={() => state.acknowledge([notice.id])}>確認しました</button>}</div>)}
    </>;

    const manageView = <section className={styles.manage} aria-label="公開の管理">
        <div className={styles.statusChips} role="group" aria-label="状態で絞り込む">{(["all", "draft", "published", "hidden"] as const).map(s => <button key={s} aria-pressed={statusFilter === s} className={statusFilter === s ? styles.chipOn : undefined} onClick={() => setStatusFilter(s)}>{s === "all" ? `すべて ${all.length}` : `${NOTICE_STATUS_LABELS[s]} ${count(s)}`}</button>)}</div>
        {failed && <p role="alert">{failed}</p>}
        {!managed.length ? <p>{statusFilter === "draft" ? "未決定のお知らせはありません。" : "該当するお知らせはありません。"}</p> : managed.map(notice => <div key={notice.id} className={styles.managed}><span className={`${styles.statusBadge} ${styles[`status_${notice.status}`]}`}>{NOTICE_STATUS_LABELS[notice.status]}</span><NoticeCard notice={notice}/>{publishControl(notice)}</div>)}
    </section>;

    return <section className={styles.page}><h1>お知らせ</h1>
        {isAdmin && <div className={styles.tabs} role="tablist" aria-label="お知らせの表示">{([["list", "お知らせ"], ["manage", `公開の管理（未決定 ${count("draft")}）`]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? styles.tabOn : undefined} onClick={() => setTab(key)}>{label}</button>)}</div>}
        {isAdmin && tab === "manage" ? manageView : listView}
        {confirming && <NoticeDialog title="本当に公開しますか？" onClose={() => setConfirming(null)} footer={<div className={styles.buttons}><button onClick={() => setConfirming(null)}>やめる</button><button className={styles.primary} onClick={() => { const n = confirming; setConfirming(null); void change(n, "published"); }}>公開する</button></div>}><p>公開すると、次に Garden を開いた対象の人にお知らせのモーダルが出ます。</p><NoticeCard notice={confirming}/></NoticeDialog>}
        {preview && <NoticeDialog title="Garden からのお知らせ（見え方の確認）" onClose={() => setPreview(null)} footer={<button onClick={() => setPreview(null)}>閉じる</button>}><NoticeCard notice={preview}/></NoticeDialog>}
    </section>;
}
