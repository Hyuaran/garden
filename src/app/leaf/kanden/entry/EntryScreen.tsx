"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import DataTable, { type DataColumn, type TableQuery } from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { ActionButton, ActionRow, ResultMessage, StatusBadge, TextArea } from "@/app/system/forms/_components/form-kit";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { supplyPoint, type CalendarDay } from "@/lib/leaf-kanden/supply-point";
import shell from "@/app/soil/soil.module.css";
import PaymentDetails from "../PaymentDetails";
import CasePhotos from "../CasePhotos";
import { checkEntryDuplicates, loadEntryDetail, loadEntryList, saveEntry } from "./actions";
import { ENTRY_TABS, ENTRY_TITLE, dateFields, entryQuery, serviceFields, type EntryDetail, type EntryDraft,
  type EntryList, type EntryRow, type EntryTab, type EntryTarget, type SaveMode } from "./entry";
import EntryFields from "./EntryFields";
import styles from "./entry.module.css";

const columns: DataColumn<EntryRow>[] = [
  { id: "number", label: "管理番号", type: "text", align: "fixed", value: row => row[1] ?? "" },
  { id: "name", label: "お客様名", type: "text", value: row => row[2] ?? "", render: row => <span className={styles.name} title={row[2] ?? undefined}>{row[2]}</span> },
  { id: "date", label: "受注日", type: "date", align: "fixed", value: row => row[3] ?? "",
    render: row => shortDate(row[3]) },
];
const rowKey = (row: EntryRow) => row[0];
const shortDate = (date: string | null) => date?.slice(5).replace("-", "/") ?? "―";
const panels = ["一覧", "入力", "書類"] as const;
const categories = ["電灯", "動力", "ガス", "諸元", "受領"] as const;
const count = new Intl.NumberFormat("ja-JP");
const historyDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" });
const historyValue = (value: unknown) => value == null || value === "" ? "―" : String(value);

function tabButton(label: string, selected: boolean, onClick: () => void, badge?: ReactNode) {
  return <button key={label} type="button" role="tab" aria-selected={selected} onClick={onClick}>{label}{badge}</button>;
}

export default function EntryScreen({ list: initialList, initialQuery = entryQuery, calendar: initialCalendar, today }: {
  list: EntryList | null; initialQuery?: TableQuery; calendar: CalendarDay[] | null; today: string;
}) {
  const [list, setList] = useState(initialList);
  const [calendar, setCalendar] = useState(initialCalendar);
  const [query, setQuery] = useState(initialQuery);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState("");
  const listSerial = useRef(0);
  const [tab, setTab] = useState<EntryTab>("受付待ち");
  const [panel, setPanel] = useState<typeof panels[number]>("一覧");
  const [category, setCategory] = useState<typeof categories[number]>("電灯");
  const [photoDialog, setPhotoDialog] = useState(false);
  const [target, setTarget] = useState<EntryTarget | null>(null);
  const [loaded, setLoaded] = useState<EntryDetail | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reasonMode, setReasonMode] = useState<"hold" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const pending = useRef(false);
  const serial = useRef(0);

  const rows = list?.rows ?? [];
  const pages = Math.max(1, Math.ceil((list?.total ?? 0) / 50));
  const [editedDuplicates, setEditedDuplicates] = useState<EntryDetail["duplicates"]>({});
  const editedMiddles = draft && loaded ? serviceFields.flatMap(([service]) => {
    const key = (service + "_supply_point") as keyof EntryDraft;
    const value = draft[key];
    return typeof value === "string" && value !== loaded.draft[key] ? supplyPoint(value).middle ?? [] : [];
  }).join(",") : "";
  const selectedId = target?.id;
  useEffect(() => {
    if (!selectedId || !editedMiddles) return;
    let current = true;
    const timer = setTimeout(() => {
      void checkEntryDuplicates(selectedId, editedMiddles.split(",")).then(result => {
        if (current) setEditedDuplicates(result);
      }).catch(() => { if (current) setError("供給地点の重複を確認できませんでした。"); });
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [selectedId, editedMiddles]);

  async function readList(nextTab: EntryTab, nextQuery: TableQuery, counts = false, refreshCalendar = false) {
    const request = ++listSerial.current;
    setListBusy(true);
    setListError("");
    try {
      const result = refreshCalendar
        ? await loadEntryList(nextTab, nextQuery, counts, true)
        : await loadEntryList(nextTab, nextQuery, counts);
      if (request !== listSerial.current) return;
      if (!result.list) { setListError(result.error); return; }
      const { list: incoming } = result;
      if (result.calendar !== undefined) setCalendar(result.calendar);
      setList(previous => ({ ...incoming, counts: incoming.counts ?? previous?.counts ?? null,
        options: incoming.options ?? previous?.options ?? null,
        updatedAt: counts ? incoming.updatedAt : previous?.updatedAt ?? null }));
      setQuery({ ...nextQuery, page: incoming.page });
      setTab(nextTab);
      return incoming.rows;
    } catch {
      if (request === listSerial.current) setListError("案件一覧を読み込めませんでした。");
    } finally {
      if (request === listSerial.current) setListBusy(false);
    }
  }

  async function open(next: EntryTarget, showInput = true) {
    const request = ++serial.current;
    setTarget(next);
    setEditedDuplicates({});
    setLoaded(null);
    setDraft(null);
    setBusy(true);
    setError("");
    if (showInput) {
      setPanel("入力");
      setCategory("電灯");
    }
    try {
      const result = await loadEntryDetail(next);
      if (serial.current !== request) return;
      if ("error" in result) setError(result.error);
      else {
        setLoaded(result.detail);
        setDraft(result.detail.draft);
        setError(result.detail.photoError ?? "");
      }
    } catch {
      if (serial.current === request) setError("案件を読み込めませんでした。もう一度お試しください。");
    } finally {
      if (serial.current === request) setBusy(false);
    }
  }

  function canLeave() {
    return !draft || draft === loaded?.draft || window.confirm("保存していない入力があります。別の案件を開きますか？");
  }

  function openRow(row: EntryRow) {
    if (pending.current || listBusy || !canLeave()) return;
    setSuccess("");
    void open({ id: row[0], intake: row[4] === "受付待ち" });
  }

  const selectedIndex = rows.findIndex(row => row[0] === target?.id);

  async function move(direction: -1 | 1) {
    if (pending.current || listBusy || !canLeave()) return;
    const index = selectedIndex < 0 ? (direction === 1 ? 0 : rows.length - 1) : selectedIndex + direction;
    let row: EntryRow | undefined = rows[index];
    const page = query.page + direction;
    if (!row && page >= 1 && page <= pages) {
      const before = serial.current;
      const next = await readList(tab, { ...query, page });
      if (serial.current !== before || pending.current) return;
      row = direction === 1 ? next?.[0] : next?.at(-1);
    }
    if (row) {
      setSuccess("");
      await open({ id: row[0], intake: row[4] === "受付待ち" });
    }
  }

  async function save(mode: SaveMode) {
    if (!target || !draft || !loaded || busy || listBusy || pending.current) return;
    let next = mode === "entry" && selectedIndex >= 0 ? rows[selectedIndex + 1] : undefined;
    pending.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    setReasonMode(null);
    try {
      const result = await saveEntry(target, loaded.version, draft, mode, reason);
      if ("error" in result) {
        setError(result.error ?? "保存できませんでした。");
        if (mode === "hold" || mode === "return") setReasonMode(mode);
        return;
      }
      setSuccess(mode === "entry" ? "エントリー日を保存しました。" : "保存しました。");
      const refreshed = await readList(tab, query, true);
      if (mode === "entry" && selectedIndex >= 0 && !next && query.page < pages) {
        next = refreshed?.[selectedIndex];
        if (!next || next[0] === result.id) next = (await readList(tab, { ...query, page: query.page + 1 }))?.[0];
        if (next?.[0] === result.id) next = undefined;
      }
      await (next ? open({ id: next[0], intake: next[4] === "受付待ち" }) : open({ id: result.id, intake: false }, false));
      if (result.noticeError) setError(result.noticeError);
    } catch {
      setError("保存結果を確認できませんでした。一覧を読み直してください。");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.defaultPrevented ||
        document.querySelector('dialog[open], [role="dialog"]')) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (!event.repeat) move(event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Enter" || event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!event.repeat) void save(event.key === "Enter" ? "entry" : "save");
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const photos = loaded?.photos.filter(photo => photo.category === category || photo.category === "未分類") ?? [];
  const canEdit = !!draft && !saving && !busy;
  return <section className={shell.pageShell + " " + styles.layout}>
    <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "関電" }]} />
    <h1 data-page-search-heading>{ENTRY_TITLE}</h1>
    <UpdatedStampRow>
      <UpdatedStamp label="事務入力" date={list?.updatedAt} emptyText="記録なし" showSeconds busy={listBusy} disabled={saving}
        refreshLabel="事務入力を読み直す" onRefresh={() => {
        if (pending.current) return;
        void readList(tab, query, true, true);
        if (target && (!draft || draft === loaded?.draft)) void open(target, false);
      }} />
    </UpdatedStampRow>
    <SystemTabs aria-label="案件の状況" className={styles.statusTabs}>
      {ENTRY_TABS.map(label => tabButton(label, tab === label, () => { if (!pending.current && (label !== tab || listBusy)) void readList(label, { ...query, page: 1 }, true); },
        <StatusBadge muted>{count.format(list?.counts?.[label] ?? 0)}</StatusBadge>))}
    </SystemTabs>
    <ResultMessage>{listError || error || (!list && "案件一覧を読み込めませんでした。更新ボタンを押してください。")
      || (!calendar && "供給開始カレンダーを読み込めませんでした。")}</ResultMessage>
    <ResultMessage success>{success}</ResultMessage>
    <div className={styles.panelTabs}>
      <SystemTabs aria-label="作業欄" pageActions={false}>
        {panels.map(label => tabButton(label, panel === label, () => setPanel(label)))}
      </SystemTabs>
    </div>
    <div className={styles.columns} {...CLARITY_MASK}>
      <section className={styles.panel} data-active={panel === "一覧"} aria-label="一覧">
        <h2>一覧</h2>
        <ActionRow>
          <ActionButton onClick={() => move(-1)} disabled={saving || listBusy || (!rows.length || (selectedIndex === 0 && query.page === 1))}>前へ</ActionButton>
          <ActionButton onClick={() => move(1)} disabled={saving || listBusy || (!rows.length || (selectedIndex + 1 >= rows.length && query.page === pages))}>次へ</ActionButton>
          <small>Ctrl+↑／↓</small>
        </ActionRow>
        <DataTable rows={rows} columns={columns} rowKey={rowKey}
          defaultSort={entryQuery.sort} pageSize={50} selectedKey={selectedId} loading={listBusy || saving}
          remote={{ query, total: list?.total ?? 0, onChange: next => { if (!pending.current) void readList(tab, next); } }}
          searchPlaceholder="管理番号・お客様名・カナ・住所・電話・供給地点"
          onRowClick={openRow} emptyText="該当する案件はありません。" />
      </section>
      <section className={styles.panel} data-active={panel === "入力"} aria-label="入力">
        <h2>入力 {loaded && <StatusBadge muted>{target?.intake ? "受付待ち" : loaded.status}</StatusBadge>}</h2>
        {busy ? <p role="status">読み込み中…</p> : !draft ? <p>一覧から案件を選んでください。</p> : <>
          {loaded?.reason && <p>
            {(loaded.status === "保留" || loaded.status === "差し戻し") && `${loaded.status}の理由　`}
            {loaded.reason}
          </p>}
          <fieldset className={styles.fieldset} disabled={!canEdit}>
            <EntryFields draft={draft} setDraft={setDraft} options={list?.options}
              calendar={calendar ?? []} today={today} duplicateNumbers={middle =>
                editedDuplicates[middle] ?? loaded?.duplicates[middle] ?? []} />
          </fieldset>
          {loaded && !target?.intake && <PaymentDetails rows={loaded.payments} paidOn={loaded.paidOn} refundedOn={loaded.refundedOn} />}
          {!!loaded?.history.length && <details>
            <summary>変更履歴（{loaded.history.length}件）</summary>
            <ul className={styles.history}>{loaded.history.map(change => <li key={change.id}>
              <time dateTime={change.changed_at}>{historyDate.format(new Date(change.changed_at))}</time>
              {" "}{change.changed_by} ／ {dateFields.find(([key]) => key === change.field)?.[1] ?? change.field}
              {" "}{historyValue(change.old_value)} → {historyValue(change.new_value)}
            </li>)}</ul>
          </details>}
          <ActionRow>
            <ActionButton disabled={!canEdit} onClick={() => { setReason(""); setReasonMode("hold"); }}>保留</ActionButton>
            <ActionButton disabled={!canEdit} onClick={() => { setReason(""); setReasonMode("return"); }}>差し戻し</ActionButton>
            {loaded && (loaded.status === "保留" || loaded.status === "差し戻し") &&
              <ActionButton disabled={!canEdit} onClick={() => void save("resume")}>再開</ActionButton>}
            <ActionButton disabled={!canEdit} onClick={() => void save("save")}>保存 <small>Ctrl+S</small></ActionButton>
            <ActionButton disabled={!canEdit} onClick={() => void save("entry")}>エントリーして次へ <small>Ctrl+Enter</small></ActionButton>
          </ActionRow>
        </>}
      </section>
      <section className={styles.panel} data-active={panel === "書類"} aria-label="書類">
        <h2>書類</h2>
        <SystemTabs aria-label="書類の種類" pageActions={false}>
          {categories.map(label => tabButton(label, category === label, () => setCategory(label)))}
        </SystemTabs>
        {photos.length ? <>
          <ActionButton onClick={() => setPhotoDialog(true)}>写メを大きく</ActionButton>
          <CasePhotos key={`${target?.id}/${category}/${photos[0].url}`} photos={photos} entry />
        </>
          : <p>{busy ? "読み込み中…" : "表示できる写メはありません。"}</p>}
      </section>
    </div>
    {photoDialog && photos.length > 0 && <Modal title={`${category}の写メ`} size="lg" onClose={() => setPhotoDialog(false)}>
      <CasePhotos photos={photos} entry />
    </Modal>}
    {reasonMode && <Modal title={reasonMode === "hold" ? "保留の理由" : "差し戻しの理由"}
      size="sm" onClose={() => setReasonMode(null)}>
      <ResultMessage>{error}</ResultMessage>
      <form onSubmit={event => { event.preventDefault(); void save(reasonMode); }}>
        <TextArea aria-label="理由" value={reason} maxLength={2000} required onChange={event => setReason(event.target.value)} />
        <ActionRow>
          <ActionButton onClick={() => setReasonMode(null)}>閉じる</ActionButton>
          <ActionButton type="submit" disabled={!reason.trim() || saving}>保存</ActionButton>
        </ActionRow>
      </form>
    </Modal>}
  </section>;
}
