"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";

import {
  DEFAULT_EXPORT_LIMIT,
  EMPTY_OPTION_VALUE,
  PREFECTURE_REGIONS,
  SOIL_LIST_EXPORT_COLUMNS,
  SOIL_LIST_FILTER_DEFINITIONS,
  SOIL_LIST_SORT_OPTIONS,
  type SoilListColumnKey,
  type SoilListConditionPayload,
  type SoilListFilter,
  type SoilListOptionFieldKey,
  type SoilListOptionItem,
  type SoilListOptionsPayload,
  type SoilListSortKey,
} from "../_lib/list-fields";

import styles from "./list-master.module.css";
import MultiSelectFilter, { type MultiSelectOptionGroup } from "./MultiSelectFilter";

type SearchRow = {
  phoneNumber: string;
  name: string;
  addressCity: string;
  listName: string;
  lastCalledOn: string;
  callCount: number | null;
  purchaseStatus: string;
};

type SavedCondition = {
  id: string;
  name: string;
  condition: SoilListConditionPayload;
  created_by: string | null;
  updated_at: string;
};

type ExportHistory = {
  id: string;
  row_count: number;
  replaced_chars: number;
  file_name: string;
  created_by: string | null;
  created_at: string;
};

type CallSyncState = {
  syncedThrough: string | null;
  lastRunAt: string | null;
  phones: number;
  callRows: number;
};

type ActiveTab = "list" | "upload" | "analysis" | "guide";

type UploadPreview = {
  format: "A" | "B" | "C";
  formatLabel: string;
  rowCount: number;
  listNames: Array<{ name: string; count: number; listLoadedOn: string | null }>;
  warnings: { emptyPhoneRows: number; shortPhoneRows: number; unreadableListDateNames: number };
};

type UploadResult = {
  assignments: number;
  assignments_new: number;
  assignments_updated: number;
  parent_updated: number;
  parent_inserted: number;
  parent_kept: number;
  skipped: number;
  remaining: number;
  warning?: string;
};

type UploadHistory = {
  id: string;
  file_name: string;
  format: string;
  row_count: number;
  result: UploadResult | null;
  status: "processing" | "done" | "failed";
  created_by: string | null;
  created_at: string;
};

type AnalysisRow = {
  list_name: string;
  list_loaded_on: string | null;
  row_count: number;
  called_count: number;
  purchase_history_count: number;
  last_called_on: string | null;
};

export type FilterState = {
  prefecture: string[];
  auCallAvailability: string[];
  purchaseStatus: string[];
  appointmentBlocked: string[];
  listName: string;
  listLoadedOnFrom: string;
  listLoadedOnTo: string;
  recheckedOnFrom: string;
  recheckedOnTo: string;
  lastCalledOnFrom: string;
  lastCalledOnTo: string;
  callCountFrom: string;
  callCountTo: string;
  purchaseHistory: string;
};

const initialFilters: FilterState = {
  prefecture: [],
  auCallAvailability: ["○"],
  purchaseStatus: [],
  appointmentBlocked: [EMPTY_OPTION_VALUE],
  listName: "",
  listLoadedOnFrom: "",
  listLoadedOnTo: "",
  recheckedOnFrom: "",
  recheckedOnTo: "",
  lastCalledOnFrom: "",
  lastCalledOnTo: "",
  callCountFrom: "",
  callCountTo: "",
  purchaseHistory: "",
};

const ACCEPTED_UPLOAD_EXTENSIONS = [".csv", ".xlsx", ".mer"];
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const TAB_LABELS: Array<{ key: ActiveTab; label: string; query?: string }> = [
  { key: "list", label: "リスト" },
  { key: "upload", label: "アップロード", query: "upload" },
  { key: "analysis", label: "分析", query: "analysis" },
  { key: "guide", label: "管理方法", query: "guide" },
];

const GUIDE_TEXT = [
  ["親：電話番号台帳", [
    "電話番号 1 件につき 1 行です（約 267 万件）。同じ番号が別のリストに再び投入されたときは、行を増やさず「リスト名」と「リスト投入日」を新しいものに書き換えます（更新スタイル）。",
    "氏名・住所・郵便番号・携帯番号は、空欄のときだけ新しい投入の値で埋めます。既に入っている値は残します。",
    "AU光架電可否・アポ禁・購入状態などの判定は投入では変えません。",
  ]],
  ["子：購入履歴", [
    "購入や開通が起きるたびに 1 行増えます。過去の分もすべて残します（約 242 万件）。",
  ]],
  ["子：コール履歴", [
    "電話番号 × リスト名で 1 行です。7 月末までは FileMaker の書き出し、8 月 1 日からはコールセンターから毎日届く通話記録を Garden が集計して足しています。",
    "親の「コール回数」「最終コール日」はこの集計から作ります。画面右上の丸い矢印で手動でも反映できます。",
  ]],
  ["子：投入履歴（アップロードで増えます）", [
    "電話番号 × リスト名で 1 行です。取込ファイルの列（申込者・連絡担当者・既契約者・設置先など）をそのまま残します。",
    "リスト投入日は、リスト名の中の日付（_20260907 の部分）です。",
  ]],
  ["そのほかの表", [
    "保留（桁がおかしい番号など）・携帯のみ・絞り込みの選択肢・保存した条件・書き出しの記録・アップロードの記録・コール履歴の反映状態。",
  ]],
  ["リスト名と投入日の決まり", [
    "リスト名は取込ファイルのものをそのまま使います（例：【光回線】フレッツ_20260907）。",
    "投入日はリスト名の日付です。末尾の「_2」などは無視します。",
    "この日付は「その日から架電する日」です。先の日付のリストは前もって入れておき、その日が来るまで架電しません。分析で架電済み率が低いリストは、まだ開始日が来ていないだけのことがあります。",
  ]],
] as const;

export function filtersToCondition(filters: FilterState): SoilListConditionPayload {
  const result: SoilListFilter[] = [];
  const pushSelect = (field: SoilListOptionFieldKey, values: string[]) => {
    const selectedValues = values.filter(Boolean);
    if (selectedValues.length === 0) return;
    const hasEmpty = selectedValues.includes(EMPTY_OPTION_VALUE);
    const actualValues = selectedValues.filter((value) => value !== EMPTY_OPTION_VALUE);
    if (selectedValues.length === 1 && hasEmpty) result.push({ field, op: "empty" });
    else if (selectedValues.length === 1) result.push({ field, op: "eq", value: selectedValues[0] });
    else if (hasEmpty) result.push({ field, op: "inOrEmpty", value: actualValues });
    else result.push({ field, op: "in", value: actualValues });
  };
  pushSelect("prefecture", filters.prefecture);
  pushSelect("auCallAvailability", filters.auCallAvailability);
  pushSelect("purchaseStatus", filters.purchaseStatus);
  pushSelect("appointmentBlocked", filters.appointmentBlocked);
  if (filters.listName) result.push({ field: "listName", op: "contains", value: filters.listName });
  if (filters.listLoadedOnFrom) result.push({ field: "listLoadedOn", op: "gte", value: filters.listLoadedOnFrom });
  if (filters.listLoadedOnTo) result.push({ field: "listLoadedOn", op: "lte", value: filters.listLoadedOnTo });
  if (filters.recheckedOnFrom) result.push({ field: "recheckedOn", op: "gte", value: filters.recheckedOnFrom });
  if (filters.recheckedOnTo) result.push({ field: "recheckedOn", op: "lte", value: filters.recheckedOnTo });
  if (filters.lastCalledOnFrom) result.push({ field: "lastCalledOn", op: "gte", value: filters.lastCalledOnFrom });
  if (filters.lastCalledOnTo) result.push({ field: "lastCalledOn", op: "lte", value: filters.lastCalledOnTo });
  if (filters.callCountFrom) result.push({ field: "callCount", op: "gte", value: Number(filters.callCountFrom) });
  if (filters.callCountTo) result.push({ field: "callCount", op: "lte", value: Number(filters.callCountTo) });
  if (filters.purchaseHistory === "あり") result.push({ field: "purchaseHistoryExists", op: "eq", value: true });
  if (filters.purchaseHistory === "なし") result.push({ field: "purchaseHistoryExists", op: "eq", value: false });
  return { filters: result };
}

export function conditionToFilters(condition: SoilListConditionPayload): FilterState {
  const next = { ...initialFilters, listLoadedOnFrom: "" };
  for (const filter of condition.filters ?? []) {
    if (isOptionFilterField(filter.field)) {
      if (filter.op === "eq") next[filter.field] = [String(filter.value)];
      if (filter.op === "empty") next[filter.field] = [EMPTY_OPTION_VALUE];
      if (filter.op === "in" && Array.isArray(filter.value)) next[filter.field] = filter.value.map(String);
      if (filter.op === "inOrEmpty" && Array.isArray(filter.value)) next[filter.field] = [...filter.value.map(String), EMPTY_OPTION_VALUE];
    }
    if (filter.field === "listName" && filter.op === "contains") next.listName = String(filter.value);
    if (filter.field === "listLoadedOn" && filter.op === "gte") next.listLoadedOnFrom = String(filter.value);
    if (filter.field === "listLoadedOn" && filter.op === "lte") next.listLoadedOnTo = String(filter.value);
    if (filter.field === "recheckedOn" && filter.op === "gte") next.recheckedOnFrom = String(filter.value);
    if (filter.field === "recheckedOn" && filter.op === "lte") next.recheckedOnTo = String(filter.value);
    if (filter.field === "lastCalledOn" && filter.op === "gte") next.lastCalledOnFrom = String(filter.value);
    if (filter.field === "lastCalledOn" && filter.op === "lte") next.lastCalledOnTo = String(filter.value);
    if (filter.field === "callCount" && filter.op === "gte") next.callCountFrom = String(filter.value);
    if (filter.field === "callCount" && filter.op === "lte") next.callCountTo = String(filter.value);
    if (filter.field === "purchaseHistoryExists" && filter.op === "eq") {
      next.purchaseHistory = filter.value === true ? "あり" : "なし";
    }
  }
  return next;
}

function formatDateTime(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isOptionFilterField(field: SoilListColumnKey): field is SoilListOptionFieldKey {
  return field === "prefecture" || field === "auCallAvailability" || field === "purchaseStatus" || field === "appointmentBlocked";
}

export function buildOptionGroups(field: SoilListOptionFieldKey, fieldOptions: SoilListOptionItem[] = []): MultiSelectOptionGroup[] {
  if (field !== "prefecture") {
    return [{ options: fieldOptions }];
  }

  const byValue = new Map(fieldOptions.map((option) => [option.value, option]));
  const officialValues = new Set(PREFECTURE_REGIONS.flatMap((region) => region.prefectures));
  const groups: MultiSelectOptionGroup[] = PREFECTURE_REGIONS.map((region) => ({
    label: region.label,
    options: region.prefectures.flatMap((prefecture) => {
      const option = byValue.get(prefecture);
      return option ? [option] : [];
    }),
  })).filter((group) => group.options.length > 0);
  const otherOptions = fieldOptions.filter((option) => !option.empty && !officialValues.has(option.value));
  const emptyOptions = fieldOptions.filter((option) => option.empty);
  if (otherOptions.length > 0) groups.push({ label: "その他の表記（表記ゆれ・件数の多い順）", options: otherOptions });
  if (emptyOptions.length > 0) groups.push({ options: emptyOptions });
  return groups;
}

function formatDateShort(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${month}/${day}`;
}

/** 「2026/09/09(水) 21:09」の形（日本時間）。日付だけの値（YYYY-MM-DD）は時刻なし */
export function formatJstWithWeekday(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00+09:00` : value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const stamp = `${part("year")}/${part("month")}/${part("day")}(${part("weekday")})`;
  return dateOnly ? stamp : `${stamp} ${part("hour")}:${part("minute")}`;
}

/** 見出し下の 1 行：コール履歴を最後に反映した日時（東海林さん 2026-09-09 の表記） */
function formatCallSyncStatus(state: CallSyncState | null): string {
  if (!state?.syncedThrough) return "コール履歴最終更新：2026/07/31(金)（FileMaker の書き出し）";
  const stamp = state.lastRunAt ? formatJstWithWeekday(state.lastRunAt) : formatJstWithWeekday(state.syncedThrough);
  return `コール履歴最終更新：${stamp}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "処理できませんでした");
  return data;
}

function tabFromLocation(): ActiveTab {
  if (typeof window === "undefined") return "list";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "upload" || tab === "analysis" || tab === "guide" ? tab : "list";
}

function fileExtension(name: string): string {
  const match = /\.([^.]+)$/.exec(name.toLowerCase());
  return match ? `.${match[1]}` : "";
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024)).toLocaleString("ja-JP")} KB`;
}

function formatPercent(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(1)}%` : "0.0%";
}

function resultLine(result: UploadResult): string {
  return `投入履歴 ${result.assignments.toLocaleString("ja-JP")} 件（新規 ${result.assignments_new.toLocaleString("ja-JP")}・更新 ${result.assignments_updated.toLocaleString("ja-JP")}）`;
}

function parentResultLine(result: UploadResult): string {
  return `親（電話番号台帳）：更新 ${result.parent_updated.toLocaleString("ja-JP")} 件・新規追加 ${result.parent_inserted.toLocaleString("ja-JP")} 件・投入日が古いので据え置き ${result.parent_kept.toLocaleString("ja-JP")} 件`;
}

function uploadHistoryStatus(item: UploadHistory): string {
  if (item.status === "done" && item.result) {
    return `新規 ${item.result.parent_inserted.toLocaleString("ja-JP")}／更新 ${item.result.parent_updated.toLocaleString("ja-JP")}`;
  }
  if (item.result && (item.status === "failed" || item.result.remaining > 0)) {
    return `途中で止まりました（親へ反映 ${item.result.assignments.toLocaleString("ja-JP")} / ${item.row_count.toLocaleString("ja-JP")}）`;
  }
  return "処理中";
}

function canResumeUpload(item: UploadHistory): boolean {
  return Boolean(item.result && (item.status === "failed" || item.result.remaining > 0));
}

export function ListMasterClient({ canSyncCalls = true }: { canSyncCalls?: boolean }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [count, setCount] = useState<number | null>(null);
  const [approximate, setApproximate] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [savedConditions, setSavedConditions] = useState<SavedCondition[]>([]);
  const [exports, setExports] = useState<ExportHistory[]>([]);
  const [options, setOptions] = useState<Partial<SoilListOptionsPayload>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [callSyncState, setCallSyncState] = useState<CallSyncState | null>(null);
  const [callSyncBusy, setCallSyncBusy] = useState(false);
  const [callSyncMessage, setCallSyncMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [conditionName, setConditionName] = useState("AU光○ アポ禁なし");
  const [selectedColumns, setSelectedColumns] = useState<SoilListColumnKey[]>(
    SOIL_LIST_EXPORT_COLUMNS.filter((column) => column.defaultChecked).map((column) => column.key),
  );
  const [limit, setLimit] = useState(DEFAULT_EXPORT_LIMIT);
  const [sortKey, setSortKey] = useState<SoilListSortKey>("listLoadedOnAsc");
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState<"preview" | "import" | null>(null);
  const [uploadApplyBusyId, setUploadApplyBusyId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysisRows, setAnalysisRows] = useState<AnalysisRow[]>([]);
  const [analysisFilter, setAnalysisFilter] = useState("");
  const [analysisSort, setAnalysisSort] = useState("listLoadedOnDesc");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const condition = useMemo(() => filtersToCondition(filters), [filters]);

  async function loadSaved() {
    const [conditionsRes, exportsRes] = await Promise.all([
      fetch("/api/soil/list/conditions"),
      fetch("/api/soil/list/exports"),
    ]);
    const conditionsData = await readJson<{ ok: boolean; conditions: SavedCondition[] }>(conditionsRes);
    const exportsData = await readJson<{ ok: boolean; exports: ExportHistory[] }>(exportsRes);
    setSavedConditions(conditionsData.conditions);
    setExports(exportsData.exports);
  }

  async function loadOptions() {
    const response = await fetch("/api/soil/list/options");
    const data = await readJson<{ ok: boolean; options: SoilListOptionsPayload }>(response);
    setOptions(data.options);
  }

  async function loadCallSyncState() {
    const response = await fetch("/api/soil/list/call-sync");
    const data = await readJson<{ ok: boolean; state: CallSyncState; canSync: boolean }>(response);
    setCallSyncState(data.state);
  }

  async function loadUploadHistory() {
    const response = await fetch("/api/soil/list/uploads");
    const data = await readJson<{ ok: boolean; uploads: UploadHistory[] }>(response);
    setUploadHistory(data.uploads);
  }

  async function loadAnalysis() {
    setAnalysisBusy(true);
    setAnalysisMessage("");
    try {
      const response = await fetch("/api/soil/list/analysis");
      const data = await readJson<{ ok: boolean; rows: AnalysisRow[] }>(response);
      setAnalysisRows(data.rows);
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "分析を読み込めませんでした");
    } finally {
      setAnalysisBusy(false);
    }
  }

  useEffect(() => {
    setActiveTab(tabFromLocation());
    Promise.all([loadSaved(), loadOptions(), loadCallSyncState(), loadUploadHistory()]).catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "取得できませんでした"),
    );
  }, []);

  useEffect(() => {
    if (activeTab !== "analysis" || analysisRows.length > 0 || analysisBusy) return;
    void loadAnalysis();
  }, [activeTab, analysisRows.length, analysisBusy]);

  async function handleCallSync() {
    setCallSyncBusy(true);
    setCallSyncMessage(null);
    try {
      const response = await fetch("/api/soil/list/call-sync", { method: "POST" });
      const data = await readJson<{ ok: boolean; result: { phones: number; callRows: number; syncedThrough: string | null }; state: CallSyncState }>(response);
      setCallSyncState(data.state);
      // 結果はアイコンの右横に出す（下の黄色い帯には出さない）
      setCallSyncMessage({ text: `反映しました（対象 ${data.result.phones.toLocaleString("ja-JP")} 番号・${formatDateShort(data.result.syncedThrough ?? "")} まで）`, error: false });
    } catch (error) {
      setCallSyncMessage({ text: error instanceof Error ? error.message : "反映できませんでした", error: true });
    } finally {
      setCallSyncBusy(false);
    }
  }

  async function handleCountAndSearch() {
    setBusy(true);
    setMessage("");
    try {
      const countResponse = await fetch("/api/soil/list/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition }),
      });
      const countData = await readJson<{ count: number; approximate: boolean; elapsedMs: number }>(countResponse);
      setCount(countData.count);
      setApproximate(countData.approximate);
      setElapsedMs(countData.elapsedMs);

      const searchResponse = await fetch("/api/soil/list/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition }),
      });
      const searchData = await readJson<{ rows: SearchRow[] }>(searchResponse);
      setRows(searchData.rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取得できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCondition() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/soil/list/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: conditionName, condition }),
      });
      await readJson(response);
      await loadSaved();
      setMessage("条件を保存しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCondition(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/soil/list/conditions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await readJson(response);
      await loadSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function downloadMer(body: Record<string, unknown>) {
    const response = await fetch("/api/soil/list/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "書き出しできませんでした");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const utf8Match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
    const asciiMatch = /filename="([^"]+)"/.exec(disposition);
    const fileName = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? "soil-list.mer");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setBusy(true);
    setMessage("");
    try {
      await downloadMer({ condition, columns: selectedColumns, limit, sortKey });
      await loadSaved();
      setMessage("書き出しました");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "書き出しできませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleRedownload(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await downloadMer({ exportId: id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再ダウンロードできませんでした");
    } finally {
      setBusy(false);
    }
  }

  function changeTab(next: ActiveTab) {
    setActiveTab(next);
    const url = new URL(window.location.href);
    const query = TAB_LABELS.find((tab) => tab.key === next)?.query;
    if (query) url.searchParams.set("tab", query);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function previewFile(next: File | null) {
    setUploadMessage("");
    setUploadResult(null);
    setUploadPreview(null);
    if (!next) {
      setUploadFile(null);
      return;
    }
    const extension = fileExtension(next.name);
    if (!ACCEPTED_UPLOAD_EXTENSIONS.includes(extension)) {
      setUploadFile(null);
      setUploadMessage("CSV・Excel・.mer のファイルを選んでください");
      return;
    }
    if (next.size > MAX_UPLOAD_SIZE) {
      setUploadFile(null);
      setUploadMessage("ファイルは20MBまでです");
      return;
    }
    setUploadFile(next);
    setUploadBusy("preview");
    try {
      const form = new FormData();
      form.set("file", next);
      const response = await fetch("/api/soil/list/uploads/preview", { method: "POST", body: form });
      const data = await readJson<{ ok: boolean; preview: UploadPreview }>(response);
      setUploadPreview(data.preview);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "取り込めませんでした（ファイルを読み取れませんでした）");
    } finally {
      setUploadBusy(null);
    }
  }

  function dropUpload(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void previewFile(event.dataTransfer.files[0] ?? null);
  }

  async function handleUploadImport() {
    if (!uploadFile) return;
    setUploadBusy("import");
    setUploadMessage("");
    setUploadResult(null);
    try {
      const form = new FormData();
      form.set("file", uploadFile);
      const response = await fetch("/api/soil/list/uploads", { method: "POST", body: form });
      const data = await readJson<{ ok: boolean; result?: UploadResult; error?: string }>(response);
      setUploadResult(data.result ?? null);
      await loadUploadHistory();
      setUploadMessage(data.ok ? (data.result?.warning ?? "") : (data.error ?? "途中で止まりました"));
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "取り込めませんでした（保存できませんでした）");
    } finally {
      setUploadBusy(null);
    }
  }

  async function handleResumeUpload(uploadId: string) {
    setUploadApplyBusyId(uploadId);
    setUploadMessage("");
    try {
      const response = await fetch(`/api/soil/list/uploads/${uploadId}/apply`, { method: "POST" });
      const data = await readJson<{ ok: boolean; result?: UploadResult; error?: string }>(response);
      if (data.result) setUploadResult(data.result);
      await loadUploadHistory();
      setUploadMessage(data.ok ? "反映しました" : (data.error ?? "反映できませんでした"));
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "反映できませんでした");
    } finally {
      setUploadApplyBusyId(null);
    }
  }

  const filteredAnalysisRows = useMemo(() => {
    const keyword = analysisFilter.trim();
    const source = keyword ? analysisRows.filter((row) => row.list_name.includes(keyword)) : analysisRows;
    return [...source].sort((a, b) => {
      if (analysisSort === "rowCountDesc") return b.row_count - a.row_count;
      if (analysisSort === "calledRateDesc") return (b.called_count / Math.max(1, b.row_count)) - (a.called_count / Math.max(1, a.row_count));
      if (analysisSort === "purchaseRateDesc") return (b.purchase_history_count / Math.max(1, b.row_count)) - (a.purchase_history_count / Math.max(1, a.row_count));
      return String(b.list_loaded_on ?? "").localeCompare(String(a.list_loaded_on ?? ""));
    });
  }, [analysisFilter, analysisRows, analysisSort]);

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <SystemBreadcrumb items={[{ label: "リストマスタ" }]} />
        <h1>リストマスタ</h1>
        <p className={styles.lead}>営業リストを条件で絞って件数を見て、.mer に書き出します。</p>
        <div className={styles.callSyncStatus}>
          <span>{formatCallSyncStatus(callSyncState)}</span>
          {canSyncCalls && (
            <button
              type="button"
              className={`${styles.syncIconButton} ${callSyncBusy ? styles.syncIconBusy : ""}`}
              onClick={handleCallSync}
              disabled={callSyncBusy}
              aria-label="コール履歴を反映する"
              title={callSyncBusy ? "反映しています…" : "コール履歴を反映する（最新の通話記録を取り込みます）"}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M19.8 4.6v4.2h-4.2z" fill="currentColor" />
              </svg>
            </button>
          )}
          {callSyncMessage && (
            <span className={callSyncMessage.error ? styles.callSyncError : styles.callSyncDone} role="status">
              {callSyncMessage.text}
            </span>
          )}
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="リストマスタの表示">
        {TAB_LABELS.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => changeTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "list" && (
        <>
      <section className={styles.panel} aria-labelledby="filter-heading">
        <div className={styles.panelTitle}>
          <h2 id="filter-heading">絞り込み</h2>
          <span>{SOIL_LIST_FILTER_DEFINITIONS.length} 項目</span>
        </div>
        <div className={styles.filterGrid}>
          <MultiSelectFilter label="都道府県" value={filters.prefecture} groups={buildOptionGroups("prefecture", options.prefecture)} onChange={(value) => setFilter("prefecture", value)} />
          <MultiSelectFilter label="AU光架電可否" value={filters.auCallAvailability} groups={buildOptionGroups("auCallAvailability", options.auCallAvailability)} onChange={(value) => setFilter("auCallAvailability", value)} />
          <MultiSelectFilter label="購入状態" value={filters.purchaseStatus} groups={buildOptionGroups("purchaseStatus", options.purchaseStatus)} onChange={(value) => setFilter("purchaseStatus", value)} />
          <MultiSelectFilter label="アポ禁" value={filters.appointmentBlocked} groups={buildOptionGroups("appointmentBlocked", options.appointmentBlocked)} onChange={(value) => setFilter("appointmentBlocked", value)} />
          <label className={styles.wide}>
            リスト名
            <input value={filters.listName} onChange={(event) => setFilter("listName", event.target.value)} placeholder="含む" />
          </label>
          <label>
            リスト投入日
            <span className={styles.range}>
              <input type="date" value={filters.listLoadedOnFrom} onChange={(event) => setFilter("listLoadedOnFrom", event.target.value)} />
              <input type="date" value={filters.listLoadedOnTo} onChange={(event) => setFilter("listLoadedOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            再判定日
            <span className={styles.range}>
              <input type="date" value={filters.recheckedOnFrom} onChange={(event) => setFilter("recheckedOnFrom", event.target.value)} />
              <input type="date" value={filters.recheckedOnTo} onChange={(event) => setFilter("recheckedOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            最終コール日
            <span className={styles.range}>
              <input type="date" value={filters.lastCalledOnFrom} onChange={(event) => setFilter("lastCalledOnFrom", event.target.value)} />
              <input type="date" value={filters.lastCalledOnTo} onChange={(event) => setFilter("lastCalledOnTo", event.target.value)} />
            </span>
          </label>
          <label>
            コール回数
            <span className={styles.range}>
              <input type="number" min="0" value={filters.callCountFrom} onChange={(event) => setFilter("callCountFrom", event.target.value)} />
              <input type="number" min="0" value={filters.callCountTo} onChange={(event) => setFilter("callCountTo", event.target.value)} />
            </span>
          </label>
          <label>
            購入履歴
            <select value={filters.purchaseHistory} onChange={(event) => setFilter("purchaseHistory", event.target.value)}>
              {SOIL_LIST_FILTER_DEFINITIONS[9].options?.map((option) => (
                <option key={option} value={option}>
                  {option || "指定なし"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={handleCountAndSearch} disabled={busy}>
            件数を見る
          </button>
          <input value={conditionName} onChange={(event) => setConditionName(event.target.value)} aria-label="保存する条件名" />
          <button type="button" onClick={handleSaveCondition} disabled={busy}>
            条件を保存
          </button>
        </div>
        {count !== null && (
          <p className={styles.result}>
            該当 {approximate ? "約 " : ""}
            {count.toLocaleString("ja-JP")} 件
            {elapsedMs !== null ? `（${(elapsedMs / 1000).toFixed(1)} 秒）` : ""}
          </p>
        )}
        {message && <p className={styles.message}>{message}</p>}
      </section>

      <section className={styles.panel} aria-labelledby="saved-heading">
        <h2 id="saved-heading">保存した条件</h2>
        <div className={styles.listStack}>
          {savedConditions.length === 0 && <p className={styles.empty}>保存した条件はありません</p>}
          {savedConditions.map((item) => (
            <div className={styles.savedRow} key={item.id}>
              <span>{item.name}</span>
              <small>
                {formatDateTime(item.updated_at)} {item.created_by ?? ""}
              </small>
              <button type="button" onClick={() => setFilters(conditionToFilters(item.condition))}>
                この条件で絞る
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => handleDeleteCondition(item.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="table-heading">
        <h2 id="table-heading">一覧（先頭 100 件・個人情報は一部伏せる）</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>電話番号</th>
                <th>氏名</th>
                <th>住所（市区町村まで）</th>
                <th>リスト名</th>
                <th>最終コール日</th>
                <th>コール回数</th>
                <th>購入状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.phoneNumber}-${index}`}>
                  <td>{row.phoneNumber}</td>
                  <td>{row.name}</td>
                  <td>{row.addressCity}</td>
                  <td>{row.listName}</td>
                  <td>{row.lastCalledOn}</td>
                  <td>{row.callCount ?? ""}</td>
                  <td>{row.purchaseStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="export-heading">
        <h2 id="export-heading">書き出し</h2>
        <div className={styles.columns}>
          {SOIL_LIST_EXPORT_COLUMNS.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.key)}
                onChange={(event) =>
                  setSelectedColumns((current) =>
                    event.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key),
                  )
                }
              />
              {column.label}
            </label>
          ))}
        </div>
        <div className={styles.actions}>
          <label>
            上限
            <input type="number" min="1" max="50000" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
          </label>
          <label>
            並び
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SoilListSortKey)}>
              {SOIL_LIST_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleExport} disabled={busy}>
            .mer を書き出す
          </button>
        </div>
        <div className={styles.listStack}>
          {exports.map((item) => (
            <div className={styles.savedRow} key={item.id}>
              <span>
                {formatDateTime(item.created_at)} {item.created_by ?? ""} {item.row_count.toLocaleString("ja-JP")} 件
              </span>
              <small>置き換え {item.replaced_chars.toLocaleString("ja-JP")} 文字</small>
              <button type="button" onClick={() => handleRedownload(item.id)}>
                再ダウンロード
              </button>
            </div>
          ))}
        </div>
      </section>
        </>
      )}

      {activeTab === "upload" && (
        <>
          <section className={styles.panel} aria-labelledby="upload-step-1">
            <div className={styles.stepHeading}>
              <span><small>STEP</small><strong>1</strong></span>
              <h2 id="upload-step-1">リストの取込ファイルをアップロード</h2>
            </div>
            <input
              ref={fileInputRef}
              className={styles.hiddenFileInput}
              type="file"
              accept=".csv,.xlsx,.mer"
              onChange={(event) => void previewFile(event.target.files?.[0] ?? null)}
            />
            <div
              className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ""}`}
              role="button"
              tabIndex={0}
              aria-label="リストの取込ファイルをアップロード"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click(); }}
              onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
              onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
              onDrop={dropUpload}
            >
              <svg className={styles.uploadIcon} viewBox="0 0 88 104" aria-hidden="true">
                <path d="M12 3h43l21 21v77H12z" />
                <path d="M55 3v22h21" />
                <path d="M29 60h30M44 45v30m0-30L33 56m11-11 11 11" />
              </svg>
              {uploadFile ? (
                <div className={styles.selectedFile}>
                  <strong>{uploadFile.name}</strong>
                  <span>{formatFileSize(uploadFile.size)}</span>
                  <button type="button" onClick={(event) => { event.stopPropagation(); void previewFile(null); }}>
                    選び直す
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.uploadNotes}>
                    <span>ここにファイルをドラッグ＆ドロップ（CSV／Excel／.mer）</span>
                    <span>20MB・50,000行まで</span>
                  </div>
                  <button type="button" className={styles.uploadButton} onClick={(event) => { event.stopPropagation(); fileInputRef.current?.click(); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4" /></svg>
                    ファイルを選ぶ
                  </button>
                </>
              )}
            </div>
            {uploadBusy === "preview" && <p className={styles.loading} role="status"><span />中身を確認しています…</p>}
            {uploadMessage && <p className={styles.message}>{uploadMessage}</p>}
          </section>

          {uploadPreview && (
            <section className={styles.panel} aria-labelledby="upload-step-2">
              <div className={styles.stepHeading}>
                <span><small>STEP</small><strong>2</strong></span>
                <h2 id="upload-step-2">中身の確認</h2>
              </div>
              <p className={styles.result}>形式：{uploadPreview.formatLabel}　行数 {uploadPreview.rowCount.toLocaleString("ja-JP")}</p>
              <div className={styles.summaryList}>
                {uploadPreview.listNames.slice(0, 8).map((item) => (
                  <span key={item.name}>{item.name}（{item.listLoadedOn ? formatJstWithWeekday(item.listLoadedOn) : "投入日不明"}） {item.count.toLocaleString("ja-JP")} 件</span>
                ))}
              </div>
              <p className={styles.warningLine}>
                要確認：電話番号が空 {uploadPreview.warnings.emptyPhoneRows.toLocaleString("ja-JP")} 行／数字でないものを除くと 9 桁未満 {uploadPreview.warnings.shortPhoneRows.toLocaleString("ja-JP")} 行／投入日が読めないリスト名 {uploadPreview.warnings.unreadableListDateNames.toLocaleString("ja-JP")} 件
              </p>
              <div className={styles.actions}>
                <button type="button" onClick={handleUploadImport} disabled={uploadBusy !== null}>
                  {uploadBusy === "import" ? "取り込んでいます…" : "取り込む"}
                </button>
              </div>
            </section>
          )}

          {uploadResult && (
            <section className={styles.panel} aria-labelledby="upload-step-3">
              <div className={styles.stepHeading}>
                <span><small>STEP</small><strong>3</strong></span>
                <h2 id="upload-step-3">結果</h2>
              </div>
              <p className={styles.result}>取り込みました：{resultLine(uploadResult)}</p>
              <p>{parentResultLine(uploadResult)}</p>
              <p>読めなかった行：{uploadResult.skipped.toLocaleString("ja-JP")} 行</p>
              {uploadResult.remaining > 0 && <p>残り：{uploadResult.remaining.toLocaleString("ja-JP")} 行</p>}
            </section>
          )}

          <section className={styles.panel} aria-labelledby="upload-history-heading">
            <h2 id="upload-history-heading">取り込みの記録（直近 50 件）</h2>
            <div className={styles.listStack}>
              {uploadHistory.length === 0 && <p className={styles.empty}>取り込みの記録はありません</p>}
              {uploadHistory.map((item) => (
                <div className={styles.savedRow} key={item.id}>
                  <span>{formatDateTime(item.created_at)} {item.created_by ?? ""} {item.file_name}</span>
                  <small>{item.row_count.toLocaleString("ja-JP")} 行</small>
                  <small>{uploadHistoryStatus(item)}</small>
                  {canResumeUpload(item) && (
                    <button type="button" onClick={() => void handleResumeUpload(item.id)} disabled={uploadApplyBusyId === item.id}>
                      {uploadApplyBusyId === item.id ? "反映しています…" : "反映をやり直す"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "analysis" && (
        <section className={styles.panel} aria-labelledby="analysis-heading">
          <div className={styles.panelTitle}>
            <h2 id="analysis-heading">分析</h2>
            <button type="button" onClick={() => void loadAnalysis()} disabled={analysisBusy}>{analysisBusy ? "読み込み中…" : "再読み込み"}</button>
          </div>
          <div className={styles.actions}>
            <label>
              リスト名で絞る
              <input value={analysisFilter} onChange={(event) => setAnalysisFilter(event.target.value)} placeholder="含む" />
            </label>
            <label>
              並び
              <select value={analysisSort} onChange={(event) => setAnalysisSort(event.target.value)}>
                <option value="listLoadedOnDesc">投入日が新しい順</option>
                <option value="rowCountDesc">件数が多い順</option>
                <option value="calledRateDesc">架電済み率が高い順</option>
                <option value="purchaseRateDesc">購入あり率が高い順</option>
              </select>
            </label>
          </div>
          {analysisMessage && <p className={styles.message}>{analysisMessage}</p>}
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>リスト名</th><th>投入日</th><th>件数</th><th>架電済み</th><th>架電済み率</th><th>購入履歴あり</th><th>購入あり率</th><th>最終コール日</th></tr></thead>
              <tbody>
                {filteredAnalysisRows.map((row) => (
                  <tr key={row.list_name}>
                    <td>{row.list_name}</td>
                    <td>{row.list_loaded_on ?? ""}</td>
                    <td>{row.row_count.toLocaleString("ja-JP")}</td>
                    <td>{row.called_count.toLocaleString("ja-JP")}</td>
                    <td>{formatPercent(row.called_count, row.row_count)}</td>
                    <td>{row.purchase_history_count.toLocaleString("ja-JP")}</td>
                    <td>{formatPercent(row.purchase_history_count, row.row_count)}</td>
                    <td>{row.last_called_on ?? ""}</td>
                  </tr>
                ))}
                {filteredAnalysisRows.length === 0 && <tr><td colSpan={8}>対象データがありません</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={styles.guideBlock}>
            <p>架電済み＝コール回数合計が 1 以上</p>
            <p>購入履歴あり＝購入履歴あり が真</p>
            <p>最終コール日＝その番号の最終コール日の最大</p>
          </div>
        </section>
      )}

      {activeTab === "guide" && (
        <section className={styles.panel} aria-labelledby="guide-heading">
          <h2 id="guide-heading">リストマスタのデータの持ち方</h2>
          <div className={styles.guideBlock}>
            {GUIDE_TEXT.map(([heading, lines]) => (
              <section key={heading}>
                <h3>■ {heading}</h3>
                {lines.map((line) => <p key={line}>・{line}</p>)}
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
