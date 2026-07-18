"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { abbreviateBox, formatMailDetailDate, formatMailListDate, reviewerInitials, statusCategory } from "../_lib/format";
import type { RillMailBox, RillMailDetail, RillMailMessage, RillMessagesResponse } from "../_lib/types";
import styles from "./RillMailScreen.module.css";

const ICON = "/themes/garden-shell/images/icons_bloom/orb_rill.png";
const MENU: GardenShellPageMenuItem[] = [
  { label: "Rill", href: "/rill", icon: ICON },
  { label: "区切り線", href: "#rill-divider", divider: true },
  { label: "Mail", href: "/rill/mail", icon: ICON, active: true },
  { label: "Chat（year-end）", href: "#rill-chat", icon: ICON },
];
const FALLBACK_REVIEWERS = ["東海林美琴", "上田", "簡"];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "メールを取得できませんでした"), { status: response.status });
  return data;
}

export function RillMailScreen() {
  const [boxes, setBoxes] = useState<RillMailBox[]>([]);
  const [reviewers, setReviewers] = useState<string[]>(FALLBACK_REVIEWERS);
  const [activeBox, setActiveBox] = useState("all");
  const [messages, setMessages] = useState<RillMailMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<RillMailMessage | null>(null);
  const [detail, setDetail] = useState<RillMailDetail | null>(null);
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (box: string, nextCursor?: string | null, append = false) => {
    const params = new URLSearchParams({ box });
    if (nextCursor) params.set("cursor", nextCursor);
    const data = await readJson<RillMessagesResponse>(await fetch(`/api/rill/mail/messages?${params}`, { cache: "no-store" }));
    setMessages((current) => append ? [...current, ...data.messages.filter((item) => !current.some((old) => old.id === item.id && old.box.id === item.box.id))] : data.messages);
    setCursor(data.cursor);
    setUpdatedAt(new Date());
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await readJson<{ boxes: RillMailBox[]; reviewers: string[] }>(await fetch("/api/rill/mail/boxes", { cache: "no-store" }));
      setBoxes(data.boxes); setReviewers(data.reviewers.length ? data.reviewers : FALLBACK_REVIEWERS); setConnected(true);
      await loadMessages(activeBox);
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status === 428) setConnected(false);
      else setError(cause instanceof Error ? cause.message : "メールを取得できませんでした");
    } finally { setLoading(false); }
  }, [activeBox, loadMessages]);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { const timer = window.setInterval(() => { if (connected) void loadMessages(activeBox); }, 60_000); return () => window.clearInterval(timer); }, [activeBox, connected, loadMessages]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setLoadingMore(true);
      void loadMessages(activeBox, cursor, true).catch((cause) => setError(cause instanceof Error ? cause.message : "続きを取得できませんでした")).finally(() => setLoadingMore(false));
    }, { rootMargin: "240px" });
    observer.observe(node); return () => observer.disconnect();
  }, [activeBox, cursor, loadMessages, loadingMore]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetail(null);
    const params = new URLSearchParams({ box: selected.box.id });
    void fetch(`/api/rill/mail/messages/${encodeURIComponent(selected.id)}?${params}`, { cache: "no-store" })
      .then((response) => readJson<RillMailDetail>(response))
      .then(setDetail)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "本文を取得できませんでした"));
  }, [selected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    if (!needle) return messages;
    return messages.filter((item) => [item.fromName, item.fromAddress, item.subject, item.bodyPreview].some((value) => value.toLocaleLowerCase("ja").includes(needle)));
  }, [messages, query]);

  const selectBox = (id: string) => { setActiveBox(id); setMessages([]); setSelected(null); setCursor(null); };
  const attachmentUrl = (item: RillMailDetail["attachments"][number]) => `/api/rill/mail/messages/${encodeURIComponent(detail!.id)}/attachments/${encodeURIComponent(item.id)}?box=${encodeURIComponent(detail!.box.id)}`;

  return (
    <GardenShell activeModule="rill" pageMenu={MENU} activityItems={[]}>
      <section className={styles.surface} aria-label="Rill Mail">
        <div className={styles.toolbar}>
          <button className={styles.primaryButton} type="button" onClick={() => void initialize()} disabled={loading}>↻ 更新</button>
          <span className={styles.fresh}>{updatedAt ? `最終更新 ${updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・60秒ごと` : "未更新"}</span>
          <span className={styles.separator} />
          {[["＋", "新規"], ["↩", "返信"], ["↩↩", "全員に返信"], ["↪", "転送"], ["○", "未読/開封済み"], ["⚑", "ピン"], ["◇", "分類"]].map(([icon, label]) => <button key={label} className={styles.disabledButton} disabled title="Codex-132 で実装予定">{icon} <span>{label}</span></button>)}
          <button className={styles.moreButton} disabled title="アーカイブ・削除は次段階">…</button>
          <label className={styles.search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="メールを検索" /></label>
        </div>

        {connected === false ? (
          <div className={styles.connect}><div className={styles.connectOrb}>✉</div><h1>Microsoft メールを接続</h1><p>本人の Microsoft アカウントでサインインすると、許可された受信箱を Garden から閲覧できます。</p><a href="/api/rill/mail/auth/login">Microsoft に接続</a></div>
        ) : (
          <div className={styles.panes}>
            <aside className={styles.column}>
              <header className={styles.columnHeader}>受信箱 <span>{messages.length}</span></header>
              <div className={styles.scroll}>
                <div className={styles.group}>まとめて見る</div>
                <button className={`${styles.box} ${activeBox === "all" ? styles.active : ""}`} onClick={() => selectBox("all")}><span className={styles.dot} />すべての箱</button>
                <button className={`${styles.box} ${styles.disabledBox}`} disabled><span>⚑</span>ピン止め<span className={styles.lock}>132</span></button>
                <div className={styles.group}>自分</div>
                {boxes.filter((box) => box.kind === "personal").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.personalDot} /><span>{box.label}</span></button>)}
                <div className={styles.group}>共有</div>
                {boxes.filter((box) => box.kind === "shared").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.sharedDot} /><span>{box.label}</span></button>)}
              </div>
              <footer className={styles.foot}>メールは Garden に保存せず<br />Microsoft から都度取得します</footer>
            </aside>

            <section className={styles.column}>
              <header className={styles.columnHeader}>メール一覧 <span>{filtered.length}件</span></header>
              <div className={styles.scroll}>
                {loading && !messages.length && <div className={styles.notice}>読み込み中…</div>}
                {error && <div className={styles.error}>{error}</div>}
                {!loading && !error && !filtered.length && <div className={styles.notice}>メールがありません</div>}
                {filtered.map((message) => {
                  const status = statusCategory(message.categories);
                  const initials = reviewerInitials(message.categories, reviewers);
                  return <button key={`${message.box.id}:${message.id}`} className={`${styles.mail} ${selected?.id === message.id && selected.box.id === message.box.id ? styles.selectedMail : ""} ${!message.isRead ? styles.unread : ""}`} onClick={() => setSelected(message)}>
                    <span className={styles.row}><span className={styles.from}>{message.fromName}</span><span className={styles.badge}>{abbreviateBox(message.box.label)}</span><time>{formatMailListDate(message.receivedDateTime)}</time>{message.flag.flagStatus === "flagged" && <span className={styles.flag}>⚑</span>}</span>
                    <span className={styles.row}><span className={styles.subject}>{message.hasAttachments && "⌕ "}{message.subject}</span>{status && <span className={`${styles.status} ${styles[`status${status}`]}`}>{status}</span>}</span>
                    <span className={styles.row}><span className={styles.preview}>{message.bodyPreview}</span><span className={styles.reviewers}>{initials.map((initial, index) => <i key={`${initial}${index}`}>{initial}</i>)}</span></span>
                  </button>;
                })}
                <div ref={sentinel} className={styles.sentinel}>{loadingMore ? "続きを読み込み中…" : ""}</div>
              </div>
            </section>

            <article className={styles.column}>
              {!selected ? <div className={styles.emptyDetail}>メールを選ぶと、ここに本文が表示されます。</div> : !detail ? <div className={styles.emptyDetail}>本文を読み込み中…</div> : <>
                <header className={styles.readerHeader}>
                  <div className={styles.readerTitle}><h2>{detail.hasAttachments && "⌕ "}{detail.subject}</h2>{detail.flag.flagStatus === "flagged" && <span className={styles.flag}>⚑</span>}<span className={styles.badge}>{abbreviateBox(detail.box.label)}</span></div>
                  <dl><div><dt>差出人</dt><dd>{detail.fromName} &lt;{detail.fromAddress}&gt;</dd></div><div><dt>宛先</dt><dd>{detail.to.join(", ")}</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(detail.receivedDateTime)}</dd></div></dl>
                  <div className={styles.categoryLine}>{["要対応", "確認中", "処理済"].map((value) => <span key={value} className={`${styles.statePill} ${detail.categories.includes(value) ? styles.stateOn : ""}`}>{value}</span>)}<span className={styles.reviewersLarge}>{reviewerInitials(detail.categories, reviewers).map((initial, index) => <i key={`${initial}${index}`}>{initial}</i>)}</span><small>表示のみ</small></div>
                </header>
                <div className={styles.readerBody}>
                  {detail.body.contentType === "html" ? <div className={styles.htmlBody} dangerouslySetInnerHTML={{ __html: detail.body.content }} /> : <div className={styles.textBody}>{detail.body.content}</div>}
                  {!!detail.attachments.length && <section className={styles.attachments}><h3>添付ファイル</h3>{detail.attachments.map((item) => <div className={styles.attachment} key={item.id}><span>⌕</span><a href={attachmentUrl(item)}>{item.name}</a><small>{Math.max(1, Math.round(item.size / 1024))} KB</small><button disabled>Bud の未処理トレイへ</button></div>)}</section>}
                </div>
              </>}
            </article>
          </div>
        )}
      </section>
    </GardenShell>
  );
}
