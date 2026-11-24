"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { ActionButton, ActionRow, CheckboxField, FieldLabel, ResultMessage, StatusBadge, TextArea, TextField } from "@/app/system/forms/_components/form-kit";
import SalesIcon from "@/app/system/forms/kanden/SalesIcon";
import { compressKandenPhoto } from "@/app/system/forms/kanden/photo-client";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { orderStatus } from "@/lib/leaf-kanden/status";
import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import { supplyPoint, type CalendarDay } from "@/lib/leaf-kanden/supply-point";
import shell from "@/app/soil/soil.module.css";
import PaymentDetails from "../PaymentDetails";
import CasePhotos from "../CasePhotos";
import { checkEntryDuplicates, loadEntryDetail, loadEntryList, saveEntry } from "./actions";
import { commitEntrySpecs, prepareEntrySpecs } from "./specs-actions";
import { DEFAULT_ENTRY_TAB, ENTRY_TABS, ENTRY_TITLE, PHOTO_CATEGORIES, dateFields, entryQuery, serviceFields, type EntryDetail,
  type EntryList, type EntryPhoto, type EntryQuery, type EntryRow, type EntryTab, type PhotoCategory, type SaveMode, type SearchRefinement } from "./entry";
import EntryFlow from "./EntryFlow";
import { saveEntryPhotoCategory } from "./photo-actions";
import { normalizeSalesName, selectApplyCode } from "./sales";
import EntryFields, { CheckIcon, CopyIcon, comparisonLabels, comparisonSymbols, searchSections } from "./EntryFields";
import EntrySearch from "./EntrySearch";
import styles from "./entry.module.css";

const columns: DataColumn<EntryRow>[] = [
  { id: "number", label: "管理番号", type: "text", value: row => row[1] ?? "" },
  { id: "date", label: "受注日", type: "date", value: row => row[3] ?? "" },
  { id: "name", label: "お客様名", type: "text", value: row => row[2] ?? "" },
  { id: "sales_name", label: "営業", type: "text", value: row => row[6] ?? "" },
  { id: "status", label: "ステータス", type: "text", value: row => row[4] },
  { id: "month", label: "実績月", type: "text", value: row => row[7] ?? "" },
  { id: "mailed_on", label: "郵送日", type: "date", value: row => row[8] ?? "" },
  { id: "reason", label: "理由", type: "text", value: row => row[9] ?? "" },
];
const rowKey = (row: EntryRow) => row[0];
const categories = ["すべて", ...PHOTO_CATEGORIES] as const;
const categoryIcons = { すべて: "folder", 電灯: "bolt", 動力: "plug", ガス: "flame", 諸元: "clip", 受領: "document", 未分類: "folder" } as const;
const categorySections = { すべて: null, 電灯: "has_denki", 動力: "has_douryoku", ガス: "has_gas", 諸元: null, 受領: null, 未分類: null } as const;
const advanceStatuses = ["諸元待ち", "エントリー待ち", "申込書待ち", "郵送待ち"];
const count = new Intl.NumberFormat("ja-JP");
const historyDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });
const historyValue = (value: unknown) => value == null || value === "" ? "―" : typeof value === "object" ? JSON.stringify(value) : String(value);
const firstCategory = (detail: EntryDetail | null) => {
  if (detail?.photos.length) {
    const hasPhoto = (category: typeof categories[number]) => detail.photos.some(photo => photo.category === category);
    if (hasPhoto("未分類")) return "未分類";
    return PHOTO_CATEGORIES.find(hasPhoto) ?? "すべて";
  }
  return categories.find(category => {
    const flag = categorySections[category];
    return flag && detail?.draft[flag];
  }) ?? "電灯";
};
const displayError = "案件を読み込めませんでした。もう一度お試しください。";

export default function EntryScreen({ list: initialList, initialQuery = entryQuery, calendar: initialCalendar, today,
  initialDetail = null, initialError = "", viewerId = "" }: {
  list: EntryList | null; initialQuery?: EntryQuery; calendar: CalendarDay[] | null; today: string;
  initialDetail?: EntryDetail | null; initialError?: string; viewerId?: string;
}) {
  const [list, setList] = useState(initialList);
  const [calendar, setCalendar] = useState(initialCalendar);
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<EntryTab>(DEFAULT_ENTRY_TAB);
  const [pendingTab, setPendingTab] = useState<EntryTab | null>(null);
  const [selectedId, setSelectedId] = useState(initialList?.rows[0]?.[0] ?? null);
  const [loaded, setLoaded] = useState(initialDetail);
  const [draft, setDraft] = useState(initialDetail?.draft ?? null);
  const [category, setCategory] = useState<typeof categories[number]>(firstCategory(initialDetail));
  const [listBusy, setListBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError || initialDetail?.photoError || "");
  const [success, setSuccess] = useState("");
  const [reasonMode, setReasonMode] = useState<"return" | "complete" | null>(null);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [attaching, setAttaching] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const uploadedSpecs = useRef<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState<Record<string, string>[]>([{}]);
  const [activeRequest, setActiveRequest] = useState(0);
  const [editedDuplicates, setEditedDuplicates] = useState<EntryDetail["duplicates"]>({});
  const [swapped, setSwapped] = useState(false);
  const serial = useRef(0);
  const pending = useRef(false);
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const lastDifference = useRef<HTMLElement | null>(null);
  const storageKey = `leaf-kanden-entry-panel-order/${viewerId}`;
  useEffect(() => {
    try { setSwapped(localStorage.getItem(storageKey) === "input-left"); } catch {}
  }, [storageKey]);

  const rows = list?.rows ?? [];
  const pages = Math.max(1, Math.ceil((list?.total ?? 0) / 50));
  const selectedIndex = rows.findIndex(row => row[0] === selectedId);
  const showList = tab === "一覧" && !selectedId;
  const blocked = saving || listBusy || busy;
  const canEdit = !!draft && !blocked;
  const photos = loaded?.photos.filter(photo => category === "すべて" || photo.category === category) ?? [];
  const hasSpecs = loaded?.hasSpecs ?? loaded?.photos.some(photo => photo.category === "諸元") ?? false;
  const flowInput = draft && loaded ? { ...loaded.flow, ...draft, paid_on: loaded.paidOn, refunded_on: loaded.refundedOn } : null;
  const status = flowInput && loaded ? orderStatus({
    ...flowInput,
    status: loaded.status === "差し戻し" || loaded.status === "保留" ? loaded.status : null,
  }, hasSpecs) : null;
  const progress = flowInput && orderStatus({ ...flowInput, cancelled_on: null, refunded_on: null,
    cancel_reason: status === "キャンセル" ? null : flowInput.cancel_reason }, hasSpecs);
  const sales = draft && loaded && normalizeSalesName(draft.sales_name) === normalizeSalesName(loaded.draft.sales_name)
    ? loaded.sales : undefined;
  const defaultCode = selectApplyCode(null, draft?.ordered_on ?? null, sales?.applyCodes ?? []);
  const applyCode = selectApplyCode(draft?.apply_code ?? null, draft?.ordered_on ?? null, sales?.applyCodes ?? []);
  const listValues = defaultCode ? { ...loaded?.listValues, apply_code: defaultCode } : loaded?.listValues ?? null;
  const rawNumber = draft?.kanri_no === loaded?.draft.kanri_no ? loaded?.rawNumber : draft?.kanri_no;
  const displayNumber = rawNumber && normalizeKanriNo(rawNumber) ? rawNumber.trim().replace(/^PD\s*/i, "") : draft?.kanri_no;
  const waitingDays = status === "諸元待ち" && draft?.ordered_on
    ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(draft.ordered_on)) / 86_400_000)) : null;
  const canResume = loaded?.status === "差し戻し" || loaded?.status === "保留";
  const copyKeys = searchSections.flatMap(section => section.fields.map(([key]) => key));
  const columnsWithOptions = columns.map(column => {
    const values = column.id === "status" ? ENTRY_TABS.filter(value => value !== "一覧")
      : list?.options?.[column.id as "sales_name" | "month" | "reason"];
    return values?.length ? { ...column, filterOptions: values.map(value => ({ value, label: value || "（空白）" })) } : column;
  });

  const editedMiddles = draft && loaded ? serviceFields.flatMap(([service]) => {
    const key = `${service}_supply_point` as const;
    const value = draft[key];
    return value && value !== loaded.draft[key] ? supplyPoint(value).middle ?? [] : [];
  }).join(",") : "";
  useEffect(() => {
    if (!selectedId || !editedMiddles || busy) return;
    let current = true;
    const timer = setTimeout(() => {
      void checkEntryDuplicates(selectedId, editedMiddles.split(",")).then(result => {
        if (current) setEditedDuplicates(result);
      }).catch(() => { if (current) setError("供給地点の重複を確認できませんでした。"); });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [selectedId, editedMiddles, busy]);

  function display(id: string | null, result?: Awaited<ReturnType<typeof loadEntryDetail>>) {
    const detail = result && "detail" in result ? result.detail : null;
    lastDifference.current = null;
    setSelectedId(id);
    setLoaded(detail);
    setDraft(detail?.draft ?? null);
    setCategory(firstCategory(detail));
    setEditedDuplicates({});
    setError(result && "error" in result ? result.error : detail?.photoError ?? "");
  }

  async function open(id: string) {
    const request = ++serial.current;
    setBusy(true);
    setError("");
    try {
      const result = await loadEntryDetail({ id, intake: false });
      if (request !== serial.current) return;
      if ("error" in result) setError(result.error);
      else display(id, result);
    } catch {
      if (request === serial.current) setError(displayError);
    } finally {
      if (request === serial.current) setBusy(false);
    }
  }

  async function readList(nextTab: EntryTab, nextQuery: EntryQuery, options: {
    counts?: boolean; refresh?: boolean; pick?: "first" | "last"; currentId?: string;
  } = {}) {
    const request = ++serial.current;
    setListBusy(true);
    setError("");
    try {
      const result = await loadEntryList(nextTab, nextQuery, !!options.counts, !!options.refresh, options.currentId ?? options.pick);
      if (request !== serial.current) return;
      if (!result.list) { setError(result.error); return; }
      const incoming = result.list;
      if (result.calendar !== undefined) setCalendar(result.calendar);
      setList(previous => ({ ...incoming, counts: incoming.counts ?? previous?.counts ?? null,
        options: incoming.options ?? previous?.options ?? null,
        updatedAt: options.counts ? incoming.updatedAt : previous?.updatedAt ?? null }));
      setQuery({ ...nextQuery, page: incoming.page });
      setTab(nextTab);
      if (options.pick || options.currentId) display(result.detailId ?? null, result.selectedDetail);
      else if (nextTab === "一覧" && tab !== "一覧") display(null);
      return incoming;
    } catch {
      if (request === serial.current) setError(displayError);
    } finally {
      if (request === serial.current) setListBusy(false);
    }
  }

  function canLeave() {
    return !draft || draft === loaded?.draft || window.confirm("保存していない入力があります。別の案件を開きますか？");
  }

  async function move(direction: -1 | 1) {
    if (blocked || pending.current || !canLeave()) return;
    setSuccess("");
    const index = selectedIndex < 0 ? (direction === 1 ? 0 : rows.length - 1) : selectedIndex + direction;
    const row = rows[index];
    if (row) await open(row[0]);
    else if (query.page + direction >= 1 && query.page + direction <= pages) {
      await readList(tab, { ...query, page: query.page + direction }, { pick: direction === 1 ? "first" : "last" });
    }
  }

  async function save(mode: SaveMode) {
    if (!selectedId || !draft || !loaded || blocked || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await saveEntry({ id: selectedId, intake: false }, loaded.version, draft, mode, reason, notify);
      if ("error" in result) { setError(result.error ?? "保存できませんでした。"); return; }
      setReasonMode(null);
      setLoaded({ ...loaded, draft });
      const next = mode === "entry" || mode === "complete";
      const following = next && selectedIndex >= 0 ? rows[selectedIndex + 1]?.[0] : undefined;
      const boundary = next && !following && selectedIndex >= 0 && query.page < pages;
      // An advanced record leaves its status tab, so the next record can move onto this page.
      const nextPage = boundary && (tab === "一覧" || result.status === tab) ? query.page + 1 : query.page;
      const refreshed = await readList(tab, { ...query, page: nextPage }, {
        counts: true, currentId: boundary ? undefined : following ?? result.id,
        pick: boundary && nextPage !== query.page ? "first" : undefined,
      });
      if (boundary && nextPage === query.page && refreshed) await open(refreshed.rows[selectedIndex]?.[0] ?? result.id);
      setSuccess(mode === "entry" ? "エントリー日を保存しました。" : mode === "complete" ? "完了処理を確定しました。" : "保存しました。");
      if (result.noticeError) setError(result.noticeError);
    } catch {
      setError("保存結果を確認できませんでした。一覧を読み直してください。");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function attachSpecs() {
    if (!selectedId || !files.length || files.length > 10 || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      if (!uploadedSpecs.current) {
        const images = await Promise.all(files.map(compressKandenPhoto));
        const prepared = await prepareEntrySpecs(selectedId, images.length);
        if (!prepared.uploads) throw new Error(prepared.error);
        await Promise.all(prepared.uploads.map(async ({ url }, index) => {
          const response = await fetch(url, { method: "PUT", body: images[index],
            headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }, signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error("写メを送れませんでした。");
        }));
        uploadedSpecs.current = prepared.uploads.map(upload => upload.path);
      }
      const result = await commitEntrySpecs(selectedId, uploadedSpecs.current);
      if (result.error) throw new Error(result.error);
      setAttaching(false);
      await readList(tab, query, { counts: true, currentId: selectedId });
      setCategory("諸元");
      setSuccess("諸元を添付しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "諸元を添付できませんでした。");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function changePhotoCategory(photo: EntryPhoto, nextCategory: PhotoCategory) {
    if (!loaded || !selectedId || blocked || pending.current || photo.category === nextCategory) return;
    pending.current = true;
    setSaving(true);
    setError("");
    const nextPhotos = loaded.photos.map(item => item.id === photo.id && item.setId === photo.setId
      ? { ...item, category: nextCategory } : item);
    const next = { ...loaded, photos: nextPhotos, hasSpecs: nextPhotos.some(item => item.category === "諸元") };
    setLoaded(next);
    if (category !== "すべて" && !nextPhotos.some(item => item.category === category)) setCategory(firstCategory(next));
    try {
      const result = await saveEntryPhotoCategory({ id: selectedId, intake: false }, photo.id, photo.setId, nextCategory);
      if (result.error) throw new Error(result.error);
    } catch {
      setLoaded(loaded);
      setCategory(category);
      setError("写メの種類を保存できませんでした。もう一度お試しください。");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  function jumpToDiff() {
    const candidates = Array.from(fieldset.current?.querySelectorAll<HTMLElement>('[data-comparison="different"]') ?? []);
    const activeField = document.activeElement?.closest("[data-comparison]");
    const activeIndex = candidates.findIndex(element => element === activeField);
    const index = activeIndex >= 0 ? activeIndex : candidates.findIndex(element => element === lastDifference.current);
    const next = candidates[(index + 1) % candidates.length];
    if (!next) { setSuccess("要確認の欄はありません。"); return; }
    lastDifference.current = next;
    next.closest("section")?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
    requestAnimationFrame(() => next.querySelector<HTMLElement>("input, select, textarea")?.focus());
  }

  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.metaKey || event.isComposing || event.defaultPrevented || event.repeat ||
        document.querySelector('dialog[open], [role="dialog"]')) return;
    if (event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (!blocked) setSearching(true);
    } else if (searching && event.ctrlKey && event.key === "Enter" && requests.length < 20 && !blocked) {
      event.preventDefault();
      setActiveRequest(requests.length);
      setRequests([...requests, {}]);
    } else if (!searching && !showList && event.ctrlKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      void move(event.key === "ArrowUp" ? -1 : 1);
    } else if (!searching && !showList && event.ctrlKey && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
      event.preventDefault();
      void save(event.key === "Enter" ? "entry" : "save");
    } else if (!searching && canEdit && !event.ctrlKey && event.key === "Enter" &&
      !(event.target instanceof HTMLElement && event.target.closest("textarea, button, select, input[type=checkbox], input[type=radio]"))) {
      event.preventDefault();
      jumpToDiff();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  function executeSearch(scope: "all" | "tab" | SearchRefinement["mode"]) {
    if (blocked) return;
    const criteria = requests.map(request => Object.fromEntries(Object.entries(request)
      .flatMap(([key, value]) => value.trim() ? [[key, value.trim()]] : []))).filter(request => Object.keys(request).length);
    if (!criteria.length) { setError("検索条件を入力してください。"); return; }
    if (!canLeave()) return;
    const destination = scope === "all" ? "一覧" : tab;
    const nextQuery: EntryQuery = scope === "constrain" || scope === "extend"
      ? { ...query, page: 1, refinements: [...(query.refinements ?? []), { mode: scope, requests: criteria }] }
      : { ...entryQuery, requests: criteria };
    void readList(destination, nextQuery, destination === "一覧" ? {} : { pick: "first" }).then(result => {
      if (!result) return;
      if (destination === "一覧") display(null);
      setSearching(false);
    });
  }

  return <section className={shell.pageShell + " " + styles.layout}>
    <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "関電" }]} />
    <h1 data-page-search-heading>{ENTRY_TITLE}</h1>
    <UpdatedStampRow>
      <UpdatedStamp label="事務入力" date={list?.updatedAt} emptyText="記録なし" showSeconds busy={listBusy} disabled={blocked}
        refreshLabel="事務入力を読み直す" onRefresh={() => {
          if (blocked) return;
          void readList(tab, query, { counts: true, refresh: true,
            currentId: selectedId && (!draft || draft === loaded?.draft) ? selectedId : undefined,
            pick: !selectedId && tab !== "一覧" ? "first" : undefined });
        }} />
    </UpdatedStampRow>
    <SystemTabs aria-label="案件の状況" className={styles.statusTabs}>
      {ENTRY_TABS.map(label => <button key={label} type="button" role="tab" aria-selected={(pendingTab ?? tab) === label} disabled={blocked}
        onClick={() => {
          if (label === tab || blocked || !canLeave()) return;
          setPendingTab(label);
          void readList(label, entryQuery, label === "一覧" ? {} : { pick: "first" }).then(result => {
            if (result) { setSearching(false); setSuccess(""); }
          }).finally(() => setPendingTab(null));
        }}>{label}{label !== "一覧" && <StatusBadge muted>{count.format(list?.counts?.[label] ?? 0)}</StatusBadge>}</button>)}
    </SystemTabs>
    <div data-loading={listBusy} aria-busy={listBusy}>
      {!searching && !showList && draft && loaded && status && progress &&
        <EntryFlow draft={draft} paidOn={loaded.paidOn} status={status} progress={progress} canEdit={canEdit}
          specsReady={hasSpecs || !!loaded.flow?.timetree_label?.trim() && loaded.flow.timetree_label.trim() !== "諸元待ち"}
          setDraft={setDraft} />}
      <ResultMessage>{error || (!list && "案件一覧を読み込めませんでした。更新ボタンを押してください。")
        || (!calendar && "供給開始カレンダーを読み込めませんでした。")}</ResultMessage>
      <ResultMessage success>{success}</ResultMessage>
      {searching ? <EntrySearch requests={requests} setRequests={setRequests} active={activeRequest} setActive={setActiveRequest}
        busy={blocked} canRefine={!!query.requests && (query.refinements?.length ?? 0) < 10}
        onSearch={executeSearch} onClose={() => { setSearching(false); setError(""); }} /> : showList ?
        <>
          <ActionRow>
            <ActionButton disabled={blocked} onClick={() => setSearching(true)}>条件検索（Ctrl+F）</ActionButton>
            {query.requests && <ActionButton disabled={blocked} onClick={() => void readList(tab, entryQuery)}>検索条件を解除</ActionButton>}
          </ActionRow>
          <DataTable rows={rows} columns={columnsWithOptions} rowKey={rowKey} defaultSort={entryQuery.sort} pageSize={50}
            loading={blocked} remote={{ query, total: list?.total ?? 0, onChange: next => {
              if (!blocked) void readList(tab, { ...query, ...next });
            } }} searchPlaceholder="PD番号・お客様名・カナ・住所・電話・供給地点・理由"
            onRowClick={row => { if (!blocked) void open(row[0]); }} emptyText="該当する案件はありません。" />
        </> : <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarActions}>
              {tab === "一覧" && <ActionButton disabled={blocked} onClick={() => { if (canLeave()) display(null); }}>一覧へ戻る</ActionButton>}
              <ActionButton disabled={!canEdit} onClick={() => setReasonMode("complete")}>完了処理</ActionButton>
              <ActionButton disabled={!canEdit} onClick={() => { setReason(""); setNotify(true); setReasonMode("return"); }}>差し戻し</ActionButton>
              <ActionButton disabled={!canEdit || !listValues} onClick={() => {
                if (draft && listValues) setDraft({ ...draft, ...Object.fromEntries(copyKeys.flatMap(key => {
                  const value = listValues[key];
                  return value == null || value === "" ? [] : [[key, value]];
                })) });
              }}><CopyIcon />リスト全項目転記</ActionButton>
              <ActionButton disabled={!canEdit} onClick={jumpToDiff}>→ 次の要確認（Enter）</ActionButton>
              <ActionButton disabled={blocked} onClick={() => setSearching(true)}>検索（Ctrl+F）</ActionButton>
              {query.requests && <ActionButton disabled={blocked} onClick={() => {
                if (canLeave()) void readList(tab, entryQuery, { pick: "first" });
              }}>検索条件を解除</ActionButton>}
              <span aria-live="polite">レコード {selectedIndex < 0 ? "―" : count.format((query.page - 1) * 50 + selectedIndex + 1)} / {count.format(list?.total ?? 0)}</span>
              <ActionButton disabled={blocked || !rows.length || (selectedIndex === 0 && query.page === 1)} onClick={() => void move(-1)}>← 前へ（Ctrl+↑）</ActionButton>
              <ActionButton disabled={blocked || !rows.length || (selectedIndex === rows.length - 1 && query.page === pages)} onClick={() => void move(1)}>次へ（Ctrl+↓）→</ActionButton>
              <ActionButton disabled={blocked} aria-pressed={swapped} onClick={() => {
                const next = !swapped;
                setSwapped(next);
                try { localStorage.setItem(storageKey, next ? "input-left" : "preview-left"); } catch {}
              }}>左右入替</ActionButton>
            </div>
            <div className={styles.legend} aria-label="照合の凡例">{(Object.keys(comparisonLabels) as (keyof typeof comparisonLabels)[]).map(key =>
              <span key={key} data-comparison={key}><span className={styles.comparison} aria-hidden="true">{comparisonSymbols[key]}</span>{comparisonLabels[key]}</span>)}</div>
          </div>
          {(busy || listBusy) && <span className={styles.live} role="status">案件を読み込み中</span>}
          {!draft || !loaded ? <p>{blocked ? "読み込み中…" : "表示できる案件はありません。"}</p> : <div aria-busy={blocked} {...CLARITY_MASK}>
            {loaded.listValues === null && <p>リストに無い案件</p>}
            <div className={styles.banner}>
              <span>PD番号　{displayNumber ? `PD${displayNumber}` : "―"}</span>
              <span>獲得営業担当　{sales?.name || draft.sales_name || "―"}</span>
              <span>社員番号　{sales?.number || "―"}</span>
              <span>部署　{sales?.department || "―"}</span>
              <span>申込コード　{applyCode || "―"}</span>
            </div>
            {!!loaded.related?.length && <div className={styles.banner}>関連案件
              {loaded.related.map(row => <ActionButton key={row.id} disabled={blocked} onClick={() => {
                if (canLeave()) void open(row.id);
              }}>{row.number} {row.name}</ActionButton>)}
            </div>}
            {(waitingDays !== null || loaded.reason || canResume) && <div className={styles.banner}>
              {waitingDays !== null && <span className={styles.stagnant} data-stagnant={waitingDays >= 30}>
                諸元回収待ち {waitingDays}日{waitingDays >= 30 && "（30日以上経過）"}
              </span>}
              {loaded.reason && <span>理由　{loaded.reason}</span>}
              {canResume &&
                <ActionButton disabled={!canEdit} onClick={() => void save("resume")}>再開</ActionButton>}
            </div>}
            <div className={styles.columns} data-swapped={swapped}>
              <section className={styles.preview} aria-label="申込書プレビュー">
                <CasePhotos key={`${selectedId}/${category}`} photos={photos}
                  emptyText={`表示できる${category}の写メはありません。`} entry
                  photoControls={(photo, position) => <div className={styles.photoCategory} role="radiogroup"
                    aria-label={`写メ ${position + 1} の種類`}>
                    {PHOTO_CATEGORIES.map(label => <button key={label} type="button" role="radio"
                      aria-checked={photo.category === label} disabled={!canEdit || saving}
                      onClick={() => void changePhotoCategory(photo, label)}>{label}</button>)}
                  </div>} />
              </section>
              <div className={styles.categoryRail}>
                <div role="tablist" aria-label="書類の種類" className={styles.categories}>
                  {categories.map(label => <button key={label} type="button" role="tab" aria-selected={label === category}
                    disabled={blocked} onClick={() => {
                      setCategory(label);
                      const section = categorySections[label];
                      if (section) document.getElementById(`entry-${section}`)?.querySelector<HTMLButtonElement>(
                        'button[aria-expanded="false"]',
                      )?.click();
                    }}><SalesIcon name={categoryIcons[label]} /><span>{label}</span></button>)}
                </div>
              </div>
              <section className={styles.input} aria-label="入力">
                <fieldset ref={fieldset} className={styles.fieldset} disabled={!canEdit}>
                  <EntryFields key={selectedId} draft={draft} setDraft={setDraft} listValues={listValues}
                    options={list?.options} calendar={calendar ?? []} today={today}
                    duplicateNumbers={middle => editedDuplicates[middle] ?? loaded.duplicates[middle] ?? []}
                    specsAlert={<div className={styles.banner}>
                      {!hasSpecs && <span>諸元の写メが添付されていません。</span>}
                      <ActionButton onClick={() => {
                        if (!canLeave()) return;
                        uploadedSpecs.current = null;
                        setFiles([]);
                        setAttaching(true);
                      }}>諸元を添付</ActionButton>
                    </div>} />
                </fieldset>
                <fieldset className={styles.fieldset} disabled={!canEdit}>
                  <ActionRow>{dateFields.filter(([key]) => key === "invoice_sent_on" || key === "cancelled_on").map(([key, label]) =>
                    <FieldLabel key={key} label={label}><TextField type="date" aria-label={label} value={draft[key] ?? ""}
                      onChange={event => setDraft({ ...draft, [key]: event.target.value || null })} /></FieldLabel>)}</ActionRow>
                </fieldset>
                <PaymentDetails rows={loaded.payments} paidOn={loaded.paidOn} refundedOn={loaded.refundedOn} />
                {!!loaded.history.length && <details>
                  <summary>変更履歴（{loaded.history.length}件）</summary>
                  <ul className={styles.history}>{loaded.history.map(change => <li key={change.id}>
                    <time dateTime={change.changed_at}>{historyDate.format(new Date(change.changed_at))}</time>
                    {" "}{change.changed_by} ／ {dateFields.find(([key]) => key === change.field)?.[1] ?? change.field}
                    {" "}{historyValue(change.old_value)} → {historyValue(change.new_value)}
                  </li>)}</ul>
                </details>}
                <ActionRow>
                  <ActionButton disabled={!canEdit} onClick={() => void save("entry")}><CheckIcon />エントリーして次へ（Ctrl+Enter）</ActionButton>
                  <ActionButton disabled={!canEdit} onClick={() => void save("save")}>保存（Ctrl+S）</ActionButton>
                  {status === "完了" ? <ActionButton disabled={!canEdit} onClick={() => setReasonMode("complete")}>完了処理</ActionButton>
                    : advanceStatuses.includes(loaded.status) &&
                      <ActionButton disabled={!canEdit} onClick={() => void save("advance")}>保存して次のステータスへ</ActionButton>}
                </ActionRow>
              </section>
            </div>
          </div>}
        </>}
    </div>
    {reasonMode && <Modal title={reasonMode === "return" ? "差し戻しの理由" : "完了処理"}
      size="sm" dismissible={!saving} onClose={() => setReasonMode(null)}>
      <ResultMessage>{error}</ResultMessage>
      <form onSubmit={event => { event.preventDefault(); void save(reasonMode); }}>
        {reasonMode === "return" ? <>
          <TextArea aria-label="理由" value={reason} maxLength={2000} required onChange={event => setReason(event.target.value)} />
          <CheckboxField checked={notify} onChange={event => setNotify(event.target.checked)}>営業に知らせる（Chatwork）</CheckboxField>
        </> : <p>入金日　{loaded?.paidOn ?? "―"}。この案件の完了処理を確定します。</p>}
        <ActionRow>
          <ActionButton disabled={saving} onClick={() => setReasonMode(null)}>閉じる</ActionButton>
          <ActionButton type="submit" disabled={saving || (reasonMode === "return" && !reason.trim())}>確定</ActionButton>
        </ActionRow>
      </form>
    </Modal>}
    {attaching && <Modal title="諸元を添付" size="sm" dismissible={!saving} onClose={() => setAttaching(false)}>
      <ResultMessage>{error}</ResultMessage>
      <form onSubmit={event => { event.preventDefault(); void attachSpecs(); }}>
        <FieldLabel label="諸元の写メ（最大10枚）"><TextField type="file" aria-label="諸元の写メ" multiple
          accept="image/*,.heic,.heif" disabled={saving} onChange={event => {
            uploadedSpecs.current = null;
            setFiles(Array.from(event.target.files ?? []));
          }} /></FieldLabel>
        {files.length > 10 && <ResultMessage>写メは10枚まで選べます。</ResultMessage>}
        <ActionRow>
          <ActionButton disabled={saving} onClick={() => setAttaching(false)}>閉じる</ActionButton>
          <ActionButton type="submit" disabled={saving || !files.length || files.length > 10}>添付する</ActionButton>
        </ActionRow>
      </form>
    </Modal>}
  </section>;
}
