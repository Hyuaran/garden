"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArcElement, Chart as ChartJS, Legend, Tooltip, type ChartData, type ChartOptions } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";

import {
  EMPTY_OPTION_VALUE,
  MAX_SEARCH_PAGE,
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
import { ListProcessingOverlay } from "./ListProcessingOverlay";
import MultiSelectFilter, { type MultiSelectOptionGroup } from "./MultiSelectFilter";

ChartJS.register(ArcElement, Tooltip, Legend);

type SearchRow = {
  phoneNumber: string;
  name: string;
  addressCity: string;
  listName: string;
  lastCalledOn: string;
  callCount: number | null;
  purchaseStatus: string;
};

type ListSearchSortKey = keyof SearchRow;
type ListSearchSortDirection = "asc" | "desc";
type ListSearchSort = { key: ListSearchSortKey; direction: ListSearchSortDirection };

const SEARCH_PAGE_SIZE = 100;
const SEARCH_TABLE_COLUMNS: Array<{ key: ListSearchSortKey; label: string }> = [
  { key: "phoneNumber", label: "電話番号" },
  { key: "name", label: "氏名" },
  { key: "addressCity", label: "住所（市区町村まで）" },
  { key: "listName", label: "リスト名" },
  { key: "lastCalledOn", label: "最終コール日" },
  { key: "callCount", label: "コール回数" },
  { key: "purchaseStatus", label: "購入状態" },
];

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
  format?: ExportFormat;
  rebuild_from_condition?: boolean;
  file_name: string;
  created_by: string | null;
  created_at: string;
};

type ExportFormat = "xlsx" | "csv" | "mer";

type CallSyncState = {
  syncedThrough: string | null;
  lastRunAt: string | null;
  phones: number;
  callRows: number;
};

type OrderSyncState = {
  lastRunAt: string | null;
  records: number;
  orderRows: number;
  phoneUpdates: number;
  deletedRows: number;
  elapsedMs: number;
  error: string | null;
};

type PurchaseVendorOption = {
  value: string;
  count: number;
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
  purchase_inserted: number;
  warning?: string;
};

type UploadHistory = {
  id: string;
  file_name: string;
  format: string;
  row_count: number;
  result: UploadResult | null;
  status: "processing" | "done" | "failed";
  購入先: string | null;
  created_by: string | null;
  created_at: string;
};

type AnalysisResultBreakdown = {
  result: string;
  rowCount: number;
};

type AnalysisSegment = {
  segment: string;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  invalidCount: number;
  validCount: number;
  orderCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
  segmentLastCalledOn: string | null;
  rotation: number;
  orderRateValid: number;
  orderRateTotal: number;
  results: AnalysisResultBreakdown[];
};

type AnalysisPayload = {
  refreshedAt: string | null;
  elapsedMs: number;
  lastError: string | null;
  blocks: {
    vendor: { segments: AnalysisSegment[] };
    activeList: { segments: AnalysisSegment[] };
    contract: { segments: AnalysisSegment[]; snapshotAt: string | null };
  };
};

type AnalysisBlockKey = "vendor" | "active_list" | "contract";

type AnalysisDetailRow = {
  listName: string;
  listLoadedOn: string | null;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  orderCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
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
const ANALYSIS_ROW_LIMIT = 50;
const EXCEL_MAX_EXPORT_ROWS = 1048575;
const LARGE_EXPORT_CONFIRM_ROWS = 100000;
const EXPORT_SPEED_ROWS_PER_MINUTE = 20000;
const EXPORT_FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string; action: string }> = [
  { value: "xlsx", label: "Excel", action: "Excel で書き出し" },
  { value: "csv", label: "CSV", action: "CSV で書き出し" },
  { value: "mer", label: ".mer", action: ".mer で書き出し" },
];

/** 分析の各ブロックの見出し横の「？」に出す集計の条件（東海林さん 2026-09-13） */
const ANALYSIS_HELP = {
  vendor: [
    "区切り：電話番号台帳の「最新購入先」（購入履歴のいちばん新しい行の購入先）。空欄は「（購入先なし）」",
    "件数：その購入先の電話番号の数（電話番号が空の行は数えない）",
    "円グラフ：その区切りの最終コール結果の内訳。コール回数 0 は「未コール」、上位 6 つ以外は「その他」",
    "受注率：受注（案件）÷ 有効（件数 − 無効）。獲得（コール）は件数を並べるだけ",
    "集計：毎朝 6:45 と右上の ↻ で作り直し",
  ],
  activeList: [
    "区切り：リスト名があり、投入日が直近 60 日以内で、直近 30 日にコールがあるリスト",
    "「直近 15 日」：その中で、15 日以内にコールがあるリストだけ。合計もその分だけで計算",
    "件数：そのリスト名が電話番号台帳に入っている電話番号の数",
    "円グラフ・受注率：①と同じ",
  ],
  contract: [
    "区切り：新営業の「既契約情報」。空欄は「（既契約情報なし）」",
    "件数：その既契約情報を持つ新営業の電話番号のうち、電話番号台帳にある番号。同じ番号が複数行あれば修正日が新しい行を使う",
    "円グラフ・受注率：①と同じ",
    "元データ：社内ホストPCから毎朝 5:30 に写す新営業の表",
  ],
} as const;

/** 見出し横の「？」。マウスを乗せる・キーボードで選ぶと条件が出る */
function HelpTip({ lines }: { lines: readonly string[] }) {
  return (
    <span className={styles.helpTip} tabIndex={0} aria-label={lines.join("。")}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8" />
        <circle cx="12" cy="17" r=".6" fill="currentColor" />
      </svg>
      <span className={styles.helpTipBubble} role="tooltip">
        {lines.map((line) => <span key={line}>{line}</span>)}
      </span>
    </span>
  );
}
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const TAB_LABELS: Array<{ key: ActiveTab; label: string; query?: string }> = [
  { key: "list", label: "リスト" },
  { key: "upload", label: "アップロード", query: "upload" },
  { key: "analysis", label: "分析", query: "analysis" },
  { key: "guide", label: "管理方法", query: "guide" },
];

const GUIDE_TABLE_ROWS = [
  {
    name: "電話番号台帳",
    unit: "電話番号 1 件",
    count: "約 267 万件",
    contains: "氏名・住所・郵便番号・携帯番号、購入履歴・投入履歴・コール履歴・受注履歴それぞれの一番新しい値、AU光架電可否・アポ禁・購入状態",
    timing: "同じ番号が別のリストで再び投入されたら、行を増やさずリスト名と投入日を新しいものに書き換える。氏名・住所・郵便番号・携帯番号は空欄のときだけ埋める。AU光架電可否・アポ禁・購入状態は投入では変えない",
  },
  {
    name: "購入履歴",
    unit: "購入 1 回",
    count: "約 242 万件",
    contains: "電話番号・購入先・購入日",
    timing: "購入や開通のたびに 1 行増える。過去の分もすべて残す",
  },
  {
    name: "投入履歴",
    unit: "電話番号×リスト名",
    count: "約 3.9 万件",
    contains: "取込ファイルの列（申込者・連絡担当者・既契約者・設置先など）そのまま",
    timing: "アップロードのたびに増える。同じ番号×リスト名は上書き。リスト投入日はリスト名の中の日付を使う",
  },
  {
    name: "コール履歴",
    unit: "電話番号×リスト名",
    count: "約 119 万件",
    contains: "コール回数・初回／最終コール日・最終結果",
    timing: "8/1 からはコールセンターの通話記録を毎日集計して足す。電話番号台帳のコール回数・最終コール日はこの集計から作る。画面右上の丸い矢印で手動でも反映できる",
  },
  {
    name: "受注履歴",
    unit: "受注 1 件",
    count: "約 2 万件",
    contains: "受注日・商材・チーム・営業ID",
    timing: "毎朝 6:30 に Kintone「顧客一覧」を取り込み直す。1 行は顧客一覧のレコード×電話番号",
  },
] as const;

const GUIDE_RULE_ROWS = [
  ["リスト名", "取込ファイルのものをそのまま使う（例：【光回線】フレッツ_20260907）"],
  ["リスト投入日", "リスト名の中の日付（_20260907 の部分）。末尾の「_2」などは無視する"],
  ["投入日の意味", "「その日から架電する日」。先の日付のリストは前もって入れておき、その日が来るまで架電しない。分析で架電済み率が低いリストは、まだ開始日が来ていないだけのことがある"],
  ["判定は投入で変えない", "AU光架電可否・アポ禁・購入状態は、アップロードでは書き換えない"],
  ["そのほかの表", "保留（桁がおかしい番号など）・携帯のみ・絞り込みの選択肢・保存した条件・書き出しの記録・アップロードの記録・コール履歴の反映状態"],
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

function formatRate(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRotation(value: number): string {
  return value.toFixed(1);
}

function formatCount(value: number): string {
  return value.toLocaleString("ja-JP");
}

function exportFormatLabel(format: ExportFormat | undefined): string {
  return EXPORT_FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? ".mer";
}

function formatElapsedSeconds(value: number): string {
  return (value / 1000).toFixed(1);
}

const ANALYSIS_COLORS: Record<string, string> = {
  留守: "#2563eb",
  担不: "#0ea5a0",
  無効: "#dc2626",
  NG: "#f59e0b",
  前確OK: "#7c3aed",
  見込: "#16a34a",
  未コール: "#6b7280",
  その他: "#cbd5e1",
};

function resultColor(result: string): string {
  return ANALYSIS_COLORS[result] ?? "#64748b";
}

function valueClassName(value: number): string {
  return value > 0 ? styles.valueStrong : styles.valueZero;
}

function filterActiveSegments(segments: AnalysisSegment[], days: 15 | 30): AnalysisSegment[] {
  if (days === 30) return segments;
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const kept = segments.filter((segment) => {
    if (segment.segment === "合計") return false;
    if (!segment.segmentLastCalledOn) return false;
    return new Date(`${segment.segmentLastCalledOn}T00:00:00+09:00`).getTime() >= threshold;
  });
  // 「合計」は絞った後のリストだけで作り直す（集計表の合計は 30 日分なので、そのまま出すと 15 日側の数字と合わない）
  const total: AnalysisSegment = {
    segment: "合計",
    rowCount: 0,
    calledCount: 0,
    callTotal: 0,
    invalidCount: 0,
    validCount: 0,
    orderCount: 0,
    acquiredCount: 0,
    lastCalledOn: null,
    segmentLastCalledOn: null,
    rotation: 0,
    orderRateValid: 0,
    orderRateTotal: 0,
    results: [],
  };
  const results = new Map<string, number>();
  for (const segment of kept) {
    total.rowCount += segment.rowCount;
    total.calledCount += segment.calledCount;
    total.callTotal += segment.callTotal;
    total.invalidCount += segment.invalidCount;
    total.orderCount += segment.orderCount;
    total.acquiredCount += segment.acquiredCount;
    if (segment.lastCalledOn && (!total.lastCalledOn || segment.lastCalledOn > total.lastCalledOn)) total.lastCalledOn = segment.lastCalledOn;
    if (segment.segmentLastCalledOn && (!total.segmentLastCalledOn || segment.segmentLastCalledOn > total.segmentLastCalledOn)) {
      total.segmentLastCalledOn = segment.segmentLastCalledOn;
    }
    for (const item of segment.results) results.set(item.result, (results.get(item.result) ?? 0) + item.rowCount);
  }
  total.validCount = Math.max(0, total.rowCount - total.invalidCount);
  total.rotation = total.rowCount > 0 ? total.callTotal / total.rowCount : 0;
  total.orderRateValid = total.validCount > 0 ? total.orderCount / total.validCount : 0;
  total.orderRateTotal = total.rowCount > 0 ? total.orderCount / total.rowCount : 0;
  const order = segments.find((segment) => segment.segment === "合計")?.results.map((item) => item.result) ?? [];
  total.results = [...results.entries()]
    .map(([result, rowCount]) => ({ result, rowCount }))
    .sort((a, b) => {
      const left = order.indexOf(a.result);
      const right = order.indexOf(b.result);
      return (left === -1 ? order.length : left) - (right === -1 ? order.length : right) || b.rowCount - a.rowCount;
    });
  return [total, ...kept];
}

function resultLine(result: UploadResult): string {
  return `投入履歴 ${result.assignments.toLocaleString("ja-JP")} 件（新規 ${result.assignments_new.toLocaleString("ja-JP")}・更新 ${result.assignments_updated.toLocaleString("ja-JP")}）`;
}

function parentResultLine(result: UploadResult): string {
  return `電話番号台帳：更新 ${result.parent_updated.toLocaleString("ja-JP")} 件・新規追加 ${result.parent_inserted.toLocaleString("ja-JP")} 件・投入日が古いので据え置き ${result.parent_kept.toLocaleString("ja-JP")} 件`;
}

function purchaseResultLine(result: UploadResult): string {
  return `購入履歴：新規 ${(result.purchase_inserted ?? 0).toLocaleString("ja-JP")} 件`;
}

function uploadHistoryStatus(item: UploadHistory): string {
  if (item.status === "done" && item.result) {
    return `新規 ${item.result.parent_inserted.toLocaleString("ja-JP")}／更新 ${item.result.parent_updated.toLocaleString("ja-JP")}／購入履歴 ${(item.result.purchase_inserted ?? 0).toLocaleString("ja-JP")}`;
  }
  if (item.result && (item.status === "failed" || item.result.remaining > 0)) {
    return `途中で止まりました（電話番号台帳へ反映 ${item.result.assignments.toLocaleString("ja-JP")} / ${item.row_count.toLocaleString("ja-JP")}）`;
  }
  return "処理中";
}

function canResumeUpload(item: UploadHistory): boolean {
  return Boolean(item.result && (item.status === "failed" || item.result.remaining > 0));
}

function formatOrderSyncStatus(state: OrderSyncState | null): string {
  if (!state?.lastRunAt) return "受注履歴最終更新：未反映";
  return `受注履歴最終更新：${formatJstWithWeekday(state.lastRunAt)}`;
}

function optionLabel(field: SoilListOptionFieldKey, value: string, options: Partial<SoilListOptionsPayload>): string {
  if (value === EMPTY_OPTION_VALUE || value === "") return field === "appointmentBlocked" ? "なし" : "（空欄）";
  return options[field]?.find((option) => option.value === value)?.label ?? value;
}

export function describeFilters(filters: FilterState, options: Partial<SoilListOptionsPayload> = {}): string {
  const parts: string[] = [];
  const pushMulti = (field: SoilListOptionFieldKey, label: string, values: string[]) => {
    if (values.length === 0) return;
    parts.push(`${label}：${values.map((value) => optionLabel(field, value, options)).join("・")}`);
  };
  pushMulti("prefecture", "都道府県", filters.prefecture);
  pushMulti("auCallAvailability", "AU光架電可否", filters.auCallAvailability);
  pushMulti("purchaseStatus", "購入状態", filters.purchaseStatus);
  pushMulti("appointmentBlocked", "アポ禁", filters.appointmentBlocked);
  if (filters.listName) parts.push(`リスト名：${filters.listName}を含む`);
  if (filters.listLoadedOnFrom || filters.listLoadedOnTo) parts.push(`投入日：${filters.listLoadedOnFrom || "指定なし"}〜${filters.listLoadedOnTo || "指定なし"}`);
  if (filters.recheckedOnFrom || filters.recheckedOnTo) parts.push(`再判定日：${filters.recheckedOnFrom || "指定なし"}〜${filters.recheckedOnTo || "指定なし"}`);
  if (filters.lastCalledOnFrom || filters.lastCalledOnTo) parts.push(`最終コール日：${filters.lastCalledOnFrom || "指定なし"}〜${filters.lastCalledOnTo || "指定なし"}`);
  if (filters.callCountFrom || filters.callCountTo) parts.push(`コール回数：${filters.callCountFrom || "指定なし"}〜${filters.callCountTo || "指定なし"}`);
  if (filters.purchaseHistory) parts.push(`購入履歴：${filters.purchaseHistory}`);
  return parts.join("／") || "指定なし";
}

function SaveConditionModal({
  open,
  conditionName,
  currentSummary,
  savedConditions,
  busy,
  message,
  onNameChange,
  onClose,
  onSave,
  onLoad,
  onDelete,
}: {
  open: boolean;
  conditionName: string;
  currentSummary: string;
  savedConditions: SavedCondition[];
  busy: boolean;
  message: string;
  onNameChange(value: string): void;
  onClose(): void;
  onSave(): void;
  onLoad(item: SavedCondition): void;
  onDelete(id: string): void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={styles.modalBackdrop} onMouseDown={onClose}>
      <section className={styles.conditionModal} aria-modal="true" role="dialog" aria-labelledby="condition-modal-heading" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="condition-modal-heading">条件を保存</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className={styles.modalSaveRow}>
          <label>
            条件名
            <input value={conditionName} onChange={(event) => onNameChange(event.target.value)} />
          </label>
          <button type="button" onClick={onSave} disabled={busy || conditionName.trim() === ""}>
            保存
          </button>
        </div>
        <p className={styles.conditionSummary}>いまの条件：{currentSummary}</p>
        {message && <p className={styles.message}>{message}</p>}
        <h3>保存した条件</h3>
        <div className={styles.listStack}>
          {savedConditions.length === 0 && <p className={styles.empty}>保存した条件はありません</p>}
          {savedConditions.map((item) => (
            <div className={styles.modalSavedRow} key={item.id}>
              <span>{item.name}</span>
              <small>
                {item.created_by ?? ""} {formatDateTime(item.updated_at)}
              </small>
              <button type="button" onClick={() => onLoad(item)} disabled={busy}>
                読み込む
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => onDelete(item.id)} disabled={busy}>
                削除
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
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
  const [searchBusy, setSearchBusy] = useState(false);
  const [callSyncState, setCallSyncState] = useState<CallSyncState | null>(null);
  const [callSyncBusy, setCallSyncBusy] = useState(false);
  const [callSyncMessage, setCallSyncMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [orderSyncState, setOrderSyncState] = useState<OrderSyncState | null>(null);
  const [conditionName, setConditionName] = useState("AU光○ アポ禁なし");
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const [conditionModalMessage, setConditionModalMessage] = useState("");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listSort, setListSort] = useState<ListSearchSort | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<SoilListColumnKey[]>(
    SOIL_LIST_EXPORT_COLUMNS.filter((column) => column.defaultChecked).map((column) => column.key),
  );
  const [sortKey, setSortKey] = useState<SoilListSortKey>("listLoadedOnAsc");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportBusy, setExportBusy] = useState<{ count: number; format: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [purchaseVendors, setPurchaseVendors] = useState<PurchaseVendorOption[]>([]);
  const [purchaseVendor, setPurchaseVendor] = useState("");
  const [purchaseVendorOther, setPurchaseVendorOther] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState<"preview" | "import" | null>(null);
  const [uploadApplyBusyId, setUploadApplyBusyId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [analysisSelections, setAnalysisSelections] = useState({ vendor: "合計", activeList: "合計", contract: "合計" });
  const [activeListDays, setActiveListDays] = useState<15 | 30>(30);
  // 表は上位 50 行だけ描く（購入先は 2,400 種類あり、全部描くと画面が固まった。2026-09-13 本番で確認）
  const [showAllSegments, setShowAllSegments] = useState<Record<AnalysisBlockKey, boolean>>({ vendor: false, active_list: false, contract: false });
  const [analysisDetail, setAnalysisDetail] = useState<{
    block: AnalysisBlockKey;
    segment: string;
    result: string;
    rows: AnalysisDetailRow[];
    filter: string;
  } | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisRefreshBusy, setAnalysisRefreshBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const condition = useMemo(() => filtersToCondition(filters), [filters]);
  const currentFilterSummary = useMemo(() => describeFilters(filters, options), [filters, options]);
  // ページ送りは 500 ページ（50,000 件）まで。深いページは遅い（本番実測：190 万件目で 89 秒）ので、それより先は条件で絞ってもらう
  const rawTotalPages = count === null ? 1 : Math.max(1, Math.ceil(count / SEARCH_PAGE_SIZE));
  const totalPages = Math.min(rawTotalPages, MAX_SEARCH_PAGE);
  const pageCapped = rawTotalPages > MAX_SEARCH_PAGE;

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

  async function loadOrderSyncState() {
    const response = await fetch("/api/soil/list/orders/status");
    const data = await readJson<{ ok: boolean; state: OrderSyncState }>(response);
    setOrderSyncState(data.state);
  }

  async function loadUploadHistory() {
    const response = await fetch("/api/soil/list/uploads");
    const data = await readJson<{ ok: boolean; uploads: UploadHistory[] }>(response);
    setUploadHistory(data.uploads);
  }

  async function loadPurchaseVendors() {
    const response = await fetch("/api/soil/list/purchase-vendors");
    const data = await readJson<{ ok: boolean; vendors: PurchaseVendorOption[] }>(response);
    // 購入先は必ず人が選ぶ（一番多い購入先を勝手に既定にすると、違う購入先のまま取り込まれる）
    setPurchaseVendors(data.vendors);
  }

  async function loadAnalysis() {
    setAnalysisBusy(true);
    setAnalysisMessage("");
    try {
      const response = await fetch("/api/soil/list/analysis");
      const data = await readJson<{ ok: boolean; analysis: AnalysisPayload }>(response);
      setAnalysis(data.analysis);
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "分析を読み込めませんでした");
    } finally {
      setAnalysisBusy(false);
    }
  }

  useEffect(() => {
    setActiveTab(tabFromLocation());
    Promise.all([loadSaved(), loadOptions(), loadCallSyncState(), loadOrderSyncState(), loadUploadHistory(), loadPurchaseVendors()]).catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "取得できませんでした"),
    );
  }, []);

  useEffect(() => {
    if (activeTab !== "analysis" || analysis || analysisBusy) return;
    void loadAnalysis();
  }, [activeTab, analysis, analysisBusy]);

  async function handleAnalysisRefresh() {
    setAnalysisRefreshBusy(true);
    setAnalysisMessage("");
    try {
      const response = await fetch("/api/soil/list/analysis/refresh", { method: "POST" });
      const data = await readJson<{ ok: true; rows: number; elapsed_ms: number }>(response);
      await loadAnalysis();
      setAnalysisMessage(`作り直しました（${formatCount(data.rows)} 行・${formatElapsedSeconds(data.elapsed_ms)} 秒）`);
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "集計を作り直せませんでした（途中で止まりました）。もう一度押してください");
    } finally {
      setAnalysisRefreshBusy(false);
    }
  }

  async function openAnalysisDetail(block: AnalysisBlockKey, segment: string, result: string) {
    setAnalysisMessage("");
    try {
      const params = new URLSearchParams({ block, segment: segment === "合計" ? "__all__" : segment, result });
      const response = await fetch(`/api/soil/list/analysis/detail?${params.toString()}`);
      const data = await readJson<{ ok: boolean; rows: AnalysisDetailRow[] }>(response);
      setAnalysisDetail({ block, segment, result, rows: data.rows, filter: "" });
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : "一覧を読み込めませんでした");
    }
  }

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

  async function runListSearch({
    nextPage = 1,
    nextSort = listSort,
    nextCondition = condition,
    refreshCount = true,
  }: {
    nextPage?: number;
    nextSort?: ListSearchSort | null;
    nextCondition?: SoilListConditionPayload;
    refreshCount?: boolean;
  } = {}) {
    setBusy(true);
    setSearchBusy(true);
    setMessage("");
    try {
      if (refreshCount) {
        const countResponse = await fetch("/api/soil/list/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condition: nextCondition }),
        });
        const countData = await readJson<{ count: number; approximate: boolean; elapsedMs: number }>(countResponse);
        setCount(countData.count);
        setApproximate(countData.approximate);
        setElapsedMs(countData.elapsedMs);
      }

      const searchResponse = await fetch("/api/soil/list/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: nextCondition, page: nextPage, sort: nextSort }),
      });
      const searchData = await readJson<{ rows: SearchRow[]; page: number; sort: ListSearchSort | null }>(searchResponse);
      setRows(searchData.rows);
      setListPage(searchData.page);
      setListSort(searchData.sort);
      setFiltersCollapsed(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取得できませんでした");
    } finally {
      setSearchBusy(false);
      setBusy(false);
    }
  }

  async function handleCountAndSearch() {
    await runListSearch({ nextPage: 1, refreshCount: true });
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleCountAndSearch();
  }

  async function handleSaveCondition() {
    setBusy(true);
    setConditionModalMessage("");
    try {
      const response = await fetch("/api/soil/list/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: conditionName, condition }),
      });
      await readJson(response);
      await loadSaved();
      setConditionName("");
      setConditionModalMessage("保存しました");
    } catch (error) {
      setConditionModalMessage(error instanceof Error ? error.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCondition(id: string) {
    if (!window.confirm("この条件を削除しますか")) return;
    setBusy(true);
    setConditionModalMessage("");
    try {
      const response = await fetch(`/api/soil/list/conditions/${encodeURIComponent(id)}`, { method: "DELETE" });
      await readJson(response);
      await loadSaved();
    } catch (error) {
      setConditionModalMessage(error instanceof Error ? error.message : "削除できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadCondition(item: SavedCondition) {
    const nextFilters = conditionToFilters(item.condition);
    setFilters(nextFilters);
    setConditionModalOpen(false);
    setConditionModalMessage("");
    await runListSearch({ nextPage: 1, nextCondition: item.condition, refreshCount: true });
  }

  async function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || busy) return;
    await runListSearch({ nextPage, refreshCount: false });
  }

  async function handleSortChange(key: ListSearchSortKey) {
    if (busy) return;
    const direction: ListSearchSortDirection = listSort?.key === key && listSort.direction === "asc" ? "desc" : "asc";
    await runListSearch({ nextPage: 1, nextSort: { key, direction }, refreshCount: false });
  }

  async function downloadExport(body: Record<string, unknown>) {
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
    const fileName = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch?.[1] ?? "soil-list");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    if (count === null) {
      setMessage("先に検索してください");
      return;
    }
    if (exportFormat === "xlsx" && count > EXCEL_MAX_EXPORT_ROWS) {
      setMessage("Excel は 1,048,576 行までです。CSV か .mer を選んでください");
      return;
    }
    if (count > LARGE_EXPORT_CONFIRM_ROWS) {
      const minutes = Math.ceil(count / EXPORT_SPEED_ROWS_PER_MINUTE);
      if (!window.confirm(`約 ${count.toLocaleString("ja-JP")} 件を書き出します（目安 ${minutes.toLocaleString("ja-JP")} 分）。よろしいですか`)) return;
    }
    const label = exportFormatLabel(exportFormat);
    setBusy(true);
    setExportBusy({ count, format: label });
    setMessage("");
    try {
      await downloadExport({ condition, columns: selectedColumns, sortKey, format: exportFormat });
      await loadSaved();
      setMessage(`${count.toLocaleString("ja-JP")} 件を ${label} で書き出しました`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "書き出しできませんでした");
    } finally {
      setExportBusy(null);
      setBusy(false);
    }
  }

  async function handleRedownload(item: ExportHistory) {
    setBusy(true);
    setExportBusy({ count: item.row_count, format: exportFormatLabel(item.format) });
    setMessage("");
    try {
      await downloadExport({ exportId: item.id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "再ダウンロードできませんでした");
    } finally {
      setExportBusy(null);
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
    const vendor = purchaseVendor === "__other__" ? purchaseVendorOther.trim() : purchaseVendor.trim();
    if (!vendor) {
      setUploadMessage("購入先を選んでください");
      return;
    }
    setUploadBusy("import");
    setUploadMessage("");
    setUploadResult(null);
    try {
      const form = new FormData();
      form.set("file", uploadFile);
      form.set("purchaseVendor", vendor);
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

  const activeListSegments = useMemo(
    () => filterActiveSegments(analysis?.blocks.activeList.segments ?? [], activeListDays),
    [activeListDays, analysis],
  );

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function renderAnalysisBlock(
    title: string,
    block: AnalysisBlockKey,
    segments: AnalysisSegment[],
    selectedSegment: string,
    onSelectSegment: (segment: string) => void,
    controls?: ReactNode,
    help?: readonly string[],
    emptyText = "対象データがありません",
  ) {
    const selected = segments.find((segment) => segment.segment === selectedSegment) ?? segments[0];
    const showAll = showAllSegments[block];
    const visibleSegments = showAll ? segments : segments.slice(0, ANALYSIS_ROW_LIMIT);
    const chartData: ChartData<"doughnut"> = {
      labels: selected?.results.map((item) => item.result) ?? [],
      datasets: [
        {
          data: selected?.results.map((item) => item.rowCount) ?? [],
          backgroundColor: selected?.results.map((item) => resultColor(item.result)) ?? [],
          borderColor: "rgba(255,255,255,.9)",
          borderWidth: 2,
        },
      ],
    };
    const chartOptions: ChartOptions<"doughnut"> = {
      maintainAspectRatio: false,
      plugins: {
        // 凡例は円グラフの右（下に 2 段だと読みにくく、右側が空いていた。東海林さん 2026-09-13）
        legend: { position: "right", labels: { boxWidth: 14, padding: 10 } },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.raw ?? 0);
              const total = context.dataset.data.reduce((sum, item) => sum + Number(item), 0);
              const rate = total > 0 ? `（${((value / total) * 100).toFixed(1)}%）` : "";
              return `${context.label ?? ""} ${formatCount(value)} 件${rate}`;
            },
          },
        },
      },
      onClick(_event, elements) {
        const index = elements[0]?.index;
        const result = typeof index === "number" ? selected?.results[index]?.result : null;
        if (selected && result) void openAnalysisDetail(block, selected.segment, result);
      },
    };

    return (
      <section className={styles.analysisBlock}>
        <div className={styles.analysisBlockHeader}>
          <h3>{title}{help && <HelpTip lines={help} />}</h3>
          {controls}
        </div>
        {segments.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <>
            <div className={styles.analysisGrid}>
              <div className={styles.chartPane}>
                <Doughnut data={chartData} options={chartOptions} />
              </div>
              <div className={`${styles.tableWrap} ${styles.analysisTableWrap}`}>
                <table className={styles.analysisTable}>
                  <thead>
                    <tr>
                      <th>{block === "vendor" ? "購入先" : block === "contract" ? "既契約情報" : "リスト名"}</th>
                      <th>件数</th>
                      <th>コール済み</th>
                      <th>総コール回数</th>
                      <th>回転</th>
                      <th>有効</th>
                      <th>受注（案件）</th>
                      <th>獲得（コール）</th>
                      <th>受注率（有効）</th>
                      <th>受注率（総数）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSegments.map((segment) => (
                      <tr
                        key={segment.segment}
                        className={segment.segment === selected.segment ? styles.analysisSelectedRow : undefined}
                        onClick={() => onSelectSegment(segment.segment)}
                      >
                        <td>{segment.segment}</td>
                        <td>{formatCount(segment.rowCount)}</td>
                        <td>{formatCount(segment.calledCount)}</td>
                        <td>{formatCount(segment.callTotal)}</td>
                        <td>{formatRotation(segment.rotation)}</td>
                        <td>{formatCount(segment.validCount)}</td>
                        <td className={valueClassName(segment.orderCount)}>{formatCount(segment.orderCount)}</td>
                        <td className={valueClassName(segment.acquiredCount)}>{formatCount(segment.acquiredCount)}</td>
                        <td>{formatRate(segment.orderRateValid)}</td>
                        <td>{formatRate(segment.orderRateTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {segments.length > ANALYSIS_ROW_LIMIT && (
                <div className={styles.actions}>
                  <span className={styles.empty}>
                    {showAll ? `全 ${formatCount(segments.length)} 行を表示中` : `件数の多い順に ${ANALYSIS_ROW_LIMIT} 行を表示（全 ${formatCount(segments.length)} 行）`}
                  </span>
                  <button type="button" className={styles.secondaryButton} onClick={() => setShowAllSegments((current) => ({ ...current, [block]: !showAll }))}>
                    {showAll ? `上位 ${ANALYSIS_ROW_LIMIT} 行だけにする` : "すべて表示する"}
                  </button>
                </div>
              )}
            </div>
            <div className={styles.resultButtons}>
              {(selected?.results ?? []).map((item) => (
                <button key={item.result} type="button" className={styles.resultButton} onClick={() => void openAnalysisDetail(block, selected.segment, item.result)}>
                  <span style={{ background: resultColor(item.result) }} />
                  {item.result} {formatCount(item.rowCount)} 件
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    );
  }

  function renderAnalysisDetail() {
    if (!analysisDetail) return null;
    const keyword = analysisDetail.filter.trim();
    const rows = keyword ? analysisDetail.rows.filter((row) => row.listName.includes(keyword)) : analysisDetail.rows;
    return (
      <section className={styles.analysisDetail}>
        <div className={styles.analysisBlockHeader}>
          <h3>{analysisDetail.segment} × {analysisDetail.result}：リスト名ごと</h3>
          <button type="button" className={styles.secondaryButton} onClick={() => setAnalysisDetail(null)}>閉じる</button>
        </div>
        <div className={styles.actions}>
          <label>
            リスト名で絞る
            <input
              value={analysisDetail.filter}
              onChange={(event) => setAnalysisDetail((current) => current ? { ...current, filter: event.target.value } : current)}
              placeholder="含む"
            />
          </label>
        </div>
        <div className={`${styles.tableWrap} ${styles.analysisTableWrap}`}>
          <table className={styles.analysisTable}>
            <thead>
              <tr>
                <th>リスト名</th>
                <th>投入日</th>
                <th>件数</th>
                <th>コール済み</th>
                <th>総コール回数</th>
                <th>受注（案件）</th>
                <th>獲得（コール）</th>
                <th>最終コール日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.listName}>
                  <td>{row.listName}</td>
                  <td>{row.listLoadedOn ?? ""}</td>
                  <td>{formatCount(row.rowCount)}</td>
                  <td>{formatCount(row.calledCount)}</td>
                  <td>{formatCount(row.callTotal)}</td>
                  <td className={valueClassName(row.orderCount)}>{formatCount(row.orderCount)}</td>
                  <td className={valueClassName(row.acquiredCount)}>{formatCount(row.acquiredCount)}</td>
                  <td>{row.lastCalledOn ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8}>対象データがありません</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
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
          <span>{formatOrderSyncStatus(orderSyncState)}</span>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="リストマスタの表示">
        {TAB_LABELS.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} onClick={() => changeTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <ListProcessingOverlay open={searchBusy} mode="search" />
      <ListProcessingOverlay open={exportBusy !== null} mode="export" count={exportBusy?.count ?? 0} format={exportBusy?.format ?? ""} />
      <SaveConditionModal
        open={conditionModalOpen}
        conditionName={conditionName}
        currentSummary={currentFilterSummary}
        savedConditions={savedConditions}
        busy={busy}
        message={conditionModalMessage}
        onNameChange={setConditionName}
        onClose={() => setConditionModalOpen(false)}
        onSave={() => void handleSaveCondition()}
        onLoad={(item) => void handleLoadCondition(item)}
        onDelete={(id) => void handleDeleteCondition(id)}
      />

      {activeTab === "list" && (
        <>
      <section className={`${styles.panel} ${filtersCollapsed ? styles.filterSummaryPanel : ""}`} aria-labelledby="filter-heading">
        <div className={styles.panelTitle}>
          <h2 id="filter-heading">絞り込み</h2>
          <button type="button" className={styles.secondaryButton} onClick={() => { setConditionModalOpen(true); setConditionModalMessage(""); }} disabled={busy}>
            条件を保存
          </button>
        </div>
        {filtersCollapsed && count !== null ? (
          <div className={styles.collapsedFilterRow}>
            <strong>
              該当 {approximate ? "約 " : ""}
              {count.toLocaleString("ja-JP")} 件
              {elapsedMs !== null ? `（${(elapsedMs / 1000).toFixed(1)} 秒）` : ""}
            </strong>
            <span>{currentFilterSummary}</span>
            <button type="button" className={styles.secondaryButton} onClick={() => setFiltersCollapsed(false)}>
              条件を変える
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => { setConditionModalOpen(true); setConditionModalMessage(""); }} disabled={busy}>
              条件を保存
            </button>
          </div>
        ) : (
          <form onSubmit={handleFilterSubmit}>
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
              <label className={styles.searchInline}>
                購入履歴
                <span>
                  <select value={filters.purchaseHistory} onChange={(event) => setFilter("purchaseHistory", event.target.value)}>
                    {SOIL_LIST_FILTER_DEFINITIONS[9].options?.map((option) => (
                      <option key={option} value={option}>
                        {option || "指定なし"}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={busy}>
                    検索
                  </button>
                </span>
              </label>
            </div>
          </form>
        )}
        {message && <p className={styles.message}>{message}</p>}
      </section>

      <section className={styles.panel} aria-labelledby="table-heading">
        <div className={styles.tableHeaderRow}>
          <h2 id="table-heading">
            一覧（{count === null ? "0" : `${approximate ? "約 " : ""}${count.toLocaleString("ja-JP")}`} 件・個人情報は一部伏せる）
          </h2>
          <div className={styles.pagination}>
            <button type="button" className={styles.secondaryButton} onClick={() => void handlePageChange(listPage - 1)} disabled={busy || listPage <= 1}>
              ＜
            </button>
            <span>{listPage} / {totalPages} ページ</span>
            <button type="button" className={styles.secondaryButton} onClick={() => void handlePageChange(listPage + 1)} disabled={busy || listPage >= totalPages}>
              ＞
            </button>
            <span>100 件ずつ{pageCapped ? `（ページ送りは ${MAX_SEARCH_PAGE} ページ＝${(MAX_SEARCH_PAGE * SEARCH_PAGE_SIZE).toLocaleString("ja-JP")} 件まで。先を見るときは条件で絞ってください）` : ""}</span>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {SEARCH_TABLE_COLUMNS.map((column) => (
                  <th key={column.key}>
                    <button type="button" className={styles.sortHeaderButton} onClick={() => void handleSortChange(column.key)}>
                      {column.label}
                      {listSort?.key === column.key && (
                        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                          {listSort.direction === "asc" ? <path d="M6 2 2 8h8z" /> : <path d="M6 10 2 4h8z" />}
                        </svg>
                      )}
                    </button>
                  </th>
                ))}
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
            並び
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SoilListSortKey)}>
              {SOIL_LIST_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={styles.radioGroup}>
            <legend>形式</legend>
            {EXPORT_FORMAT_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="soil-list-export-format"
                  value={option.value}
                  checked={exportFormat === option.value}
                  disabled={option.value === "xlsx" && count !== null && count > EXCEL_MAX_EXPORT_ROWS}
                  onChange={() => setExportFormat(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <button type="button" onClick={handleExport} disabled={busy || count === null || (exportFormat === "xlsx" && count > EXCEL_MAX_EXPORT_ROWS)}>
            {count === null ? "検索後に書き出す" : `${count.toLocaleString("ja-JP")} 件を書き出す`}
          </button>
        </div>
        <p className={styles.empty}>※ Excel は 1,048,576 行まで（Excel の上限）。それを超えるときは CSV か .mer を選んでください</p>
        {count !== null && count > EXCEL_MAX_EXPORT_ROWS && <p className={styles.warningLine}>Excel の上限を超えています。CSV か .mer を選んでください。</p>}
        <div className={styles.listStack}>
          {exports.map((item) => (
            <div className={styles.savedRow} key={item.id}>
              <span>
                {formatDateTime(item.created_at)} {item.created_by ?? ""} {item.row_count.toLocaleString("ja-JP")} 件 {exportFormatLabel(item.format)}
              </span>
              {item.format === "mer" || !item.format ? <small>置き換え {item.replaced_chars.toLocaleString("ja-JP")} 文字</small> : null}
              {item.rebuild_from_condition && <small>条件で作り直し</small>}
              <button type="button" onClick={() => handleRedownload(item)}>
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
            <div className={styles.purchaseVendorRow}>
              <label>
                購入先
                <select required value={purchaseVendor} onChange={(event) => setPurchaseVendor(event.target.value)}>
                  <option value="">選択してください</option>
                  {purchaseVendors.map((vendor) => (
                    <option key={vendor.value} value={vendor.value}>
                      {vendor.value}（{vendor.count.toLocaleString("ja-JP")}）
                    </option>
                  ))}
                  <option value="__other__">その他（手入力）</option>
                </select>
              </label>
              {purchaseVendor === "__other__" && (
                <label>
                  その他の購入先
                  <input value={purchaseVendorOther} onChange={(event) => setPurchaseVendorOther(event.target.value)} />
                </label>
              )}
              <span>初めての電話番号は、この購入先で購入履歴に入ります</span>
            </div>
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
                <button type="button" onClick={handleUploadImport} disabled={uploadBusy !== null || !purchaseVendor || (purchaseVendor === "__other__" && !purchaseVendorOther.trim())}>
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
              <p>{purchaseResultLine(uploadResult)}</p>
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
                  <small>購入先：{item.購入先 ?? ""}</small>
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
            <div className={styles.analysisTitleActions}>
              <span>
                {analysis?.refreshedAt
                  ? `集計：${formatJstWithWeekday(analysis.refreshedAt)} 時点`
                  : "集計がまだありません。↻ を押してください"}
              </span>
              <button
                type="button"
                className={`${styles.syncIconButton} ${analysisRefreshBusy ? styles.syncIconBusy : ""}`}
                onClick={() => void handleAnalysisRefresh()}
                disabled={analysisRefreshBusy}
                aria-label="分析集計を作り直す"
                title="分析集計を作り直す"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                  <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M19.8 4.6v4.2h-4.2z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
          {analysisMessage && <p className={styles.message}>{analysisMessage}</p>}
          {analysisBusy && <div className={styles.loading}><span />読み込んでいます</div>}
          {analysis && (
            <div className={styles.analysisStack}>
              {renderAnalysisBlock(
                "① どこから購入したか",
                "vendor",
                analysis.blocks.vendor.segments,
                analysisSelections.vendor,
                (segment) => setAnalysisSelections((current) => ({ ...current, vendor: segment })),
                undefined,
                ANALYSIS_HELP.vendor,
              )}
              {renderAnalysisBlock(
                "② 今コールしているリスト",
                "active_list",
                activeListSegments,
                analysisSelections.activeList,
                (segment) => setAnalysisSelections((current) => ({ ...current, activeList: segment })),
                <div className={styles.segmentedControl}>
                  <button type="button" aria-pressed={activeListDays === 30} onClick={() => setActiveListDays(30)}>直近 30 日</button>
                  <button type="button" aria-pressed={activeListDays === 15} onClick={() => setActiveListDays(15)}>直近 15 日</button>
                </div>,
                ANALYSIS_HELP.activeList,
              )}
              {renderAnalysisBlock(
                "③ 新営業 FileMaker の既契約",
                "contract",
                analysis.blocks.contract.segments,
                analysisSelections.contract,
                (segment) => setAnalysisSelections((current) => ({ ...current, contract: segment })),
                <span className={styles.empty}>
                  {analysis.blocks.contract.snapshotAt
                    ? `新営業の写し：${formatJstWithWeekday(analysis.blocks.contract.snapshotAt)} 時点`
                    : "新営業の写しはまだありません"}
                </span>,
                ANALYSIS_HELP.contract,
                "集計を作り直すと表示されます（↻）",
              )}
              {renderAnalysisDetail()}
              <details className={styles.definitionBox}>
                <summary>定義</summary>
                <p>件数＝その区切りに入る電話番号の数。電話番号が空の行は数えません。</p>
                <p>コール済み＝コール回数合計が 1 以上の番号数。総コール回数＝コール回数合計の合計。回転＝総コール回数 ÷ 件数。</p>
                <p>有効＝件数 − 最終コール結果が「無効」の番号数。受注（案件）＝受注件数が 1 以上の番号数。獲得（コール）＝最終コール結果が「獲得」の番号数。</p>
                <p>受注率は受注（案件）で計算しています。獲得（コール）は件数だけ並べています。</p>
              </details>
            </div>
          )}
        </section>
      )}

      {activeTab === "guide" && (
        <section className={styles.panel} aria-labelledby="guide-heading">
          <h2 id="guide-heading">リストマスタのデータの持ち方</h2>
          <div className={styles.guideTables}>
            <div className={`${styles.tableWrap} ${styles.guideTableWrap}`}>
              <table className={styles.guideTable}>
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>1 行の単位</th>
                    <th>件数の目安</th>
                    <th>入っているもの</th>
                    <th>いつ増える・変わるか</th>
                  </tr>
                </thead>
                <tbody>
                  {GUIDE_TABLE_ROWS.map((row) => (
                    <tr key={row.name} className={"pending" in row && row.pending ? styles.pendingRow : undefined}>
                      <td>{row.name}</td>
                      <td>{row.unit}</td>
                      <td>{row.count}</td>
                      <td>{row.contains}</td>
                      <td>{row.timing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${styles.tableWrap} ${styles.guideTableWrap}`}>
              <table className={styles.guideRulesTable}>
                <thead>
                  <tr>
                    <th>項目</th>
                    <th>決まり</th>
                  </tr>
                </thead>
                <tbody>
                  {GUIDE_RULE_ROWS.map(([item, rule]) => (
                    <tr key={item}>
                      <td>{item}</td>
                      <td>{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
