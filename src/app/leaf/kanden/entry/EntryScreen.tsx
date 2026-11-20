"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import Modal from "@/app/system/_components/Modal/Modal";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { ActionButton, ActionRow, ResultMessage, StatusBadge, TextArea } from "@/app/system/forms/_components/form-kit";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import { supplyPoint, type CalendarDay } from "@/lib/leaf-kanden/supply-point";
import shell from "@/app/soil/soil.module.css";
import CasePhotos from "../CasePhotos";
import { loadEntryDetail, saveEntry } from "./actions";
import { ENTRY_TABS, ENTRY_TITLE, type EntryDetail, type EntryDraft,
  type EntryList, type EntryRow, type EntryTab, type EntryTarget, type SaveMode } from "./entry";
import EntryFields from "./EntryFields";
import styles from "./entry.module.css";

const columns: DataColumn<EntryRow>[] = [
  { id: "number", label: "管理番号", type: "text", align: "fixed", value: row => row[1] ?? "" },
  { id: "name", label: "お客様名", type: "text", value: row => row[2] ?? "", wrap: true },
  { id: "date", label: "受注日", type: "text", align: "fixed", value: row => row[3] ?? "",
    render: row => row[3]?.slice(5).replace("-", "/") ?? "―" },
];
const rowKey = (row: EntryRow) => row[0];
const searchText = (row: EntryRow) => row[5];
const panels = ["一覧", "入力", "書類"] as const;
const categories = ["電灯", "動力", "ガス", "諸元", "受領"] as const;
const count = new Intl.NumberFormat("ja-JP");

function tabButton(label: string, selected: boolean, onClick: () => void, badge?: ReactNode) {
  return <button key={label} type="button" role="tab" aria-selected={selected} onClick={onClick}>{label}{badge}</button>;
}

function duplicatesByMiddle(rows: EntryRow[]) {
  const index = new Map<string, EntryRow[]>();
  for (const row of rows) {
    const middles = new Set(row[6]?.map(value => value && supplyPoint(value).middle));
    for (const middle of middles) {
      if (!middle) continue;
      const matches = index.get(middle);
      if (matches) matches.push(row);
      else index.set(middle, [row]);
    }
  }
  return index;
}

export default function EntryScreen({ list, calendar, today }: {
  list: EntryList | null; calendar: CalendarDay[] | null; today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<EntryTab>("受付待ち");
  const [panel, setPanel] = useState<typeof panels[number]>("一覧");
  const [category, setCategory] = useState<typeof categories[number]>("電灯");
  const [photoDialog, setPhotoDialog] = useState(false);
  const [sortedRows, setSortedRows] = useState<EntryRow[]>([]);
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

  const rows = useMemo(() => list?.rows.filter(row => row[4] === tab) ?? [], [list, tab]);
  const counts = useMemo(() => {
    const values = new Map<EntryTab, number>();
    for (const row of list?.rows ?? []) values.set(row[4], (values.get(row[4]) ?? 0) + 1);
    return values;
  }, [list]);
  const duplicates = useMemo(() => duplicatesByMiddle(list?.rows ?? []), [list]);

  async function open(next: EntryTarget, showInput = true) {
    const request = ++serial.current;
    setTarget(next);
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
    if (pending.current || !canLeave()) return;
    setSuccess("");
    void open({ id: row[0], intake: row[4] === "受付待ち" });
  }

  const selectedIndex = sortedRows.findIndex(row => row[0] === target?.id);

  function move(direction: -1 | 1) {
    const row = sortedRows[selectedIndex < 0 ? (direction === 1 ? 0 : sortedRows.length - 1) : selectedIndex + direction];
    if (row) openRow(row);
  }

  async function save(mode: SaveMode) {
    if (!target || !draft || !loaded || busy || pending.current) return;
    const next = mode === "entry" && selectedIndex >= 0 ? sortedRows[selectedIndex + 1] : undefined;
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
      router.refresh();
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
  return <section className={shell.pageShell}>
    <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "関電" }]} />
    <h1 data-page-search-heading>{ENTRY_TITLE}</h1>
    <UpdatedStampRow>
      <UpdatedStamp label="事務入力" date={list?.updatedAt} emptyText="記録なし" showSeconds onRefresh={() => {
        router.refresh();
        if (target && !pending.current && (!draft || draft === loaded?.draft)) void open(target, false);
      }} />
    </UpdatedStampRow>
    <SystemTabs aria-label="案件の状況" className={styles.statusTabs}>
      {ENTRY_TABS.map(label => tabButton(label, tab === label, () => setTab(label),
        <StatusBadge muted>{count.format(counts.get(label) ?? 0)}</StatusBadge>))}
    </SystemTabs>
    <ResultMessage>{error || (!list && "案件一覧を読み込めませんでした。更新ボタンを押してください。")
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
          <ActionButton onClick={() => move(-1)} disabled={saving || selectedIndex <= 0}>前へ</ActionButton>
          <ActionButton onClick={() => move(1)} disabled={saving || selectedIndex + 1 >= sortedRows.length}>次へ</ActionButton>
          <small>Ctrl+↑／↓</small>
        </ActionRow>
        <DataTable rows={rows} columns={columns} rowKey={rowKey}
          defaultSort={{ id: "date", direction: "desc" }} searchText={searchText}
          searchPlaceholder="管理番号・お客様名・カナ・住所・電話・供給地点"
          onRowClick={openRow} onRowsChange={setSortedRows} emptyText="該当する案件はありません。" />
      </section>
      <section className={styles.panel} data-active={panel === "入力"} aria-label="入力">
        <h2>入力 {loaded && <StatusBadge muted>{target?.intake ? "受付待ち" : loaded.status}</StatusBadge>}</h2>
        {busy ? <p role="status">読み込み中…</p> : !draft ? <p>一覧から案件を選んでください。</p> : <>
          {loaded?.reason && (loaded.status === "保留" || loaded.status === "差し戻し") &&
            <p>{loaded.status}の理由　{loaded.reason}</p>}
          <fieldset className={styles.fieldset} disabled={!canEdit}>
            <EntryFields draft={draft} setDraft={setDraft} options={list?.options}
              calendar={calendar ?? []} today={today} duplicateNumbers={middle =>
                (duplicates.get(middle) ?? []).filter(row => row[0] !== target?.id).map(row => row[1] ?? "未入力")} />
          </fieldset>
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
