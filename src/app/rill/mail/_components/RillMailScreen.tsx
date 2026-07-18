"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { abbreviateBox, formatMailDetailDate, formatMailListDate, reviewerInitials, statusCategory } from "../_lib/format";
import { isMessageUnread, MAIL_STATES, replaceMailState, selectionRange, toggleOwnConfirmation, type MailState, type MailWriteOperation } from "../_lib/write-ops";
import type { RillMailBox, RillMailDetail, RillMailMessage, RillMessagesResponse } from "../_lib/types";
import styles from "./RillMailScreen.module.css";

const ICON = "/themes/garden-shell/images/icons_bloom/orb_rill.png";
const MENU: GardenShellPageMenuItem[] = [
  { label: "Mail", href: "/rill/mail", icon: ICON, active: true },
  { label: "Chat（year-end）", href: "#rill-chat", icon: ICON },
];
const FALLBACK_REVIEWERS = ["東海林美琴", "上田", "簡"];
const keyOf = (message: Pick<RillMailMessage, "id" | "box">) => `${message.box.id}:${message.id}`;

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "メールを更新できませんでした"), { status: response.status });
  return data;
}

export function RillMailScreen() {
  const [boxes, setBoxes] = useState<RillMailBox[]>([]);
  const [reviewers, setReviewers] = useState<string[]>(FALLBACK_REVIEWERS);
  const [ownName, setOwnName] = useState("");
  const [activeBox, setActiveBox] = useState("all");
  const [messages, setMessages] = useState<RillMailMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<RillMailMessage | null>(null);
  const [detail, setDetail] = useState<RillMailDetail | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (box: string, nextCursor?: string | null, append = false) => {
    const params = new URLSearchParams({ box: box === "flagged" ? "all" : box });
    if (nextCursor) params.set("cursor", nextCursor);
    const data = await readJson<RillMessagesResponse>(await fetch(`/api/rill/mail/messages?${params}`, { cache: "no-store" }));
    setMessages((current) => append ? [...current, ...data.messages.filter((item) => !current.some((old) => old.id === item.id && old.box.id === item.box.id))] : data.messages);
    setCursor(data.cursor); setUpdatedAt(new Date());
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await readJson<{ boxes: RillMailBox[]; reviewers: string[]; ownName: string | null }>(await fetch("/api/rill/mail/boxes", { cache: "no-store" }));
      setBoxes(data.boxes); setReviewers(data.reviewers.length ? data.reviewers : FALLBACK_REVIEWERS); setOwnName(data.ownName ?? ""); setConnected(true);
      await loadMessages(activeBox);
    } catch (cause) {
      if ((cause as { status?: number }).status === 428) setConnected(false);
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

  const fetchDetail = useCallback(async (message: RillMailMessage) => {
    const params = new URLSearchParams({ box: message.box.id });
    const value = await readJson<RillMailDetail>(await fetch(`/api/rill/mail/messages/${encodeURIComponent(message.id)}?${params}`, { cache: "no-store" }));
    setDetail(value);
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetail(null); void fetchDetail(selected).catch((cause) => setError(cause instanceof Error ? cause.message : "本文を取得できませんでした"));
  }, [fetchDetail, selected]);

  const patchOne = useCallback(async (message: RillMailMessage, op: MailWriteOperation, value: boolean | MailState | null) => {
    const field = op === "state" ? "state" : op === "read" ? "read" : "on";
    const params = new URLSearchParams({ box: message.box.id });
    await readJson(await fetch(`/api/rill/mail/messages/${encodeURIComponent(message.id)}/${op}?${params}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) }));
  }, []);

  const refreshAfterWrite = useCallback(async (message?: RillMailMessage) => {
    await loadMessages(activeBox);
    if (message && selected && keyOf(message) === keyOf(selected)) await fetchDetail(message);
  }, [activeBox, fetchDetail, loadMessages, selected]);

  const writeOne = async (message: RillMailMessage, op: MailWriteOperation, value: boolean | MailState | null) => {
    if (writing) return;
    setWriting(true); setError("");
    try {
      await patchOne(message, op, value);
      const updated: RillMailMessage = op === "flag" ? { ...message, flag: { flagStatus: value ? "flagged" : "notFlagged" } }
        : op === "read" ? { ...message, isRead: Boolean(value) }
        : op === "state" ? { ...message, categories: replaceMailState(message.categories, value as MailState | null) }
        : { ...message, categories: toggleOwnConfirmation(message.categories, ownName, Boolean(value)) };
      setSelected((current) => current && keyOf(current) === keyOf(message) ? updated : current);
      setMessages((current) => current.map((item) => keyOf(item) === keyOf(message) ? updated : item));
      await refreshAfterWrite(updated);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "更新できませんでした"); }
    finally { setWriting(false); }
  };

  const openMessage = async (message: RillMailMessage) => {
    setSelected(message);
    if (!ownName || !isMessageUnread(message, ownName)) return;
    await writeOne(message, message.box.kind === "personal" ? "read" : "confirm", true);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    const source = activeBox === "flagged" ? messages.filter((item) => item.flag.flagStatus === "flagged") : messages;
    return needle ? source.filter((item) => [item.fromName, item.fromAddress, item.subject, item.bodyPreview].some((value) => value.toLocaleLowerCase("ja").includes(needle))) : source;
  }, [activeBox, messages, query]);
  const filteredKeys = useMemo(() => filtered.map(keyOf), [filtered]);

  const togglePicked = (message: RillMailMessage, event: React.MouseEvent) => {
    event.stopPropagation();
    const key = keyOf(message);
    setPicked((current) => {
      const next = new Set(current);
      if (event.shiftKey && anchor) selectionRange(filteredKeys, anchor, key).forEach((item) => next.add(item));
      else if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setAnchor(key);
  };

  const bulkWrite = async (op: MailWriteOperation, value: boolean | MailState | null) => {
    const targets = messages.filter((message) => picked.has(keyOf(message)));
    if (!targets.length || writing) return;
    setWriting(true); setError("");
    try {
      const groups = new Map<string, RillMailMessage[]>();
      targets.forEach((message) => groups.set(message.box.id, [...(groups.get(message.box.id) ?? []), message]));
      const responses = await Promise.all([...groups].map(async ([box, items]) => {
        const actualOp = op === "read" && items[0].box.kind === "shared" ? "confirm" : op;
        return readJson<{ results: { ok: boolean; error?: string }[] }>(await fetch("/api/rill/mail/messages/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: items.map((item) => item.id), box, op: actualOp, value }) }));
      }));
      const failures = responses.flatMap((response) => response.results).filter((result) => !result.ok);
      if (failures.length) setError(`${failures.length}件を更新できませんでした`);
      else setPicked(new Set());
      await refreshAfterWrite(selected ?? undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "一括更新できませんでした"); }
    finally { setWriting(false); }
  };

  const selectBox = (id: string) => { setActiveBox(id); setMessages([]); setSelected(null); setPicked(new Set()); setCursor(null); };
  const currentFlagged = selected?.flag.flagStatus === "flagged";
  const selectedUnread = Boolean(selected && ownName && isMessageUnread(selected, ownName));
  const attachmentUrl = (item: RillMailDetail["attachments"][number]) => `/api/rill/mail/messages/${encodeURIComponent(detail!.id)}/attachments/${encodeURIComponent(item.id)}?box=${encodeURIComponent(detail!.box.id)}`;

  return <GardenShell activeModule="rill" pageMenu={MENU} activityItems={[]} contentFullBleed>
    <section className={styles.surface} aria-label="Rill Mail">
      <div className={styles.toolbar}>
        <button className={styles.primaryButton} onClick={() => void initialize()} disabled={loading || writing}>↻ 更新</button>
        <span className={styles.fresh}>{updatedAt ? `最終更新 ${updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・60秒ごと` : "未更新"}</span><span className={styles.separator} />
        {["新規", "返信", "全員に返信", "転送"].map((label) => <button key={label} className={styles.disabledButton} disabled title="次段階">{label}</button>)}
        <button className={styles.actionButton} disabled={!selected || writing} onClick={() => selected && void writeOne(selected, selected.box.kind === "personal" ? "read" : "confirm", selectedUnread)}>○ {selectedUnread ? "開封済みに" : "未読に戻す"}</button>
        <button className={`${styles.actionButton} ${currentFlagged ? styles.actionOn : ""}`} disabled={!selected || writing} onClick={() => selected && void writeOne(selected, "flag", !currentFlagged)}>⚑ ピン</button>
        <span className={styles.toolbarStates}>{MAIL_STATES.map((state) => <button key={state} className={selected && statusCategory(selected.categories) === state ? styles.actionOn : ""} disabled={!selected || writing} onClick={() => selected && void writeOne(selected, "state", statusCategory(selected.categories) === state ? null : state)}>{state}</button>)}</span>
        <button className={styles.moreButton} disabled title="アーカイブ・削除は次段階">…</button>
        <label className={styles.search}><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="メールを検索" /></label>
      </div>
      {connected === false ? <div className={styles.connect}><div className={styles.connectOrb}>✉</div><h1>Microsoft メールを接続</h1><p>本人の Microsoft アカウントでサインインすると、許可された受信箱を Garden から閲覧できます。</p><a href="/api/rill/mail/auth/login">Microsoft に接続</a></div> :
      <div className={styles.panes}>
        <aside className={styles.column}><header className={styles.columnHeader}>受信箱 <span>{messages.length}</span></header><div className={styles.scroll}>
          <div className={styles.group}>まとめて見る</div><button className={`${styles.box} ${activeBox === "all" ? styles.active : ""}`} onClick={() => selectBox("all")}><span className={styles.dot} />すべての箱</button><button className={`${styles.box} ${activeBox === "flagged" ? styles.active : ""}`} onClick={() => selectBox("flagged")}><span className={styles.flag}>⚑</span>ピン止め</button>
          <div className={styles.group}>自分</div>{boxes.filter((box) => box.kind === "personal").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.personalDot} />{box.label}</button>)}
          <div className={styles.group}>共有</div>{boxes.filter((box) => box.kind === "shared").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.sharedDot} />{box.label}</button>)}
        </div><footer className={styles.foot}>メールは Garden に保存せず<br />Microsoft から都度取得します</footer></aside>
        <section className={styles.column}><header className={styles.columnHeader}>メール一覧 <span>{filtered.length}件</span></header>
          {picked.size > 0 && <div className={styles.bulk}><b>{picked.size}件選択</b><button onClick={() => void bulkWrite("read", true)}>開封済みに</button><button onClick={() => void bulkWrite("flag", true)}>⚑ ピン</button>{MAIL_STATES.map((state) => <button key={state} onClick={() => void bulkWrite("state", state)}>{state}</button>)}<button onClick={() => void bulkWrite("confirm", true)}>確認</button><button className={styles.bulkClose} onClick={() => setPicked(new Set())}>×</button></div>}
          <div className={styles.scroll}>{loading && !messages.length && <div className={styles.notice}>読み込み中…</div>}{error && <div className={styles.error}>{error}</div>}
          {filtered.map((message) => { const status = statusCategory(message.categories); const initials = reviewerInitials(message.categories, reviewers); const key = keyOf(message); const unread = ownName ? isMessageUnread(message, ownName) : !message.isRead; return <div key={key} role="button" tabIndex={0} className={`${styles.mail} ${selected && keyOf(selected) === key ? styles.selectedMail : ""} ${unread ? styles.unread : ""} ${picked.has(key) ? styles.picked : ""}`} onClick={(event) => event.ctrlKey || event.metaKey || event.shiftKey ? togglePicked(message, event) : void openMessage(message)} onKeyDown={(event) => { if (event.key === "Enter") void openMessage(message); }}>
            <span className={styles.row}><button className={`${styles.checkbox} ${picked.has(key) ? styles.checked : ""}`} onClick={(event) => togglePicked(message, event)} aria-label="選択" /><span className={styles.from}>{message.fromName}</span><span className={styles.badge}>{abbreviateBox(message.box.label)}</span><time>{formatMailListDate(message.receivedDateTime)}</time><button className={`${styles.inlineFlag} ${message.flag.flagStatus === "flagged" ? styles.flag : ""}`} onClick={(event) => { event.stopPropagation(); void writeOne(message, "flag", message.flag.flagStatus !== "flagged"); }}>⚑</button></span>
            <span className={styles.row}><span className={styles.subject}>{message.hasAttachments && "⌕ "}{message.subject}</span>{status && <span className={`${styles.status} ${styles[`status${status}`]}`}>{status}</span>}</span><span className={styles.row}><span className={styles.preview}>{message.bodyPreview}</span><span className={styles.reviewers}>{initials.map((initial, index) => <i key={`${initial}${index}`}>{initial}</i>)}</span></span>
          </div>; })}<div ref={sentinel} className={styles.sentinel}>{loadingMore ? "続きを読み込み中…" : ""}</div></div>
        </section>
        <article className={styles.column}>{!selected ? <div className={styles.emptyDetail}>メールを選ぶと、ここに本文が表示されます。</div> : !detail ? <div className={styles.emptyDetail}>本文を読み込み中…</div> : <><header className={styles.readerHeader}>
          <div className={styles.readerTitle}><h2>{detail.hasAttachments && "⌕ "}{detail.subject}</h2><button className={`${styles.inlineFlag} ${detail.flag.flagStatus === "flagged" ? styles.flag : ""}`} onClick={() => void writeOne(detail, "flag", detail.flag.flagStatus !== "flagged")}>⚑</button><span className={styles.badge}>{abbreviateBox(detail.box.label)}</span></div>
          <dl><div><dt>差出人</dt><dd>{detail.fromName} &lt;{detail.fromAddress}&gt;</dd></div><div><dt>宛先</dt><dd>{detail.to.join(", ")}</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(detail.receivedDateTime)}</dd></div></dl>
          <div className={styles.categoryLine}><span className={styles.states}>{MAIL_STATES.map((state) => <button key={state} className={detail.categories.includes(state) ? styles.stateOn : ""} onClick={() => void writeOne(detail, "state", detail.categories.includes(state) ? null : state)}>{state}</button>)}</span><span className={styles.reviewersLarge}>{reviewers.filter((name) => detail.categories.includes(name) || name === ownName).map((name) => <button key={name} title={name} className={`${detail.categories.includes(name) ? styles.reviewerOn : styles.reviewerEmpty} ${name === ownName ? styles.reviewerMine : styles.reviewerLocked}`} disabled={name !== ownName} onClick={() => void writeOne(detail, "confirm", !detail.categories.includes(name))}>{Array.from(name)[0]}</button>)}</span></div>
        </header><div className={styles.readerBody}>{detail.body.contentType === "html" ? <div className={styles.htmlBody} dangerouslySetInnerHTML={{ __html: detail.body.content }} /> : <div className={styles.textBody}>{detail.body.content}</div>}{!!detail.attachments.length && <section className={styles.attachments}><h3>添付ファイル</h3>{detail.attachments.map((item) => <div className={styles.attachment} key={item.id}><span>⌕</span><a href={attachmentUrl(item)}>{item.name}</a><small>{Math.max(1, Math.round(item.size / 1024))} KB</small><button disabled>Bud の未処理トレイへ</button></div>)}</section>}</div></>}
        </article>
      </div>}
    </section>
  </GardenShell>;
}
