"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { abbreviateBox, daySeparatedMessages, formatMailDetailDate, formatMailListDate, mergeMessagePages, pruneToRefreshWindow, reviewerInitials, reviewerNames, reviewerTone, statusCategory } from "../_lib/format";
import { applyLocalMailMutation, filterOwnPinned, hasOwnPin, isMessageUnread, MAIL_STATES, selectionRange, type MailState, type MailWriteOperation } from "../_lib/write-ops";
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
  const [pendingWrites, setPendingWrites] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [autoRefreshFailed, setAutoRefreshFailed] = useState(false);
  const [importingFlags, setImportingFlags] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);
  const pendingWriteKeys = useRef(new Set<string>());

  const loadMessages = useCallback(async (box: string, nextCursor?: string | null, mode: "replace" | "append" | "refresh" = "replace") => {
    const generation = requestGeneration.current;
    const params = new URLSearchParams({ box: box === "flagged" ? "all" : box });
    if (nextCursor) params.set("cursor", nextCursor);
    const data = await readJson<RillMessagesResponse>(await fetch(`/api/rill/mail/messages?${params}`, { cache: "no-store" }));
    if (generation !== requestGeneration.current) return;
    setMessages((current) => {
      if (mode === "replace") return data.messages;
      const retained = mode === "refresh" ? pruneToRefreshWindow(current, data.messages, data.boxIds) : current;
      return mergeMessagePages(retained, data.messages);
    });
    if (mode !== "refresh") setCursor(data.cursor);
    setUpdatedAt(new Date());
  }, []);

  const initialize = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError("");
    try {
      const data = await readJson<{ boxes: RillMailBox[]; reviewers: string[]; ownName: string | null }>(await fetch("/api/rill/mail/boxes", { cache: "no-store" }));
      if (generation !== requestGeneration.current) return;
      setBoxes(data.boxes); setReviewers(data.reviewers.length ? data.reviewers : FALLBACK_REVIEWERS); setOwnName(data.ownName ?? ""); setConnected(true); setAutoRefreshFailed(false);
      await loadMessages(activeBox);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      if ((cause as { status?: number }).status === 428) setConnected(false);
      else setError(cause instanceof Error ? cause.message : "メールを取得できませんでした");
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [activeBox, loadMessages]);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!connected) return;
      void loadMessages(activeBox, null, "refresh")
        .then(() => setAutoRefreshFailed(false))
        .catch((cause) => {
          if ((cause as { status?: number }).status === 428) setConnected(false);
          else setAutoRefreshFailed(true);
        });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activeBox, connected, loadMessages]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || loadingMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setLoadingMore(true);
      void loadMessages(activeBox, cursor, "append").catch((cause) => setError(cause instanceof Error ? cause.message : "続きを取得できませんでした")).finally(() => setLoadingMore(false));
    }, { rootMargin: "300px" });
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
    await loadMessages(activeBox, null, "refresh");
    if (message && selected && keyOf(message) === keyOf(selected)) await fetchDetail(message);
  }, [activeBox, fetchDetail, loadMessages, selected]);

  const applyLocal = useCallback((before: RillMailMessage, after: RillMailMessage) => {
    const key = keyOf(before);
    setMessages((current) => current.map((item) => keyOf(item) === key ? after : item));
    setSelected((current) => current && keyOf(current) === key ? after : current);
    setDetail((current) => current && keyOf(current) === key ? { ...current, ...after } : current);
  }, []);

  const markPending = useCallback((keys: string[], on: boolean) => {
    keys.forEach((key) => on ? pendingWriteKeys.current.add(key) : pendingWriteKeys.current.delete(key));
    setPendingWrites(new Set(pendingWriteKeys.current));
  }, []);

  const writeOne = async (message: RillMailMessage, op: MailWriteOperation, value: boolean | MailState | null) => {
    const key = keyOf(message);
    if (pendingWriteKeys.current.has(key)) return;
    const updated = applyLocalMailMutation(message, op, value, ownName);
    markPending([key], true); setError(""); applyLocal(message, updated);
    try {
      await patchOne(message, op, value);
      void refreshAfterWrite(updated).catch(() => setAutoRefreshFailed(true));
    }
    catch (cause) { applyLocal(updated, message); setError(cause instanceof Error ? cause.message : "更新できませんでした"); }
    finally { markPending([key], false); }
  };

  const openMessage = async (message: RillMailMessage) => {
    setSelected(message);
    if (!ownName || !isMessageUnread(message, ownName)) return;
    await writeOne(message, message.box.kind === "personal" ? "read" : "confirm", true);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja");
    const source = activeBox === "flagged" ? filterOwnPinned(messages, ownName) : messages;
    return needle ? source.filter((item) => [item.fromName, item.fromAddress, item.subject, item.bodyPreview].some((value) => value.toLocaleLowerCase("ja").includes(needle))) : source;
  }, [activeBox, messages, ownName, query]);
  const filteredKeys = useMemo(() => filtered.map(keyOf), [filtered]);
  const datedMessages = useMemo(() => daySeparatedMessages(filtered), [filtered]);

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
    const targets = messages.filter((message) => picked.has(keyOf(message)) && !pendingWriteKeys.current.has(keyOf(message)));
    if (!targets.length) return;
    const snapshots = new Map(targets.map((message) => [keyOf(message), message]));
    const optimistic = new Map(targets.map((message) => {
      const actualOp = op === "read" && message.box.kind === "shared" ? "confirm" : op;
      return [keyOf(message), applyLocalMailMutation(message, actualOp, value, ownName)];
    }));
    const keys = [...snapshots.keys()];
    markPending(keys, true); setError("");
    setMessages((current) => current.map((message) => optimistic.get(keyOf(message)) ?? message));
    setSelected((current) => current ? optimistic.get(keyOf(current)) ?? current : current);
    setDetail((current) => current ? { ...current, ...(optimistic.get(keyOf(current)) ?? {}) } : current);
    try {
      const groups = new Map<string, RillMailMessage[]>();
      targets.forEach((message) => groups.set(message.box.id, [...(groups.get(message.box.id) ?? []), message]));
      const responses = await Promise.all([...groups].map(async ([box, items]) => {
        const actualOp = op === "read" && items[0].box.kind === "shared" ? "confirm" : op;
        return readJson<{ results: { id: string; boxId: string; ok: boolean; error?: string }[] }>(await fetch("/api/rill/mail/messages/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: items.map((item) => item.id), box, op: actualOp, value }) }));
      }));
      const failures = responses.flatMap((response) => response.results).filter((result) => !result.ok);
      const failedKeys = new Set(failures.map((result) => `${result.boxId}:${result.id}`));
      if (failedKeys.size) {
        setMessages((current) => current.map((message) => failedKeys.has(keyOf(message)) ? snapshots.get(keyOf(message)) ?? message : message));
        setSelected((current) => current && failedKeys.has(keyOf(current)) ? snapshots.get(keyOf(current)) ?? current : current);
        setDetail((current) => current && failedKeys.has(keyOf(current)) ? { ...current, ...(snapshots.get(keyOf(current)) ?? {}) } : current);
        setError(`${failedKeys.size}件を更新できませんでした`);
      }
      else setPicked(new Set());
      void refreshAfterWrite(selected ?? undefined).catch(() => setAutoRefreshFailed(true));
    } catch (cause) {
      setMessages((current) => current.map((message) => snapshots.get(keyOf(message)) ?? message));
      setSelected((current) => current ? snapshots.get(keyOf(current)) ?? current : current);
      setDetail((current) => current ? { ...current, ...(snapshots.get(keyOf(current)) ?? {}) } : current);
      setError(cause instanceof Error ? cause.message : "一括更新できませんでした");
    }
    finally { markPending(keys, false); }
  };

  const importLegacyFlags = async () => {
    if (importingFlags) return;
    setImportingFlags(true); setImportResult(""); setError("");
    try {
      const result = await readJson<{ imported: number; alreadyPinned: number; totalFlagged: number; failed: number }>(await fetch("/api/rill/mail/pins/import-flags", { method: "POST" }));
      setImportResult(`${result.imported}件を取り込みました${result.alreadyPinned ? `（取込済み ${result.alreadyPinned}件）` : ""}${result.failed ? `・失敗 ${result.failed}件` : ""}`);
      await loadMessages(activeBox);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Outlookのフラグを取り込めませんでした");
    } finally { setImportingFlags(false); }
  };

  const selectBox = (id: string) => { requestGeneration.current += 1; setActiveBox(id); setMessages([]); setSelected(null); setPicked(new Set()); setCursor(null); };
  const currentPinned = Boolean(selected && ownName && hasOwnPin(selected.categories, ownName));
  const selectedUnread = Boolean(selected && ownName && isMessageUnread(selected, ownName));
  const attachmentUrl = (item: RillMailDetail["attachments"][number]) => `/api/rill/mail/messages/${encodeURIComponent(detail!.id)}/attachments/${encodeURIComponent(item.id)}?box=${encodeURIComponent(detail!.box.id)}`;

  return <GardenShell activeModule="rill" pageMenu={MENU} activityItems={[]} contentFullBleed>
    <section className={styles.surface} aria-label="Rill Mail">
      <div className={styles.toolbar}>
        <button className={styles.primaryButton} onClick={() => void initialize()} disabled={loading}>↻ 更新</button>
        <span className={styles.fresh}>{updatedAt ? `最終更新 ${updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・60秒ごと` : "未更新"}</span>{autoRefreshFailed && <span className={styles.autoWarning}>更新に失敗（自動で再試行します）</span>}<span className={styles.separator} />
        {["新規", "返信", "全員に返信", "転送"].map((label) => <button key={label} className={styles.disabledButton} disabled title="次段階">{label}</button>)}
        <button className={styles.actionButton} disabled={!selected || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, selected.box.kind === "personal" ? "read" : "confirm", selectedUnread)}>○ {selectedUnread ? "開封済みに" : "未読に戻す"}</button>
        <button className={`${styles.actionButton} ${currentPinned ? styles.actionOn : ""}`} disabled={!selected || !ownName || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, "pin", !currentPinned)}>⚑ ピン</button>
        <span className={styles.toolbarStates}>{MAIL_STATES.map((state) => <button key={state} className={selected && statusCategory(selected.categories) === state ? styles.actionOn : ""} disabled={!selected || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, "state", statusCategory(selected.categories) === state ? null : state)}>{state}</button>)}</span>
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
        <section className={styles.column}><header className={styles.columnHeader}>メール一覧 <span>{filtered.length}件</span>{activeBox === "flagged" && filtered.length > 0 && <button className={styles.importAgain} disabled={importingFlags} onClick={() => void importLegacyFlags()}>旧フラグ取込</button>}</header>
          {picked.size > 0 && <div className={styles.bulk}><b>{picked.size}件選択</b><button onClick={() => void bulkWrite("read", true)}>開封済みに</button><button onClick={() => void bulkWrite("pin", true)}>⚑ ピン</button>{MAIL_STATES.map((state) => <button key={state} onClick={() => void bulkWrite("state", state)}>{state}</button>)}<button onClick={() => void bulkWrite("confirm", true)}>確認</button><button className={styles.bulkClose} onClick={() => setPicked(new Set())}>×</button></div>}
          <div className={styles.scroll}>{loading && !messages.length && <div className={styles.notice}>読み込み中…</div>}{error && <div className={styles.error}>{error}</div>}
          {activeBox === "flagged" && !loading && filtered.length === 0 && <div className={styles.importCard}><span>⚑</span><h2>自分のピンはまだありません</h2><p>Outlookで付けたフラグを、自分だけのピンとして取り込めます。元のフラグは変更しません。</p><button disabled={importingFlags} onClick={() => void importLegacyFlags()}>{importingFlags ? "取り込み中…" : "Outlookのフラグから取り込む"}</button>{importResult && <small>{importResult}</small>}</div>}
          {activeBox === "flagged" && filtered.length > 0 && importResult && <div className={styles.importResult}>{importResult}</div>}
          {datedMessages.map(({ message, label, showDay }) => { const status = statusCategory(message.categories); const confirmedBy = reviewerNames(message.categories, reviewers); const initials = reviewerInitials(message.categories, reviewers); const key = keyOf(message); const unread = ownName ? isMessageUnread(message, ownName) : !message.isRead; return <Fragment key={key}>{showDay && <div className={styles.daySeparator}>{label}</div>}<div role="button" tabIndex={0} className={`${styles.mail} ${selected && keyOf(selected) === key ? styles.selectedMail : ""} ${unread ? styles.unread : ""} ${picked.has(key) ? styles.picked : ""}`} onClick={(event) => event.ctrlKey || event.metaKey || event.shiftKey ? togglePicked(message, event) : void openMessage(message)} onKeyDown={(event) => { if (event.key === "Enter") void openMessage(message); }}>
            <span className={styles.row}><button className={`${styles.checkbox} ${picked.has(key) ? styles.checked : ""}`} onClick={(event) => togglePicked(message, event)} aria-label="選択" /><span className={styles.from}>{message.fromName}</span><span className={styles.badge}>{abbreviateBox(message.box.address)}</span><time>{formatMailListDate(message.receivedDateTime)}</time><button disabled={!ownName || pendingWrites.has(key)} className={`${styles.inlineFlag} ${ownName && hasOwnPin(message.categories, ownName) ? styles.flag : ""}`} onClick={(event) => { event.stopPropagation(); void writeOne(message, "pin", !hasOwnPin(message.categories, ownName)); }}>⚑</button></span>
            <span className={styles.row}><span className={styles.subject}>{message.hasAttachments && "⌕ "}{message.subject}</span>{status && <span className={`${styles.status} ${styles[`status${status}`]}`}>{status}</span>}</span><span className={styles.row}><span className={styles.preview}>{message.bodyPreview}</span><span className={styles.reviewers}>{confirmedBy.map((name, index) => <i key={name} className={styles[`reviewerTone${reviewerTone(name, reviewers)}`]} title={name}>{initials[index]}</i>)}</span></span>
          </div></Fragment>; })}<div ref={sentinel} className={styles.sentinel}>{loadingMore ? "続きを読み込み中…" : ""}</div></div>
        </section>
        <article className={styles.column}>{!selected ? <div className={styles.emptyDetail}>メールを選ぶと、ここに本文が表示されます。</div> : !detail ? <><header className={styles.readerHeader}><div className={styles.readerTitle}><h2>{selected.hasAttachments && "⌕ "}{selected.subject}</h2><span className={styles.badge}>{abbreviateBox(selected.box.address)}</span></div><dl><div><dt>差出人</dt><dd>{selected.fromName} &lt;{selected.fromAddress}&gt;</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(selected.receivedDateTime)}</dd></div></dl></header><div className={styles.readerBody}><p className={styles.previewLead}>{selected.bodyPreview || "本文を読み込んでいます…"}</p><div className={styles.skeletonLine} /><div className={`${styles.skeletonLine} ${styles.skeletonShort}`} /></div></> : <><header className={styles.readerHeader}>
          <div className={styles.readerTitle}><h2>{detail.hasAttachments && "⌕ "}{detail.subject}</h2><button disabled={!ownName || pendingWrites.has(keyOf(detail))} className={`${styles.inlineFlag} ${ownName && hasOwnPin(detail.categories, ownName) ? styles.flag : ""}`} onClick={() => void writeOne(detail, "pin", !hasOwnPin(detail.categories, ownName))}>⚑</button><span className={styles.badge}>{abbreviateBox(detail.box.address)}</span></div>
          <dl><div><dt>差出人</dt><dd>{detail.fromName} &lt;{detail.fromAddress}&gt;</dd></div><div><dt>宛先</dt><dd>{detail.to.join(", ")}</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(detail.receivedDateTime)}</dd></div></dl>
          <div className={styles.categoryLine}><span className={styles.states}>{MAIL_STATES.map((state) => <button key={state} disabled={pendingWrites.has(keyOf(detail))} className={detail.categories.includes(state) ? styles.stateOn : ""} onClick={() => void writeOne(detail, "state", detail.categories.includes(state) ? null : state)}>{state}</button>)}</span><span className={styles.reviewersLarge}>{reviewers.filter((name) => detail.categories.includes(name) || name === ownName).map((name) => <button key={name} title={name} className={`${detail.categories.includes(name) ? styles[`reviewerTone${reviewerTone(name, reviewers)}`] : styles.reviewerEmpty} ${name === ownName ? styles.reviewerMine : styles.reviewerLocked}`} disabled={name !== ownName || pendingWrites.has(keyOf(detail))} onClick={() => void writeOne(detail, "confirm", !detail.categories.includes(name))}>{reviewerInitials([name], [name])[0]}</button>)}</span></div>
        </header><div className={styles.readerBody}>{detail.body.contentType === "html" ? <div className={styles.htmlBody} dangerouslySetInnerHTML={{ __html: detail.body.content }} /> : <div className={styles.textBody}>{detail.body.content}</div>}{!!detail.attachments.length && <section className={styles.attachments}><h3>添付ファイル</h3>{detail.attachments.map((item) => <div className={styles.attachment} key={item.id}><span>⌕</span><a href={attachmentUrl(item)}>{item.name}</a><small>{Math.max(1, Math.round(item.size / 1024))} KB</small><button disabled>Bud の未処理トレイへ</button></div>)}</section>}</div></>}
        </article>
      </div>}
    </section>
  </GardenShell>;
}
