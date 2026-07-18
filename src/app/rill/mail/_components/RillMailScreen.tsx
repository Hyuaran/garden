"use client";
/* eslint-disable @next/next/no-img-element -- authenticated Graph attachment URLs cannot use the Next image optimizer */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GardenShell from "@/app/_components/layout/GardenShell/GardenShell";
import { RillComposePane } from "./RillComposePane";
import type { GardenShellPageMenuItem } from "@/app/_components/layout/GardenShell/garden-shell-config";
import { abbreviateBox, daySeparatedMessages, formatMailDetailDate, formatMailListDate, isViewableAttachment, mergeMessagePages, pruneToRefreshWindow, reviewerInitials, reviewerNames, reviewerTone, statusCategory } from "../_lib/format";
import { applyLocalMailMutation, detailCacheKey, hasOwnPin, isMessageUnread, MAIL_STATES, messagesForBox, selectionRange, withCachedDetail, type MailState, type MailWriteOperation } from "../_lib/write-ops";
import { isLikelyNonJapanese, mailBodyText } from "../_lib/translate";
import { scheduleDelayedSend, validateComposeInput, type ComposeDraft, type ComposeMode } from "../_lib/compose";
import type { RillMailAttachment, RillMailBox, RillMailDetail, RillMailMessage, RillMessagesResponse } from "../_lib/types";
import { isNearListEnd, NORMAL_AUTO_PAGE_LIMIT, PRIORITY_PAGES_AHEAD, SerialSearchScheduler, type SearchMessagesResponse } from "../_lib/search";
import { applyRecentCategoryWrites, RECENT_WRITE_TTL_MS, reconcilePinnedMessage, shouldAddBulkPin, type PinnedMessagesResponse, type RecentCategoryWrite } from "../_lib/pinned";
import styles from "./RillMailScreen.module.css";

const ICON = "/themes/garden-shell/images/icons_bloom/orb_rill.png";
const MENU: GardenShellPageMenuItem[] = [
  { label: "Mail", href: "/rill/mail", icon: ICON, active: true },
  { label: "Chat（year-end）", href: "#rill-chat", icon: ICON },
];
const FALLBACK_REVIEWERS = ["東海林美琴", "上田", "簡"];
const keyOf = (message: Pick<RillMailMessage, "id" | "box">) => `${message.box.id}:${message.id}`;

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></svg>;
}

function PaperclipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 12.5 6.8-6.8a3.2 3.2 0 0 1 4.5 4.5l-9.2 9.2a5 5 0 0 1-7.1-7.1l8.8-8.8m-6.7 11 8.8-8.8" /></svg>;
}

function PinIcon({ on = false }: { on?: boolean }) {
  return <svg className={on ? styles.pinOn : undefined} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 6 2-1.2 4 3.2 3-4 2-2 6-1.5-5.5-4.5-2.5 3.2-3z" /><path d="m9.5 15.5-4.5 4.5" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>;
}

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
  const [searchResults, setSearchResults] = useState<RillMailMessage[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [priorityPages, setPriorityPages] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState<RillMailMessage[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsNotice, setPinsNotice] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingWrites, setPendingWrites] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [autoRefreshFailed, setAutoRefreshFailed] = useState(false);
  const [importingFlags, setImportingFlags] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [viewingAttachment, setViewingAttachment] = useState<RillMailAttachment | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [translationAvailable, setTranslationAvailable] = useState(false);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [drafts, setDrafts] = useState<Map<string, ComposeDraft>>(new Map());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [composeError, setComposeError] = useState("");
  const [sendToast, setSendToast] = useState<{ tone: "pending" | "success" | "error"; text: string; seconds?: number } | null>(null);
  const autoSearch = useRef<SerialSearchScheduler<{ query: string; box: string }> | null>(null);
  const requestGeneration = useRef(0);
  const pendingWriteKeys = useRef(new Set<string>());
  const automaticPageCount = useRef(0);
  const detailCache = useRef(new Map<string, RillMailDetail>());
  const detailRequests = useRef(new Map<string, Promise<RillMailDetail>>());
  const selectedKey = useRef<string | null>(null);
  const visibleMessages = useRef<RillMailMessage[]>([]);
  const lastUserInteraction = useRef(Date.now());
  const translationCache = useRef(new Map<string, string>());
  const translationSelectionKey = useRef("");
  const draftCounter = useRef(0);
  const delayedSend = useRef<{ cancel: () => boolean; dispose: () => void } | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentWrites = useRef(new Map<string, RecentCategoryWrite>());
  const ownNameRef = useRef(ownName);
  ownNameRef.current = ownName;

  const protectServerMessages = useCallback(<T extends RillMailMessage,>(incoming: T[], pinnedView = false) => {
    const protectedResult = applyRecentCategoryWrites(incoming, recentWrites.current, Date.now(), { pinnedView, ownName: ownNameRef.current });
    recentWrites.current = protectedResult.writes;
    return protectedResult.messages as T[];
  }, []);

  const rememberWrite = useCallback((message: RillMailMessage) => {
    recentWrites.current.set(keyOf(message), { categories: [...message.categories], isRead: message.isRead, expiresAt: Date.now() + RECENT_WRITE_TTL_MS });
  }, []);

  if (!autoSearch.current) {
    autoSearch.current = new SerialSearchScheduler(async ({ query: value, box }, generation) => {
      setSearchError(""); setPicked(new Set()); setPriorityPages(0);
      const params = new URLSearchParams({ q: value, box });
      try {
        const result = await readJson<SearchMessagesResponse>(await fetch(`/api/rill/mail/search?${params}`, { cache: "no-store" }));
        if (!autoSearch.current?.isCurrent(generation)) return;
        setSearchResults(protectServerMessages(result.messages)); setSearchTruncated(result.truncated);
      } catch (cause) {
        if (!autoSearch.current?.isCurrent(generation)) return;
        setSearchResults((current) => current ?? []); setSearchTruncated(false);
        setSearchError(cause instanceof Error ? cause.message : "全期間検索に失敗しました");
      }
    }, setSearchLoading);
  }

  const loadMessages = useCallback(async (box: string, nextCursor?: string | null, mode: "replace" | "append" | "refresh" | "switch" = "replace") => {
    const generation = requestGeneration.current;
    const params = new URLSearchParams({ box: box === "flagged" ? "all" : box });
    if (nextCursor) params.set("cursor", nextCursor);
    const data = await readJson<RillMessagesResponse>(await fetch(`/api/rill/mail/messages?${params}`, { cache: "no-store" }));
    if (generation !== requestGeneration.current) return;
    const serverMessages = protectServerMessages(data.messages);
    setMessages((current) => {
      if (mode === "replace") return serverMessages;
      const retained = mode === "refresh" ? pruneToRefreshWindow(current, serverMessages, data.boxIds) : current;
      return mergeMessagePages(mode === "switch" ? pruneToRefreshWindow(current, serverMessages, data.boxIds) : retained, serverMessages);
    });
    if (mode !== "refresh") {
      automaticPageCount.current = mode === "append" ? automaticPageCount.current + 1 : 1;
      setCursor(data.cursor);
    }
    setUpdatedAt(new Date());
  }, [protectServerMessages]);

  const loadPinnedMessages = useCallback(async () => {
    setPinsLoading(true); setPinsNotice("");
    try {
      const data = await readJson<PinnedMessagesResponse>(await fetch("/api/rill/mail/pins", { cache: "no-store" }));
      setPinnedMessages(protectServerMessages(data.messages, true)); setPinsNotice(data.notice ?? ""); setUpdatedAt(new Date());
    } finally { setPinsLoading(false); }
  }, [protectServerMessages]);

  const initialize = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError("");
    try {
      const data = await readJson<{ boxes: RillMailBox[]; reviewers: string[]; ownName: string | null }>(await fetch("/api/rill/mail/boxes", { cache: "no-store" }));
      if (generation !== requestGeneration.current) return;
      setBoxes(data.boxes); setReviewers(data.reviewers.length ? data.reviewers : FALLBACK_REVIEWERS); setOwnName(data.ownName ?? ""); setConnected(true); setAutoRefreshFailed(false);
      await loadMessages("all");
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      if ((cause as { status?: number }).status === 428) setConnected(false);
      else setError(cause instanceof Error ? cause.message : "メールを取得できませんでした");
    } finally { if (generation === requestGeneration.current) setLoading(false); }
  }, [loadMessages]);

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => () => {
    autoSearch.current?.dispose();
    delayedSend.current?.dispose();
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  }, []);
  useEffect(() => {
    void fetch("/api/rill/mail/translate", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ available?: boolean }> : null)
      .then((value) => setTranslationAvailable(value?.available === true))
      .catch(() => setTranslationAvailable(false));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!connected || searchResults !== null) return;
      const refresh = activeBox === "flagged" ? loadPinnedMessages() : loadMessages(activeBox, null, "refresh");
      void refresh
        .then(() => setAutoRefreshFailed(false))
        .catch((cause) => {
          if ((cause as { status?: number }).status === 428) setConnected(false);
          else setAutoRefreshFailed(true);
        });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activeBox, connected, loadMessages, loadPinnedMessages, searchResults]);
  useEffect(() => {
    if (!viewingAttachment) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setViewingAttachment(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [viewingAttachment]);
  useEffect(() => {
    const recordInteraction = () => { lastUserInteraction.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "wheel", "scroll", "keydown", "input"];
    events.forEach((event) => window.addEventListener(event, recordInteraction, { capture: true, passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, recordInteraction, { capture: true }));
  }, []);
  useEffect(() => {
    if (searchResults !== null || priorityPages > 0 || !cursor || loadingMore || automaticPageCount.current >= NORMAL_AUTO_PAGE_LIMIT) return;
    let timer: number | undefined;
    let idle: number | undefined;
    const run = () => {
      const interactionPause = 1_000 - (Date.now() - lastUserInteraction.current);
      if (interactionPause > 0) { timer = window.setTimeout(queueWhenIdle, interactionPause); return; }
      setLoadingMore(true);
      void loadMessages(activeBox, cursor, "append")
        .catch((cause) => setError(cause instanceof Error ? cause.message : "続きを取得できませんでした"))
        .finally(() => setLoadingMore(false));
    };
    const queueWhenIdle = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(run);
      else run();
    };
    timer = window.setTimeout(queueWhenIdle, 500);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (idle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
    };
  }, [activeBox, cursor, loadMessages, loadingMore, priorityPages, searchResults]);
  useEffect(() => {
    if (searchResults !== null || priorityPages <= 0 || !cursor || loadingMore) return;
    setLoadingMore(true);
    void loadMessages(activeBox, cursor, "append")
      .catch((cause) => setError(cause instanceof Error ? cause.message : "続きを取得できませんでした"))
      .finally(() => { setLoadingMore(false); setPriorityPages((current) => Math.max(0, current - 1)); });
  }, [activeBox, cursor, loadMessages, loadingMore, priorityPages, searchResults]);

  const fetchDetail = useCallback((message: RillMailMessage, revalidate = true) => {
    const key = detailCacheKey(message);
    const cached = detailCache.current.get(key);
    if (!revalidate && cached) return Promise.resolve(cached);
    const existing = detailRequests.current.get(key);
    if (existing) return existing;
    const params = new URLSearchParams({ box: message.box.id });
    const request = fetch(`/api/rill/mail/messages/${encodeURIComponent(message.id)}?${params}`, { cache: "no-store" })
      .then((response) => readJson<RillMailDetail>(response))
      .then((value) => {
        const protectedValue = protectServerMessages([value])[0];
        detailCache.current = withCachedDetail(detailCache.current, protectedValue);
        return protectedValue;
      })
      .finally(() => detailRequests.current.delete(key));
    detailRequests.current.set(key, request);
    return request;
  }, [protectServerMessages]);

  useEffect(() => {
    selectedKey.current = selected ? detailCacheKey(selected) : null;
    if (!selected) { setDetail(null); return; }
    const key = detailCacheKey(selected);
    setDetail(detailCache.current.get(key) ?? null);
    void fetchDetail(selected).then((value) => { if (selectedKey.current === key) setDetail(value); }).catch((cause) => setError(cause instanceof Error ? cause.message : "本文を取得できませんでした"));
    const index = visibleMessages.current.findIndex((message) => detailCacheKey(message) === key);
    visibleMessages.current.slice(Math.max(0, index - 2), index + 3).forEach((message) => {
      if (detailCacheKey(message) !== key) void fetchDetail(message, false).catch(() => undefined);
    });
  }, [fetchDetail, selected]);
  useEffect(() => {
    const key = selected ? detailCacheKey(selected) : null;
    if ((key ?? "") === translationSelectionKey.current) return;
    translationSelectionKey.current = key ?? "";
    setShowTranslation(Boolean(key && translationCache.current.has(key)));
    setTranslationError("");
  }, [selected]);

  const patchOne = useCallback(async (message: RillMailMessage, op: MailWriteOperation, value: boolean | MailState | null) => {
    const field = op === "state" ? "state" : op === "read" ? "read" : "on";
    const params = new URLSearchParams({ box: message.box.id });
    await readJson(await fetch(`/api/rill/mail/messages/${encodeURIComponent(message.id)}/${op}?${params}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) }));
  }, []);

  const refreshAfterWrite = useCallback(async (message?: RillMailMessage) => {
    if (activeBox === "flagged") await loadPinnedMessages();
    else await loadMessages(activeBox, null, "refresh");
    if (message && selected && keyOf(message) === keyOf(selected)) {
      const value = await fetchDetail(message);
      if (selectedKey.current === detailCacheKey(message)) setDetail(value);
    }
  }, [activeBox, fetchDetail, loadMessages, loadPinnedMessages, selected]);

  const applyLocal = useCallback((before: RillMailMessage, after: RillMailMessage) => {
    const key = keyOf(before);
    setMessages((current) => current.map((item) => keyOf(item) === key ? after : item));
    setSearchResults((current) => current?.map((item) => keyOf(item) === key ? after : item) ?? null);
    setPinnedMessages((current) => reconcilePinnedMessage(current, after, ownName));
    setSelected((current) => current && keyOf(current) === key ? after : current);
    setDetail((current) => current && keyOf(current) === key ? { ...current, ...after } : current);
  }, [ownName]);

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
      rememberWrite(updated);
      if (!(activeBox === "flagged" && op === "pin")) void refreshAfterWrite(updated).catch(() => setAutoRefreshFailed(true));
    }
    catch (cause) { recentWrites.current.delete(key); applyLocal(updated, message); setError(cause instanceof Error ? cause.message : "更新できませんでした"); }
    finally { markPending([key], false); }
  };

  const openMessage = async (message: RillMailMessage) => {
    setActiveDraftId(null);
    setViewingAttachment(null);
    setSelected(message);
    if (!ownName || !isMessageUnread(message, ownName)) return;
    await writeOne(message, message.box.kind === "personal" ? "read" : "confirm", true);
  };

  const filtered = useMemo(() => {
    if (searchResults !== null) return searchResults;
    const needle = query.trim().toLocaleLowerCase("ja");
    const source = activeBox === "flagged" ? pinnedMessages : messagesForBox(messages, activeBox, ownName);
    return needle ? source.filter((item) => [item.fromName, item.fromAddress, item.subject, item.bodyPreview].some((value) => value.toLocaleLowerCase("ja").includes(needle))) : source;
  }, [activeBox, messages, ownName, pinnedMessages, query, searchResults]);
  visibleMessages.current = filtered;
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
    const targets = (searchResults ?? (activeBox === "flagged" ? pinnedMessages : messages)).filter((message) => picked.has(keyOf(message)) && !pendingWriteKeys.current.has(keyOf(message)));
    if (!targets.length) return;
    const snapshots = new Map(targets.map((message) => [keyOf(message), message]));
    const optimistic = new Map(targets.map((message) => {
      const actualOp = op === "read" && message.box.kind === "shared" ? "confirm" : op;
      return [keyOf(message), applyLocalMailMutation(message, actualOp, value, ownName)];
    }));
    const keys = [...snapshots.keys()];
    markPending(keys, true); setError("");
    setMessages((current) => current.map((message) => optimistic.get(keyOf(message)) ?? message));
    setSearchResults((current) => current?.map((message) => optimistic.get(keyOf(message)) ?? message) ?? null);
    setPinnedMessages((current) => [...optimistic.values()].reduce((result, message) => reconcilePinnedMessage(result, message, ownName), current));
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
      keys.forEach((key) => {
        if (failedKeys.has(key)) recentWrites.current.delete(key);
        else {
          const updated = optimistic.get(key);
          if (updated) rememberWrite(updated);
        }
      });
      if (failedKeys.size) {
        setMessages((current) => current.map((message) => failedKeys.has(keyOf(message)) ? snapshots.get(keyOf(message)) ?? message : message));
        setSearchResults((current) => current?.map((message) => failedKeys.has(keyOf(message)) ? snapshots.get(keyOf(message)) ?? message : message) ?? null);
        setPinnedMessages((current) => [...failedKeys].reduce((result, key) => snapshots.has(key) ? reconcilePinnedMessage(result, snapshots.get(key)!, ownName) : result, current));
        setSelected((current) => current && failedKeys.has(keyOf(current)) ? snapshots.get(keyOf(current)) ?? current : current);
        setDetail((current) => current && failedKeys.has(keyOf(current)) ? { ...current, ...(snapshots.get(keyOf(current)) ?? {}) } : current);
        setError(`${failedKeys.size}件を更新できませんでした`);
      }
      else setPicked(new Set());
      if (!(activeBox === "flagged" && op === "pin")) void refreshAfterWrite(selected ?? undefined).catch(() => setAutoRefreshFailed(true));
    } catch (cause) {
      keys.forEach((key) => recentWrites.current.delete(key));
      setMessages((current) => current.map((message) => snapshots.get(keyOf(message)) ?? message));
      setSearchResults((current) => current?.map((message) => snapshots.get(keyOf(message)) ?? message) ?? null);
      setPinnedMessages((current) => [...snapshots.values()].reduce((result, message) => reconcilePinnedMessage(result, message, ownName), current));
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
      if (activeBox === "flagged") await loadPinnedMessages();
      else await loadMessages(activeBox);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Outlookのフラグを取り込めませんでした");
    } finally { setImportingFlags(false); }
  };

  const openCompose = (mode: ComposeMode) => {
    if (mode !== "new" && !detail) return;
    const source = mode === "new" ? null : detail!;
    const id = source ? `${mode}:${source.box.id}:${source.id}` : `new:${++draftCounter.current}`;
    const existing = drafts.get(id);
    if (existing) { setActiveDraftId(id); setComposeError(""); return; }
    const ownBox = boxes.find((box) => box.id === "me");
    const prefix = mode === "forward" ? "Fwd: " : mode === "new" ? "" : "Re: ";
    const subject = source ? (source.subject.startsWith(prefix) ? source.subject : `${prefix}${source.subject}`) : "";
    const to = source ? mode === "forward" ? [] : [...new Set([source.fromAddress, ...(mode === "replyAll" ? source.to : [])].filter((address) => address && address !== ownBox?.address))] : [];
    const quote = source ? `差出人: ${source.fromName} <${source.fromAddress}>\n受信: ${formatMailDetailDate(source.receivedDateTime)}\n件名: ${source.subject}\n\n${mailBodyText(source.body.content)}` : "";
    const draft: ComposeDraft = { id, mode, box: source?.box.id ?? "me", sourceMessageId: source?.id, to, cc: [], subject, bodyText: "", quote, fromLabel: `${ownBox?.label ?? "自分"} <${ownBox?.address ?? "me"}>`, ccVisible: false };
    setDrafts((current) => new Map(current).set(id, draft)); setActiveDraftId(id); setComposeError("");
  };

  const updateDraft = (draft: ComposeDraft) => setDrafts((current) => new Map(current).set(draft.id, draft));
  const discardDraft = (id: string) => { setDrafts((current) => { const next = new Map(current); next.delete(id); return next; }); setActiveDraftId((current) => current === id ? null : current); };

  const queueSend = (draft: ComposeDraft) => {
    if (sendToast?.tone === "pending") { setComposeError("別のメールが送信待ちです。送信または取り消し後にお試しください"); return; }
    try { validateComposeInput(draft); }
    catch (cause) { setComposeError(cause instanceof Error ? cause.message : "宛先・件名を確認してください"); return; }
    setComposeError(""); setActiveDraftId(null); setDrafts((current) => { const next = new Map(current); next.delete(draft.id); return next; });
    setSendToast({ tone: "pending", text: "送信しました", seconds: 10 });
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    countdownTimer.current = setInterval(() => setSendToast((current) => current?.tone === "pending" ? { ...current, seconds: Math.max(0, (current.seconds ?? 1) - 1) } : current), 1_000);
    delayedSend.current = scheduleDelayedSend(draft, async (value) => {
      await readJson(await fetch("/api/rill/mail/compose/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }));
    }, {
      cancelled: (value) => { if (countdownTimer.current) clearInterval(countdownTimer.current); setDrafts((current) => new Map(current).set(value.id, value)); setActiveDraftId(value.id); setSendToast(null); },
      succeeded: () => { if (countdownTimer.current) clearInterval(countdownTimer.current); setSendToast({ tone: "success", text: "送信しました" }); window.setTimeout(() => setSendToast(null), 3_000); },
      failed: (value) => { if (countdownTimer.current) clearInterval(countdownTimer.current); setDrafts((current) => new Map(current).set(value.id, value)); setSendToast({ tone: "error", text: "送信できませんでした。未送信に戻しました" }); },
    });
  };

  const translateDetail = async () => {
    if (!detail) return;
    const key = detailCacheKey(detail);
    if (showTranslation) { setShowTranslation(false); return; }
    if (translationCache.current.has(key)) { setShowTranslation(true); return; }
    if (translatingKey === key) return;
    setTranslatingKey(key); setTranslationError("");
    try {
      const text = mailBodyText(detail.body.content);
      const result = await readJson<{ translation: string }>(await fetch("/api/rill/mail/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }));
      translationCache.current.set(key, result.translation);
      if (selectedKey.current === key) setShowTranslation(true);
    } catch (cause) {
      if ((cause as { status?: number }).status === 501) setTranslationAvailable(false);
      if (selectedKey.current === key) setTranslationError(cause instanceof Error ? cause.message : "翻訳に失敗しました");
    } finally {
      setTranslatingKey((current) => current === key ? null : current);
    }
  };

  const selectBox = (id: string) => {
    requestGeneration.current += 1; automaticPageCount.current = 0;
    autoSearch.current?.clear();
    setViewingAttachment(null); setActiveDraftId(null); setActiveBox(id); setSelected(null); setPicked(new Set()); setCursor(null); setError(""); setSearchResults(null); setSearchError(""); setSearchTruncated(false); setPriorityPages(0);
    const request = id === "flagged" ? loadPinnedMessages() : loadMessages(id, null, "switch");
    void request.catch((cause) => setError(cause instanceof Error ? cause.message : "メールを取得できませんでした"));
  };

  const exitSearch = () => {
    autoSearch.current?.clear();
    setSearchResults(null); setSearchError(""); setSearchTruncated(false); setPicked(new Set());
  };

  const runFullSearch = () => {
    const value = query.trim();
    if (!value) { exitSearch(); return; }
    autoSearch.current?.schedule({ query: value, box: activeBox === "flagged" ? "all" : activeBox }, true);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    const normalized = value.trim();
    if (!normalized) exitSearch();
    else autoSearch.current?.schedule({ query: normalized, box: activeBox === "flagged" ? "all" : activeBox });
  };

  const trackListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (searchResults !== null || activeBox === "flagged") return;
    setPriorityPages(isNearListEnd(event.currentTarget) ? PRIORITY_PAGES_AHEAD : 0);
  };
  const currentPinned = Boolean(selected && ownName && hasOwnPin(selected.categories, ownName));
  const selectedUnread = Boolean(selected && ownName && isMessageUnread(selected, ownName));
  const attachmentUrl = (item: RillMailDetail["attachments"][number]) => `/api/rill/mail/messages/${encodeURIComponent(detail!.id)}/attachments/${encodeURIComponent(item.id)}?box=${encodeURIComponent(detail!.box.id)}`;
  const viewingUrl = viewingAttachment ? `${attachmentUrl(viewingAttachment)}&view=1` : "";
  const translationView = (() => {
    if (!detail) return { key: "", translation: undefined as string | undefined, eligible: false };
    const key = detailCacheKey(detail);
    const text = mailBodyText(detail.body.content);
    const translation = translationCache.current.get(key);
    return { key, translation, eligible: (translationAvailable || Boolean(translation)) && isLikelyNonJapanese(text) };
  })();
  const activeDraft = activeDraftId ? drafts.get(activeDraftId) : undefined;
  const suggestionAddresses = useMemo(() => messages.map((message) => message.fromAddress).filter(Boolean), [messages]);
  const pickedMessages = useMemo(() => (searchResults ?? (activeBox === "flagged" ? pinnedMessages : messages)).filter((message) => picked.has(keyOf(message))), [activeBox, messages, picked, pinnedMessages, searchResults]);
  const bulkPinOn = shouldAddBulkPin(pickedMessages, ownName);

  return <GardenShell activeModule="rill" pageMenu={MENU} activityItems={[]} contentFullBleed>
    <section className={styles.surface} aria-label="Rill Mail">
      <div className={styles.toolbar}>
        <button className={styles.primaryButton} onClick={() => void initialize()} disabled={loading}>↻ 更新</button>
        <span className={styles.fresh}>{updatedAt ? `最終更新 ${updatedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}・60秒ごと` : "未更新"}</span>{autoRefreshFailed && <span className={styles.autoWarning}>更新に失敗（自動で再試行します）</span>}<span className={styles.separator} />
        <button className={styles.composeAction} onClick={() => openCompose("new")}>新規</button><button className={styles.composeAction} disabled={!detail} onClick={() => openCompose("reply")}>返信</button><button className={styles.composeAction} disabled={!detail} onClick={() => openCompose("replyAll")}>全員に返信</button><button className={styles.composeAction} disabled={!detail} onClick={() => openCompose("forward")}>転送</button>
        <button className={styles.actionButton} disabled={!selected || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, selected.box.kind === "personal" ? "read" : "confirm", selectedUnread)}>○ {selectedUnread ? "開封済みに" : "未読に戻す"}</button>
        <button aria-label="ピン" className={`${styles.actionButton} ${currentPinned ? styles.actionOn : ""}`} disabled={!selected || !ownName || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, "pin", !currentPinned)}><PinIcon on={currentPinned} />ピン</button>
        <span className={styles.toolbarStates}>{MAIL_STATES.map((state) => <button key={state} className={selected && statusCategory(selected.categories) === state ? styles.actionOn : ""} disabled={!selected || Boolean(selected && pendingWrites.has(keyOf(selected)))} onClick={() => selected && void writeOne(selected, "state", statusCategory(selected.categories) === state ? null : state)}>{state}</button>)}</span>
        <button className={styles.moreButton} disabled title="アーカイブ・削除は次段階">…</button>
        <label className={styles.search}><span><SearchIcon /></span><input value={query} onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runFullSearch(); }} placeholder="メールを検索" />{query && <button type="button" className={styles.clearSearch} aria-label="検索を解除" onClick={() => { setQuery(""); exitSearch(); }}>×</button>}</label>
      </div>
      {connected === false ? <div className={styles.connect}><div className={styles.connectOrb}>✉</div><h1>Microsoft メールを接続</h1><p>本人の Microsoft アカウントでサインインすると、許可された受信箱を Garden から閲覧できます。</p><a href="/api/rill/mail/auth/login">Microsoft に接続</a></div> :
      <div className={styles.panes}>
        <aside className={styles.column}><header className={styles.columnHeader}>受信箱 <span>{messages.length}</span></header><div className={styles.scroll}>
          <div className={styles.group}>まとめて見る</div><button className={`${styles.box} ${activeBox === "all" ? styles.active : ""}`} onClick={() => selectBox("all")}><span className={styles.dot} />すべての箱</button><button className={`${styles.box} ${activeBox === "flagged" ? styles.active : ""}`} onClick={() => selectBox("flagged")}><span className={styles.pinIcon} role="img" aria-label="ピン"><PinIcon on /></span>ピン止め</button>
          <div className={styles.group}>自分</div>{boxes.filter((box) => box.kind === "personal").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.personalDot} />{box.label}</button>)}
          <div className={styles.group}>共有</div>{boxes.filter((box) => box.kind === "shared").map((box) => <button key={box.id} className={`${styles.box} ${activeBox === box.id ? styles.active : ""}`} onClick={() => selectBox(box.id)}><span className={styles.sharedDot} />{box.label}</button>)}
        </div><footer className={styles.foot}>メールは Garden に保存せず<br />Microsoft から都度取得します</footer></aside>
        <section className={styles.column}><header className={styles.columnHeader}>{searchLoading ? "全期間を検索中…" : searchResults !== null ? <>全期間から{filtered.length}件 <small>（Outlook検索）</small></> : <>メール一覧 <span>{filtered.length}件</span></>}{activeBox === "flagged" && searchResults === null && filtered.length > 0 && <button className={styles.importAgain} disabled={importingFlags} onClick={() => void importLegacyFlags()}>旧フラグ取込</button>}</header>
          {picked.size > 0 && <div className={styles.bulk}><b>{picked.size}件選択</b><button onClick={() => void bulkWrite("read", true)}>開封済みに</button><button aria-label={bulkPinOn ? "ピン" : "ピンを外す"} onClick={() => void bulkWrite("pin", bulkPinOn)}><PinIcon on={!bulkPinOn} />{bulkPinOn ? "ピン" : "ピンを外す"}</button>{MAIL_STATES.map((state) => <button key={state} onClick={() => void bulkWrite("state", state)}>{state}</button>)}<button onClick={() => void bulkWrite("confirm", true)}>確認</button><button className={styles.bulkClose} onClick={() => setPicked(new Set())}>×</button></div>}
          <div className={styles.scroll} onScroll={trackListScroll}>{((activeBox === "flagged" ? pinsLoading : loading && !messages.length) && searchResults === null) && <div className={styles.notice}>読み込み中…</div>}{error && <div className={styles.error}>{error}</div>}{searchError && <div className={styles.error}>{searchError}</div>}
          {searchResults !== null && !searchLoading && filtered.length === 0 && <div className={styles.searchEmpty}>該当するメールはありません。日本語は単語の一部だけでは見つからない場合があります。</div>}
          {searchResults !== null && searchTruncated && <div className={styles.importResult}>ヒットが多いため各箱の新しい50件まで表示しています。語を足して絞り込んでください</div>}
          {activeBox === "flagged" && searchResults === null && !pinsLoading && filtered.length === 0 && <div className={styles.importCard}><span className={styles.pinIcon} role="img" aria-label="ピン"><PinIcon on /></span><h2>自分のピンはまだありません</h2><p>Outlookで付けたフラグを、自分だけのピンとして取り込めます。元のフラグは変更しません。</p><button disabled={importingFlags} onClick={() => void importLegacyFlags()}>{importingFlags ? "取り込み中…" : "Outlookのフラグから取り込む"}</button>{importResult && <small>{importResult}</small>}</div>}
          {activeBox === "flagged" && searchResults === null && pinsNotice && <div className={styles.importResult}>{pinsNotice}</div>}
          {activeBox === "flagged" && filtered.length > 0 && importResult && <div className={styles.importResult}>{importResult}</div>}
          {datedMessages.map(({ message, label, showDay }) => { const status = statusCategory(message.categories); const confirmedBy = reviewerNames(message.categories, reviewers); const initials = reviewerInitials(message.categories, reviewers); const key = keyOf(message); const unread = ownName ? isMessageUnread(message, ownName) : !message.isRead; return <Fragment key={key}>{showDay && <div className={styles.daySeparator}>{label}</div>}<div role="button" tabIndex={0} className={`${styles.mail} ${selected && keyOf(selected) === key ? styles.selectedMail : ""} ${unread ? styles.unread : ""} ${picked.has(key) ? styles.picked : ""}`} onClick={(event) => event.ctrlKey || event.metaKey || event.shiftKey ? togglePicked(message, event) : void openMessage(message)} onKeyDown={(event) => { if (event.key === "Enter") void openMessage(message); }}>
            <span className={styles.row}><button className={`${styles.checkbox} ${picked.has(key) ? styles.checked : ""}`} onClick={(event) => togglePicked(message, event)} aria-label="選択" /><span className={styles.from}>{message.fromName}</span><span className={styles.badge}>{abbreviateBox(message.box.address)}</span><time>{formatMailListDate(message.receivedDateTime)}</time><button aria-label="ピン" disabled={!ownName || pendingWrites.has(key)} className={`${styles.inlineFlag} ${ownName && hasOwnPin(message.categories, ownName) ? styles.flag : ""}`} onClick={(event) => { event.stopPropagation(); void writeOne(message, "pin", !hasOwnPin(message.categories, ownName)); }}><PinIcon on={Boolean(ownName && hasOwnPin(message.categories, ownName))} /></button></span>
            <span className={styles.row}><span className={styles.subject}>{message.hasAttachments && <span className={styles.paperclip} role="img" aria-label="添付あり"><PaperclipIcon /></span>}{message.subject}</span>{status && <span className={`${styles.status} ${styles[`status${status}`]}`}>{status}</span>}</span><span className={styles.row}><span className={styles.preview}>{message.bodyPreview}</span><span className={styles.reviewers}>{confirmedBy.map((name, index) => <i key={name} className={styles[`reviewerTone${reviewerTone(name, reviewers)}`]} title={name}>{initials[index]}</i>)}</span></span>
          </div></Fragment>; })}<div className={styles.pageTrigger} aria-hidden="true" /></div>
        </section>
        <article className={`${styles.column} ${styles.composeHost}`}>{activeDraft ? <RillComposePane draft={activeDraft} addresses={suggestionAddresses} error={composeError} onChange={updateDraft} onSend={() => queueSend(activeDraft)} onMinimize={() => setActiveDraftId(null)} onClose={() => setActiveDraftId(null)} onDiscard={() => discardDraft(activeDraft.id)} /> : !selected ? <div className={styles.emptyDetail}>メールを選ぶと、ここに本文が表示されます。</div> : !detail ? <><header className={styles.readerHeader}><div className={styles.readerTitle}><h2>{selected.hasAttachments && <span className={styles.paperclip} role="img" aria-label="添付あり"><PaperclipIcon /></span>}{selected.subject}</h2><span className={styles.badge}>{abbreviateBox(selected.box.address)}</span></div><dl><div><dt>差出人</dt><dd>{selected.fromName} &lt;{selected.fromAddress}&gt;</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(selected.receivedDateTime)}</dd></div></dl></header><div className={styles.readerBody}><p className={styles.previewLead}>{selected.bodyPreview || "本文を読み込んでいます…"}</p><div className={styles.skeletonLine} /><div className={`${styles.skeletonLine} ${styles.skeletonShort}`} /></div></> : <><header className={styles.readerHeader}>
          <div className={styles.readerTitle}><h2>{detail.hasAttachments && <span className={styles.paperclip} role="img" aria-label="添付あり"><PaperclipIcon /></span>}{detail.subject}</h2><button aria-label="ピン" disabled={!ownName || pendingWrites.has(keyOf(detail))} className={`${styles.inlineFlag} ${ownName && hasOwnPin(detail.categories, ownName) ? styles.flag : ""}`} onClick={() => void writeOne(detail, "pin", !hasOwnPin(detail.categories, ownName))}><PinIcon on={Boolean(ownName && hasOwnPin(detail.categories, ownName))} /></button><span className={styles.badge}>{abbreviateBox(detail.box.address)}</span></div>
          <dl><div><dt>差出人</dt><dd>{detail.fromName} &lt;{detail.fromAddress}&gt;</dd></div><div><dt>宛先</dt><dd>{detail.to.join(", ")}</dd></div><div><dt>受信</dt><dd>{formatMailDetailDate(detail.receivedDateTime)}</dd></div></dl>
          <div className={styles.categoryLine}>{translationView.eligible && <button className={styles.translateButton} disabled={translatingKey === translationView.key} onClick={() => void translateDetail()}>{translatingKey === translationView.key ? "翻訳中…" : showTranslation ? "原文を表示" : translationView.translation ? "日本語訳を表示" : "日本語に翻訳"}</button>}<span className={styles.states}>{MAIL_STATES.map((state) => <button key={state} disabled={pendingWrites.has(keyOf(detail))} className={detail.categories.includes(state) ? styles.stateOn : ""} onClick={() => void writeOne(detail, "state", detail.categories.includes(state) ? null : state)}>{state}</button>)}</span><span className={styles.reviewersLarge}>{reviewers.filter((name) => detail.categories.includes(name) || name === ownName).map((name) => <button key={name} title={name} className={`${detail.categories.includes(name) ? styles[`reviewerTone${reviewerTone(name, reviewers)}`] : styles.reviewerEmpty} ${name === ownName ? styles.reviewerMine : styles.reviewerLocked}`} disabled={name !== ownName || pendingWrites.has(keyOf(detail))} onClick={() => void writeOne(detail, "confirm", !detail.categories.includes(name))}>{reviewerInitials([name], [name])[0]}</button>)}</span></div>{translationError && <div className={styles.translationError}>{translationError}</div>}
        </header><div className={styles.readerBody}>{!!detail.attachments.length && <section className={styles.attachments}><h3><span className={styles.paperclip} role="img" aria-label="添付ファイル"><PaperclipIcon /></span>添付ファイル</h3>{detail.attachments.map((item) => { const viewable = isViewableAttachment(item.contentType, item.name); return <div className={styles.attachment} key={item.id}><span className={styles.fileIcon} role="img" aria-label="添付ファイル"><PaperclipIcon /></span>{viewable ? <button className={styles.attachmentName} onClick={() => setViewingAttachment(item)}>{item.name}</button> : <a href={attachmentUrl(item)}>{item.name}</a>}<small>{Math.max(1, Math.round(item.size / 1024))} KB</small><a className={styles.downloadIcon} href={attachmentUrl(item)} aria-label={`${item.name}をダウンロード`} title="ダウンロード"><DownloadIcon /></a><button disabled>Bud の未処理トレイへ</button></div>; })}</section>}{showTranslation && translationView.translation ? <div className={`${styles.textBody} ${styles.translationBody}`}>{translationView.translation}</div> : detail.body.contentType === "html" ? <div className={styles.htmlBody} dangerouslySetInnerHTML={{ __html: detail.body.content }} /> : <div className={styles.textBody}>{detail.body.content}</div>}</div></>}
        <div className={styles.composeDock}>{[...drafts.values()].filter((draft) => draft.id !== activeDraftId).map((draft) => <div className={styles.composeDockItem} key={draft.id}><button onClick={() => { setActiveDraftId(draft.id); setComposeError(""); }}><span>未送信：{draft.subject || "件名なし"}</span><i>▲</i></button><button aria-label="破棄" onClick={() => discardDraft(draft.id)}>×</button></div>)}</div></article>
      </div>}
      {sendToast && <div className={`${styles.sendToast} ${sendToast.tone === "error" ? styles.sendToastError : ""}`}>{sendToast.text}{sendToast.tone === "pending" && <button onClick={() => delayedSend.current?.cancel()}>取り消す（{sendToast.seconds}秒）</button>}</div>}
      {/* GardenShell 側のスタッキング文脈にモーダルが閉じ込められ、ヘッダー(z-index:100)の下に潜るため body 直下へポータル描画する */}
      {viewingAttachment && createPortal(<div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingAttachment(null); }}><section className={styles.attachmentModal} role="dialog" aria-modal="true" aria-label={`${viewingAttachment.name}のプレビュー`}><header><h2>{viewingAttachment.name}</h2><a href={attachmentUrl(viewingAttachment)} aria-label="ダウンロード" title="ダウンロード"><DownloadIcon /></a><button onClick={() => setViewingAttachment(null)} aria-label="閉じる">×</button></header><div className={styles.viewer}>{viewingAttachment.contentType?.split(";", 1)[0].trim().toLowerCase().startsWith("image/") || (!viewingAttachment.contentType && /\.(png|jpe?g|gif|webp)$/i.test(viewingAttachment.name)) ? <img src={viewingUrl} alt={viewingAttachment.name} /> : <iframe src={viewingUrl} title={viewingAttachment.name} />}</div></section></div>, document.body)}
    </section>
  </GardenShell>;
}
