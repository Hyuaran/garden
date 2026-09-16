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
  phoneNumberKey: string;
  phoneNumber: string;
  name: string;
  addressCity: string;
  listName: string;
  lastCalledOn: string;
  callCount: number | null;
  purchaseStatus: string;
  lineType: string;
  contractMonth: string;
  contractElapsed: string;
  category: string;
  internalBlocked: boolean;
};

type ListSearchSortKey = keyof SearchRow;
type ListSearchSortDirection = "asc" | "desc";
type ListSearchSort = { key: ListSearchSortKey; direction: ListSearchSortDirection };
type SortableListSearchKey = "phoneNumber" | "name" | "addressCity" | "listName" | "lastCalledOn" | "callCount" | "purchaseStatus" | "contractMonth";

const SEARCH_PAGE_SIZE = 100;
const SEARCH_TABLE_COLUMNS: Array<{ key: ListSearchSortKey; label: string; sortable?: boolean }> = [
  { key: "phoneNumber", label: "電話番号" },
  { key: "name", label: "氏名" },
  { key: "addressCity", label: "住所（市区町村まで）" },
  { key: "listName", label: "リスト名" },
  { key: "lastCalledOn", label: "最終コール日" },
  { key: "callCount", label: "コール回数" },
  { key: "purchaseStatus", label: "購入状態" },
  { key: "lineType", label: "元回線", sortable: false },
  { key: "contractMonth", label: "契約時期", sortable: true },
  { key: "contractElapsed", label: "経過", sortable: false },
  { key: "category", label: "区分", sortable: false },
  { key: "internalBlocked", label: "自社アポ禁", sortable: false },
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

type ActiveTab = "list" | "upload" | "analysis" | "history" | "guide";

type UploadPreview = {
  format: "A" | "B" | "C";
  formatLabel: string;
  rowCount: number;
  listNames: Array<{ name: string; count: number; listLoadedOn: string | null }>;
  lineTypes: Array<{ value: string; count: number }>;
  warnings: { emptyPhoneRows: number; shortPhoneRows: number; unreadableListDateNames: number };
};

type RawUploadPreview = {
  files: Array<{ fileName: string; kind: "hikari" | "kureka"; rowCount: number }>;
  summary: { readRows: number; importRows: number; excludedRows: number; needsReviewRows: number; excludedAssignment: number; excludedOrder: number };
  listNames: Array<{ name: string; count: number; needsReview: number; excluded: number }>;
  needsReview: Array<{ rowNumber: number; listName: string | null; name: string; phone: string; reasons: string[] }>;
  excluded: Array<{ rowNumber: number; listName: string | null; phone: string; reason: string | undefined }>;
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
  line_type_set: number;
  category_set: number;
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
  source_kind?: "import_file" | "raw_excel";
  raw_file_names?: string[] | null;
  excluded_assignment?: number | null;
  excluded_order?: number | null;
  needs_review?: number | null;
};

type InternalBlockRow = {
  id: string;
  電話番号: string;
  登録日: string;
  理由: string;
  登録者: string | null;
  出所: string;
  解除日: string | null;
  解除者: string | null;
  解除理由: string | null;
  created_at: string;
};

type InternalBlockPreview = {
  rowCount: number;
  validRows: number;
  duplicateRows: number;
  invalidPhoneRows: number;
  missingReasonRows: number;
  alreadyBlockedRows: number;
};

type HistoryCurrent = {
  phoneNumber: string;
  name: string;
  address: string;
  listName: string;
  lineType: string;
  auCallAvailability: string;
  appointmentBlocked: string;
  internalBlocked: boolean;
  purchaseStatus: string;
  callCount: number;
  lastCallResult: string;
};

type HistoryRow = {
  occurred_on: string | null;
  type: string;
  title: string;
  detail: string;
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
  orderCaseCount: number;
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
    lineType: { segments: AnalysisSegment[] };
    contractYear: { segments: AnalysisSegment[] };
    activeList: { segments: AnalysisSegment[] };
    contract: { segments: AnalysisSegment[]; snapshotAt: string | null };
  };
};

type AnalysisAxis = "vendor" | "line_type" | "contract_year";
type AnalysisBlockKey = AnalysisAxis | "active_list" | "contract";

type AnalysisSortKey =
  | "segment"
  | "rowCount"
  | "calledCount"
  | "callTotal"
  | "rotation"
  | "validCount"
  | "orderCount"
  | "orderCaseCount"
  | "acquiredCount"
  | "orderRateValid"
  | "orderRateTotal";
type AnalysisSort = { key: AnalysisSortKey; direction: ListSearchSortDirection };

const ANALYSIS_TABLE_COLUMNS: Array<{ key: AnalysisSortKey; label: string; sub?: string }> = [
  { key: "segment", label: "区切り" },
  { key: "rowCount", label: "件数" },
  { key: "calledCount", label: "コール", sub: "済み" },
  { key: "callTotal", label: "総コール", sub: "回数" },
  { key: "rotation", label: "回転" },
  { key: "validCount", label: "有効" },
  { key: "orderCount", label: "受注", sub: "顧客数" },
  { key: "orderCaseCount", label: "受注", sub: "案件数" },
  { key: "acquiredCount", label: "獲得", sub: "（コール）" },
  { key: "orderRateValid", label: "受注率", sub: "（有効）" },
  { key: "orderRateTotal", label: "受注率", sub: "（総数）" },
];

type AnalysisDetailRow = {
  listName: string;
  listLoadedOn: string | null;
  rowCount: number;
  calledCount: number;
  callTotal: number;
  orderCount: number;
  orderCaseCount: number;
  acquiredCount: number;
  lastCalledOn: string | null;
};

export type FilterState = {
  prefecture: string[];
  auCallAvailability: string[];
  purchaseStatus: string[];
  appointmentBlocked: string[];
  lineType: string[];
  category: string[];
  listName: string;
  listLoadedOnFrom: string;
  listLoadedOnTo: string;
  recheckedOnFrom: string;
  recheckedOnTo: string;
  lastCalledOnFrom: string;
  lastCalledOnTo: string;
  callCountFrom: string;
  callCountTo: string;
  elapsedYearsFrom: string;
  elapsedYearsTo: string;
  purchaseHistory: string;
  internalBlock: string;
};

const initialFilters: FilterState = {
  prefecture: [],
  auCallAvailability: ["○"],
  purchaseStatus: [],
  appointmentBlocked: [EMPTY_OPTION_VALUE],
  lineType: [],
  category: [],
  listName: "",
  listLoadedOnFrom: "",
  listLoadedOnTo: "",
  recheckedOnFrom: "",
  recheckedOnTo: "",
  lastCalledOnFrom: "",
  lastCalledOnTo: "",
  callCountFrom: "",
  callCountTo: "",
  elapsedYearsFrom: "",
  elapsedYearsTo: "",
  purchaseHistory: "",
  internalBlock: "なし",
};

const ACCEPTED_UPLOAD_EXTENSIONS = [".csv", ".xlsx", ".xls", ".mer"];
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
type HelpRow = { label: string; text: string };

/** 分析の各ブロックの見出し横の「？」に出す集計の条件（東海林さん 2026-09-13）。項目名｜説明 の 2 列で読みやすく */
const ANALYSIS_HELP: Record<"vendor" | "activeList" | "contract", { title: string; rows: readonly HelpRow[] }> = {
  vendor: {
    title: "① どこから購入したか の数え方",
    rows: [
      { label: "区切り", text: "電話番号台帳の「最新購入先」（購入履歴のいちばん新しい行の購入先）。空欄は「（購入先なし）」" },
      { label: "件数", text: "その購入先の電話番号の数（電話番号が空の行は数えない）" },
      { label: "円グラフ", text: "コール履歴の最終結果。留守・担不・無効・NG・前確OK・見込・獲得・未コール・（結果なし）を固定で出し、それ以外は「その他」。受注顧客数・受注案件数は Kintone の受注履歴から数えたもので、円グラフとは別の数え方" },
      { label: "受注率", text: "受注顧客数 ÷ 有効（件数 − 無効）。受注案件数は別列で並べます" },
      { label: "集計", text: "毎朝 6:45 と右上の丸い矢印で作り直し" },
    ],
  },
  activeList: {
    title: "② 今コールしているリスト の数え方",
    rows: [
      { label: "区切り", text: "リスト名があり、投入日が直近 60 日以内で、直近 30 日にコールがあるリスト" },
      { label: "直近 15 日", text: "その中で、15 日以内にコールがあるリストだけ。合計もその分だけで計算" },
      { label: "件数", text: "そのリスト名が電話番号台帳に入っている電話番号の数" },
      { label: "円グラフ・受注率", text: "①と同じ" },
    ],
  },
  contract: {
    title: "③ 新営業 FileMaker の既契約 の数え方",
    rows: [
      { label: "区切り", text: "新営業の「既契約情報」。空欄は「（既契約情報なし）」" },
      { label: "件数", text: "その既契約情報を持つ新営業の電話番号のうち、電話番号台帳にある番号。同じ番号が複数行あれば修正日が新しい行を使う" },
      { label: "円グラフ・受注率", text: "①と同じ" },
      { label: "元データ", text: "社内ホストPCから毎朝 5:30 に写す新営業の表" },
    ],
  },
};

/** 見出し横の「？」。マウスを乗せる・キーボードで選ぶと条件が表で出る */
function HelpTip({ help }: { help: { title: string; rows: readonly HelpRow[] } }) {
  return (
    <span className={styles.helpTip} tabIndex={0} aria-label={help.rows.map((row) => `${row.label}：${row.text}`).join("。")}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8" />
        <circle cx="12" cy="17" r=".6" fill="currentColor" />
      </svg>
      <span className={styles.helpTipBubble} role="tooltip">
        <strong className={styles.helpTipTitle}>{help.title}</strong>
        <table className={styles.helpTipTable}>
          <tbody>
            {help.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </span>
    </span>
  );
}
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const TAB_LABELS: Array<{ key: ActiveTab; label: string; query?: string }> = [
  { key: "list", label: "リスト" },
  { key: "upload", label: "アップロード", query: "upload" },
  { key: "analysis", label: "分析", query: "analysis" },
  { key: "history", label: "履歴検索", query: "history" },
  { key: "guide", label: "管理方法", query: "guide" },
];

const GUIDE_TABLE_ROWS = [
  {
    name: "電話番号台帳",
    unit: "電話番号 1 件",
    count: "約 267 万件",
    contains: "氏名・住所・郵便番号・携帯番号、元回線・契約時期・区分、購入履歴・投入履歴・コール履歴・受注履歴それぞれの一番新しい値、AU光架電可否・アポ禁・購入状態",
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
  ["元回線", "元回線＝リスト名（【光回線】アナログ／フレッツ／AU）→ 判定項目 → 購入先_NEW の順に決めた回線の種類"],
  ["契約時期", "契約時期＝購入日と経過月数から逆算した契約の年月（購入日が無い番号は空欄）"],
  ["区分", "区分＝氏名の言葉から自動で決めた個人／屋号／法人。一覧で直せます"],
  ["そのほかの表", "保留（桁がおかしい番号など）・携帯のみ・絞り込みの選択肢・保存した条件・書き出しの記録・アップロードの記録・コール履歴の反映状態"],
] as const;

function dateInJapanParts(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function yearsAgoDate(years: string, exclusiveUpper = false, now = new Date()): string {
  const parsed = Number(years);
  if (!Number.isInteger(parsed) || parsed < 0) return "";
  const current = dateInJapanParts(now);
  const date = new Date(Date.UTC(current.year - parsed, current.month - 1, current.day));
  if (exclusiveUpper) date.setUTCFullYear(date.getUTCFullYear() - 1);
  if (exclusiveUpper) date.setUTCDate(date.getUTCDate() + 1);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

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
  pushSelect("lineType", filters.lineType);
  pushSelect("category", filters.category);
  if (filters.listName) result.push({ field: "listName", op: "contains", value: filters.listName });
  if (filters.listLoadedOnFrom) result.push({ field: "listLoadedOn", op: "gte", value: filters.listLoadedOnFrom });
  if (filters.listLoadedOnTo) result.push({ field: "listLoadedOn", op: "lte", value: filters.listLoadedOnTo });
  if (filters.recheckedOnFrom) result.push({ field: "recheckedOn", op: "gte", value: filters.recheckedOnFrom });
  if (filters.recheckedOnTo) result.push({ field: "recheckedOn", op: "lte", value: filters.recheckedOnTo });
  if (filters.lastCalledOnFrom) result.push({ field: "lastCalledOn", op: "gte", value: filters.lastCalledOnFrom });
  if (filters.lastCalledOnTo) result.push({ field: "lastCalledOn", op: "lte", value: filters.lastCalledOnTo });
  if (filters.callCountFrom) result.push({ field: "callCount", op: "gte", value: Number(filters.callCountFrom) });
  if (filters.callCountTo) result.push({ field: "callCount", op: "lte", value: Number(filters.callCountTo) });
  if (filters.elapsedYearsFrom) result.push({ field: "contractMonth", op: "lte", value: yearsAgoDate(filters.elapsedYearsFrom) });
  if (filters.elapsedYearsTo) result.push({ field: "contractMonth", op: "gte", value: yearsAgoDate(filters.elapsedYearsTo, true) });
  if (filters.purchaseHistory === "あり") result.push({ field: "purchaseHistoryExists", op: "eq", value: true });
  if (filters.purchaseHistory === "なし") result.push({ field: "purchaseHistoryExists", op: "eq", value: false });
  if (filters.internalBlock === "あり") result.push({ field: "internalBlocked", op: "eq", value: true });
  if (filters.internalBlock === "なし") result.push({ field: "internalBlocked", op: "eq", value: false });
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
    if (filter.field === "contractMonth" && filter.op === "lte") next.elapsedYearsFrom = contractDateToYears(String(filter.value), "from");
    if (filter.field === "contractMonth" && filter.op === "gte") next.elapsedYearsTo = contractDateToYears(String(filter.value), "to");
    if (filter.field === "purchaseHistoryExists" && filter.op === "eq") {
      next.purchaseHistory = filter.value === true ? "あり" : "なし";
    }
    if (filter.field === "internalBlocked" && filter.op === "eq") {
      next.internalBlock = filter.value === true ? "あり" : "なし";
    }
  }
  return next;
}

function contractDateToYears(value: string, bound: "from" | "to"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const current = dateInJapanParts();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let months = (current.year - year) * 12 + (current.month - month);
  if (current.day < day) months -= 1;
  const years = Math.max(0, Math.floor(months / 12));
  return String(bound === "to" ? Math.max(0, years - 1) : years);
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
  return field === "prefecture" || field === "auCallAvailability" || field === "purchaseStatus" || field === "appointmentBlocked" || field === "lineType" || field === "category";
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
  return tab === "upload" || tab === "analysis" || tab === "history" || tab === "guide" ? tab : "list";
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
  獲得: "#0891b2",
  未コール: "#6b7280",
  その他: "#cbd5e1",
  "（結果なし）": "#94a3b8",
};

const ANALYSIS_RESULT_ORDER = ["留守", "担不", "無効", "NG", "前確OK", "見込", "獲得", "未コール", "その他", "（結果なし）"];

function resultColor(result: string): string {
  return ANALYSIS_COLORS[result] ?? "#64748b";
}

function valueClassName(value: number): string {
  return value > 0 ? styles.valueStrong : styles.valueZero;
}

function buildAnalysisTotal(segments: AnalysisSegment[], resultOrderSource: AnalysisSegment[] = segments): AnalysisSegment {
  const total: AnalysisSegment = {
    segment: "合計",
    rowCount: 0,
    calledCount: 0,
    callTotal: 0,
    invalidCount: 0,
    validCount: 0,
    orderCount: 0,
    orderCaseCount: 0,
    acquiredCount: 0,
    lastCalledOn: null,
    segmentLastCalledOn: null,
    rotation: 0,
    orderRateValid: 0,
    orderRateTotal: 0,
    results: [],
  };
  const results = new Map<string, number>();
  for (const segment of segments) {
    total.rowCount += segment.rowCount;
    total.calledCount += segment.calledCount;
    total.callTotal += segment.callTotal;
    total.invalidCount += segment.invalidCount;
    total.orderCount += segment.orderCount;
    total.orderCaseCount += segment.orderCaseCount ?? 0;
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
  const sourceOrder = resultOrderSource.find((segment) => segment.segment === "合計")?.results.map((item) => item.result) ?? [];
  total.results = [...results.entries()]
    .map(([result, rowCount]) => ({ result, rowCount }))
    .sort((a, b) => {
      const left = ANALYSIS_RESULT_ORDER.indexOf(a.result);
      const right = ANALYSIS_RESULT_ORDER.indexOf(b.result);
      const leftSource = sourceOrder.indexOf(a.result);
      const rightSource = sourceOrder.indexOf(b.result);
      return (
        (left === -1 ? ANALYSIS_RESULT_ORDER.length : left) - (right === -1 ? ANALYSIS_RESULT_ORDER.length : right) ||
        (leftSource === -1 ? sourceOrder.length : leftSource) - (rightSource === -1 ? sourceOrder.length : rightSource) ||
        b.rowCount - a.rowCount
      );
    });
  return total;
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
  return [buildAnalysisTotal(kept, segments), ...kept];
}

function filterVendorSegments(segments: AnalysisSegment[], selectedVendors: string[]): AnalysisSegment[] {
  if (selectedVendors.length === 0) return segments;
  const selected = new Set(selectedVendors);
  const kept = segments.filter((segment) => segment.segment !== "合計" && selected.has(segment.segment));
  return [buildAnalysisTotal(kept, segments), ...kept];
}

function sortAnalysisSegments(segments: AnalysisSegment[], sort: AnalysisSort | null): AnalysisSegment[] {
  if (!sort) return segments;
  const total = segments.find((segment) => segment.segment === "合計");
  const rows = segments.filter((segment) => segment.segment !== "合計");
  const direction = sort.direction === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    if (sort.key === "segment") {
      return a.segment.localeCompare(b.segment, "ja-JP") * direction;
    }
    const left = typeof a[sort.key] === "number" ? a[sort.key] : 0;
    const right = typeof b[sort.key] === "number" ? b[sort.key] : 0;
    const diff = left - right;
    if (diff !== 0) return diff * direction;
    return a.segment.localeCompare(b.segment, "ja-JP");
  });
  return total ? [total, ...sorted] : sorted;
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

function derivedResultLine(result: UploadResult): string {
  return `元回線を付けた ${(result.line_type_set ?? 0).toLocaleString("ja-JP")} 件・区分を付けた ${(result.category_set ?? 0).toLocaleString("ja-JP")} 件`;
}

function uploadHistoryStatus(item: UploadHistory): string {
  const prefix = item.source_kind === "raw_excel" ? "元 Excel／" : "";
  if (item.status === "done" && item.result) {
    return `${prefix}新規 ${item.result.parent_inserted.toLocaleString("ja-JP")}／更新 ${item.result.parent_updated.toLocaleString("ja-JP")}／購入履歴 ${(item.result.purchase_inserted ?? 0).toLocaleString("ja-JP")}／元回線 ${(item.result.line_type_set ?? 0).toLocaleString("ja-JP")}／区分 ${(item.result.category_set ?? 0).toLocaleString("ja-JP")}`;
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
  pushMulti("lineType", "元回線", filters.lineType);
  pushMulti("category", "区分", filters.category);
  if (filters.listName) parts.push(`リスト名：${filters.listName}を含む`);
  if (filters.listLoadedOnFrom || filters.listLoadedOnTo) parts.push(`投入日：${filters.listLoadedOnFrom || "指定なし"}〜${filters.listLoadedOnTo || "指定なし"}`);
  if (filters.recheckedOnFrom || filters.recheckedOnTo) parts.push(`再判定日：${filters.recheckedOnFrom || "指定なし"}〜${filters.recheckedOnTo || "指定なし"}`);
  if (filters.lastCalledOnFrom || filters.lastCalledOnTo) parts.push(`最終コール日：${filters.lastCalledOnFrom || "指定なし"}〜${filters.lastCalledOnTo || "指定なし"}`);
  if (filters.callCountFrom || filters.callCountTo) parts.push(`コール回数：${filters.callCountFrom || "指定なし"}〜${filters.callCountTo || "指定なし"}`);
  if (filters.elapsedYearsFrom || filters.elapsedYearsTo) parts.push(`経過（年）：${filters.elapsedYearsFrom || "指定なし"}年以上〜${filters.elapsedYearsTo || "指定なし"}年以下`);
  if (filters.purchaseHistory) parts.push(`購入履歴：${filters.purchaseHistory}`);
  if (filters.internalBlock) parts.push(`自社アポ禁：${filters.internalBlock}`);
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

function ConfirmActionModal({
  open,
  title,
  children,
  busy,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  busy: boolean;
  confirmLabel: string;
  onClose(): void;
  onConfirm(): void;
}) {
  useEffect(() => {
    if (!open || busy) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={styles.modalBackdrop} onMouseDown={busy ? undefined : onClose}>
      <section className={styles.conditionModal} aria-modal="true" role="dialog" aria-labelledby="confirm-modal-heading" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="confirm-modal-heading">{title}</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="閉じる" disabled={busy}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function InternalBlockReleaseModal({
  row,
  reason,
  busy,
  error,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  row: InternalBlockRow | null;
  reason: string;
  busy: boolean;
  error: string;
  onReasonChange(value: string): void;
  onClose(): void;
  onSubmit(): void;
}) {
  const open = row !== null;
  useEffect(() => {
    if (!open || busy) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, open, onClose]);

  if (!row) return null;
  return createPortal(
    <div className={styles.modalBackdrop} onMouseDown={busy ? undefined : onClose}>
      <section className={styles.conditionModal} aria-modal="true" role="dialog" aria-labelledby="internal-block-release-heading" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 id="internal-block-release-heading">自社アポ禁を解除する</h2>
          <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="閉じる" disabled={busy}>
            ×
          </button>
        </div>
        <dl className={styles.releaseSummary}>
          <div>
            <dt>電話番号</dt>
            <dd>{row.電話番号}</dd>
          </div>
          <div>
            <dt>登録日</dt>
            <dd>{formatJstWithWeekday(row.登録日)}</dd>
          </div>
          <div>
            <dt>理由</dt>
            <dd>{row.理由}</dd>
          </div>
          <div>
            <dt>登録者</dt>
            <dd>{row.登録者 ?? ""}</dd>
          </div>
        </dl>
        <label className={styles.modalTextareaLabel}>
          解除理由（必須）
          <textarea value={reason} rows={2} onChange={(event) => onReasonChange(event.target.value)} disabled={busy} />
        </label>
        <p className={styles.modalHint}>例：本人から再架電の了承あり／登録間違い</p>
        {error && <p className={styles.modalError}>{error}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={busy}>
            やめる
          </button>
          <button type="button" onClick={onSubmit} disabled={busy || reason.trim() === ""}>
            {busy ? "解除中…" : "解除する"}
          </button>
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
  const [conditionDeleteTarget, setConditionDeleteTarget] = useState<SavedCondition | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listSort, setListSort] = useState<ListSearchSort | null>(null);
  const [categoryBusyPhone, setCategoryBusyPhone] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<SoilListColumnKey[]>(
    SOIL_LIST_EXPORT_COLUMNS.filter((column) => column.defaultChecked).map((column) => column.key),
  );
  // 書き出しの並びは「リスト投入日が古い順」で固定（画面では選ばない）
  const sortKey: SoilListSortKey = "listLoadedOnAsc";
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportBusy, setExportBusy] = useState<{ count: number; format: string } | null>(null);
  const [exportConfirm, setExportConfirm] = useState<{ count: number; minutes: number } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [rawUploadPreview, setRawUploadPreview] = useState<RawUploadPreview | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistory[]>([]);
  const [purchaseVendors, setPurchaseVendors] = useState<PurchaseVendorOption[]>([]);
  const [purchaseVendor, setPurchaseVendor] = useState("");
  const [purchaseVendorOther, setPurchaseVendorOther] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadMode, setUploadMode] = useState<"raw" | "import">("raw");
  const [uploadBusy, setUploadBusy] = useState<"preview" | "import" | "download" | null>(null);
  const [uploadApplyBusyId, setUploadApplyBusyId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [analysisSelections, setAnalysisSelections] = useState({ vendor: "合計", activeList: "合計", contract: "合計" });
  const [activeListDays, setActiveListDays] = useState<15 | 30>(30);
  const [analysisSorts, setAnalysisSorts] = useState<Record<AnalysisBlockKey, AnalysisSort | null>>({ vendor: null, line_type: null, contract_year: null, active_list: null, contract: null });
  const [analysisVendorFilter, setAnalysisVendorFilter] = useState<string[]>([]);
  const [analysisAxis, setAnalysisAxis] = useState<AnalysisAxis>("vendor");
  const [vendorAndSegments, setVendorAndSegments] = useState<AnalysisSegment[] | null>(null);
  const [vendorAndBusy, setVendorAndBusy] = useState(false);
  // 表は上位 50 行だけ描く（購入先は 2,400 種類あり、全部描くと画面が固まった。2026-09-13 本番で確認）
  const [showAllSegments, setShowAllSegments] = useState<Record<AnalysisBlockKey, boolean>>({ vendor: false, line_type: false, contract_year: false, active_list: false, contract: false });
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
  const [internalBlockPhone, setInternalBlockPhone] = useState("");
  const [internalBlockReason, setInternalBlockReason] = useState("");
  const [internalBlockRows, setInternalBlockRows] = useState<InternalBlockRow[]>([]);
  const [internalBlockQuery, setInternalBlockQuery] = useState("");
  const [internalBlockIncludeReleased, setInternalBlockIncludeReleased] = useState(false);
  const [internalBlockMessage, setInternalBlockMessage] = useState("");
  const [internalBlockBusy, setInternalBlockBusy] = useState(false);
  const [internalBlockFile, setInternalBlockFile] = useState<File | null>(null);
  const [internalBlockPreview, setInternalBlockPreview] = useState<InternalBlockPreview | null>(null);
  const [internalBlockReleaseTarget, setInternalBlockReleaseTarget] = useState<InternalBlockRow | null>(null);
  const [internalBlockReleaseReason, setInternalBlockReleaseReason] = useState("");
  const [internalBlockReleaseError, setInternalBlockReleaseError] = useState("");
  const internalBlockFileRef = useRef<HTMLInputElement>(null);
  const [historyPhone, setHistoryPhone] = useState("");
  const [historyCurrent, setHistoryCurrent] = useState<HistoryCurrent | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyOmitted, setHistoryOmitted] = useState(false);
  const [historyTypes, setHistoryTypes] = useState<string[]>([]);
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const condition = useMemo(() => filtersToCondition(filters), [filters]);
  const currentFilterSummary = useMemo(() => describeFilters(filters, options), [filters, options]);
  // ページ送りは 500 ページ（50,000 件）まで。深いページは遅い（本番実測：190 万件目で 89 秒）ので、それより先は条件で絞ってもらう
  const rawTotalPages = count === null ? 1 : Math.max(1, Math.ceil(count / SEARCH_PAGE_SIZE));
  const totalPages = Math.min(rawTotalPages, MAX_SEARCH_PAGE);
  const pageCapped = rawTotalPages > MAX_SEARCH_PAGE;
  const excelOverLimit = exportFormat === "xlsx" && count !== null && count > EXCEL_MAX_EXPORT_ROWS;

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

  async function loadInternalBlocks() {
    const params = new URLSearchParams({ page: "1" });
    if (internalBlockQuery.trim()) params.set("q", internalBlockQuery.trim());
    if (internalBlockIncludeReleased) params.set("includeReleased", "true");
    const response = await fetch(`/api/soil/list/internal-block?${params.toString()}`);
    const data = await readJson<{ ok: boolean; rows: InternalBlockRow[] }>(response);
    setInternalBlockRows(data.rows);
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

  async function loadVendorAndAnalysis(vendors: string[], axis: AnalysisAxis) {
    if (vendors.length < 2) {
      setVendorAndSegments(null);
      return;
    }
    setVendorAndBusy(true);
    setAnalysisMessage("");
    try {
      const params = new URLSearchParams({ axis });
      for (const vendor of vendors) params.append("vendor", vendor);
      const response = await fetch(`/api/soil/list/analysis?${params.toString()}`);
      const data = await readJson<{ ok: boolean; block: { segments: AnalysisSegment[] } }>(response);
      setVendorAndSegments(data.block.segments);
      setAnalysisSelections((current) => ({ ...current, vendor: "合計" }));
    } catch (error) {
      setVendorAndSegments(null);
      setAnalysisMessage(error instanceof Error ? error.message : "分析を読み込めませんでした");
    } finally {
      setVendorAndBusy(false);
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

  useEffect(() => {
    if (activeTab !== "analysis") return;
    void loadVendorAndAnalysis(analysisVendorFilter, analysisAxis);
  }, [activeTab, analysisAxis, analysisVendorFilter]);

  useEffect(() => {
    if (activeTab !== "guide") return;
    void loadInternalBlocks().catch((error: unknown) => setInternalBlockMessage(error instanceof Error ? error.message : "自社アポ禁を読み込めませんでした"));
  }, [activeTab, internalBlockIncludeReleased]);

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
    setBusy(true);
    setConditionModalMessage("");
    try {
      const response = await fetch(`/api/soil/list/conditions/${encodeURIComponent(id)}`, { method: "DELETE" });
      await readJson(response);
      await loadSaved();
      setConditionDeleteTarget(null);
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

  async function handleSortChange(key: SortableListSearchKey) {
    if (busy) return;
    const direction: ListSearchSortDirection = listSort?.key === key && listSort.direction === "asc" ? "desc" : "asc";
    await runListSearch({ nextPage: 1, nextSort: { key, direction }, refreshCount: false });
  }

  async function handleCategoryChange(rowIndex: number, phoneNumber: string, category: string) {
    const previousRows = rows;
    setCategoryBusyPhone(phoneNumber);
    setRows((current) => current.map((row, index) => index === rowIndex ? { ...row, category } : row));
    try {
      const response = await fetch("/api/soil/list/phones/category", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, category }),
      });
      await readJson(response);
    } catch (error) {
      setRows(previousRows);
      setMessage(error instanceof Error ? error.message : "区分を更新できませんでした");
    } finally {
      setCategoryBusyPhone(null);
    }
  }

  async function handleInternalBlockRegister() {
    setInternalBlockBusy(true);
    setInternalBlockMessage("");
    try {
      const response = await fetch("/api/soil/list/internal-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: internalBlockPhone, reason: internalBlockReason }),
      });
      const data = await readJson<{ ok: boolean; inserted: number; alreadyBlocked: number }>(response);
      setInternalBlockPhone("");
      setInternalBlockReason("");
      await loadInternalBlocks();
      setInternalBlockMessage(data.inserted > 0 ? "登録しました" : "すでに登録済みです");
    } catch (error) {
      setInternalBlockMessage(error instanceof Error ? error.message : "登録できませんでした");
    } finally {
      setInternalBlockBusy(false);
    }
  }

  async function previewInternalBlockFile(file: File | null) {
    setInternalBlockMessage("");
    setInternalBlockPreview(null);
    setInternalBlockFile(file);
    if (!file) return;
    setInternalBlockBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/soil/list/internal-block/preview", { method: "POST", body: form });
      const data = await readJson<{ ok: boolean; preview: InternalBlockPreview }>(response);
      setInternalBlockPreview(data.preview);
    } catch (error) {
      setInternalBlockFile(null);
      setInternalBlockMessage(error instanceof Error ? error.message : "取り込めませんでした");
    } finally {
      setInternalBlockBusy(false);
    }
  }

  async function handleInternalBlockBulk() {
    if (!internalBlockFile) return;
    setInternalBlockBusy(true);
    setInternalBlockMessage("");
    try {
      const form = new FormData();
      form.set("file", internalBlockFile);
      const response = await fetch("/api/soil/list/internal-block/bulk", { method: "POST", body: form });
      const data = await readJson<{ ok: boolean; result: InternalBlockPreview & { inserted: number } }>(response);
      setInternalBlockFile(null);
      setInternalBlockPreview(null);
      await loadInternalBlocks();
      setInternalBlockMessage(`登録しました（${data.result.inserted.toLocaleString("ja-JP")} 件）`);
    } catch (error) {
      setInternalBlockMessage(error instanceof Error ? error.message : "登録できませんでした");
    } finally {
      setInternalBlockBusy(false);
    }
  }

  function openInternalBlockRelease(row: InternalBlockRow) {
    setInternalBlockReleaseTarget(row);
    setInternalBlockReleaseReason("");
    setInternalBlockReleaseError("");
    setInternalBlockMessage("");
  }

  function closeInternalBlockRelease() {
    if (internalBlockBusy) return;
    setInternalBlockReleaseTarget(null);
    setInternalBlockReleaseReason("");
    setInternalBlockReleaseError("");
  }

  async function handleInternalBlockRelease() {
    const target = internalBlockReleaseTarget;
    const reason = internalBlockReleaseReason.trim();
    if (!target || !reason) return;
    setInternalBlockBusy(true);
    setInternalBlockMessage("");
    setInternalBlockReleaseError("");
    try {
      const response = await fetch(`/api/soil/list/internal-block/${encodeURIComponent(target.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      await readJson(response);
      await loadInternalBlocks();
      setInternalBlockReleaseTarget(null);
      setInternalBlockReleaseReason("");
      setInternalBlockMessage("解除しました");
    } catch (error) {
      setInternalBlockReleaseError(error instanceof Error ? error.message : "解除できませんでした");
    } finally {
      setInternalBlockBusy(false);
    }
  }

  async function handleHistorySearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setHistoryBusy(true);
    setHistoryMessage("");
    try {
      const params = new URLSearchParams({ phone: historyPhone });
      const response = await fetch(`/api/soil/list/history?${params.toString()}`);
      const data = await readJson<{ ok: boolean; current: HistoryCurrent | null; rows: HistoryRow[]; omitted: boolean }>(response);
      setHistoryCurrent(data.current);
      setHistoryRows(data.rows);
      setHistoryOmitted(data.omitted);
      setHistoryTypes([...new Set(data.rows.map((row) => row.type))]);
      if (!data.current && data.rows.length === 0) setHistoryMessage("この番号の記録はありません");
    } catch (error) {
      setHistoryCurrent(null);
      setHistoryRows([]);
      setHistoryMessage(error instanceof Error ? error.message : "履歴を取得できませんでした");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function downloadExport(body: Record<string, unknown>): Promise<{ excludedInternalBlock: number }> {
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
    return { excludedInternalBlock: Number(response.headers.get("X-Soil-List-Excluded-Internal-Block") ?? 0) };
  }

  async function executeExport() {
    if (count === null) return;
    setExportConfirm(null);
    const label = exportFormatLabel(exportFormat);
    setBusy(true);
    setExportBusy({ count, format: label });
    setMessage("");
    try {
      const result = await downloadExport({ condition, columns: selectedColumns, sortKey, format: exportFormat });
      await loadSaved();
      setMessage(`${count.toLocaleString("ja-JP")} 件を ${label} で書き出しました${result.excludedInternalBlock > 0 ? `（自社アポ禁 ${result.excludedInternalBlock.toLocaleString("ja-JP")} 件を除きました）` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "書き出しできませんでした");
    } finally {
      setExportBusy(null);
      setBusy(false);
    }
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
      setExportConfirm({ count, minutes: Math.ceil(count / EXPORT_SPEED_ROWS_PER_MINUTE) });
      return;
    }
    await executeExport();
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
    setRawUploadPreview(null);
    if (!next) {
      setUploadFile(null);
      return;
    }
    const extension = fileExtension(next.name);
    const allowed = uploadMode === "raw" ? [".csv", ".xlsx", ".xls"] : [".csv", ".xlsx", ".mer"];
    if (!allowed.includes(extension)) {
      setUploadFile(null);
      setUploadMessage(uploadMode === "raw" ? "CSV・Excel のファイルを選んでください" : "CSV・Excel・.mer のファイルを選んでください");
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
      if (uploadMode === "raw") {
        form.append("files", next);
        const response = await fetch("/api/soil/list/uploads/raw/preview", { method: "POST", body: form });
        const data = await readJson<{ ok: boolean; preview: RawUploadPreview }>(response);
        setRawUploadPreview(data.preview);
      } else {
        form.set("file", next);
        const response = await fetch("/api/soil/list/uploads/preview", { method: "POST", body: form });
        const data = await readJson<{ ok: boolean; preview: UploadPreview }>(response);
        setUploadPreview(data.preview);
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "取り込めませんでした（ファイルを読み取れませんでした）");
    } finally {
      setUploadBusy(null);
    }
  }

  async function handleRawDownload() {
    if (!uploadFile) return;
    setUploadBusy("download");
    setUploadMessage("");
    try {
      const form = new FormData();
      form.append("files", uploadFile);
      form.set("action", "download");
      const response = await fetch("/api/soil/list/uploads/raw/preview", { method: "POST", body: form });
      if (!response.ok) {
        const data = await readJson<{ error?: string }>(response);
        throw new Error(data.error ?? "取込ファイルを作れませんでした");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "統合インポート_光回線＋クレカ.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "取込ファイルを作れませんでした");
    } finally {
      setUploadBusy(null);
    }
  }

  async function handleRawImport() {
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
      form.append("files", uploadFile);
      form.set("action", "import");
      form.set("purchaseVendor", vendor);
      const response = await fetch("/api/soil/list/uploads/raw/preview", { method: "POST", body: form });
      const data = await readJson<{ ok: boolean; result?: UploadResult; error?: string }>(response);
      setUploadResult(data.result ?? null);
      await loadUploadHistory();
      setUploadMessage(data.ok ? (data.result?.warning ?? "") : (data.error ?? "取り込めませんでした"));
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "取り込めませんでした");
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
  const axisSegments = useMemo(() => {
    if (!analysis) return [];
    if (analysisAxis === "line_type") return analysis.blocks.lineType.segments;
    if (analysisAxis === "contract_year") return analysis.blocks.contractYear.segments;
    return analysis.blocks.vendor.segments;
  }, [analysis, analysisAxis]);
  const vendorSegments = useMemo(
    () => {
      if (analysisVendorFilter.length >= 2) return vendorAndSegments ?? [];
      if (analysisAxis !== "vendor") return axisSegments;
      return filterVendorSegments(axisSegments, analysisVendorFilter);
    },
    [analysisAxis, analysisVendorFilter, axisSegments, vendorAndSegments],
  );
  const vendorFilterGroups = useMemo<MultiSelectOptionGroup[]>(() => {
    const optionsForFilter = (analysis?.blocks.vendor.segments ?? [])
      .filter((segment) => segment.segment !== "合計")
      .map<SoilListOptionItem>((segment) => ({
        value: segment.segment,
        label: segment.segment,
        count: segment.rowCount,
        empty: false,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja-JP"));
    return [{ options: optionsForFilter }];
  }, [analysis]);

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleAnalysisSortChange(block: AnalysisBlockKey, key: AnalysisSortKey) {
    setAnalysisSorts((current) => {
      const currentSort = current[block];
      const direction: ListSearchSortDirection = currentSort?.key === key && currentSort.direction === "asc" ? "desc" : "asc";
      return { ...current, [block]: { key, direction } };
    });
  }

  function analysisSegmentLabel(block: AnalysisBlockKey, segment: AnalysisSegment): string {
    if (block === "vendor" && segment.segment === "合計" && analysisVendorFilter.length >= 2) {
      return `${analysisVendorFilter.join(" かつ ")}：${formatCount(segment.rowCount)} 件`;
    }
    if (block === "vendor" && segment.segment === "合計" && analysisVendorFilter.length > 0 && analysisAxis === "vendor") {
      return `合計（選んだ ${analysisVendorFilter.length.toLocaleString("ja-JP")} つ）`;
    }
    return segment.segment;
  }

  function analysisAxisLabel(axis: AnalysisAxis): string {
    if (axis === "line_type") return "元回線";
    if (axis === "contract_year") return "契約時期（年）";
    return "購入先";
  }

  function analysisAxisHelp(axis: AnalysisAxis): { title: string; rows: readonly HelpRow[] } {
    if (axis === "line_type") {
      return {
        title: "① 元回線 の数え方",
        rows: [
          { label: "区切り", text: "電話番号台帳の「元回線」。空欄は「（元回線なし）」" },
          { label: "購入先で絞る", text: "2 つ以上選ぶと、選んだ購入先すべてに購入履歴がある番号だけを数えます" },
          { label: "受注率", text: "受注顧客数 ÷ 有効（件数 − 無効）。受注案件数は別列で並べます" },
        ],
      };
    }
    if (axis === "contract_year") {
      return {
        title: "① 契約時期（年） の数え方",
        rows: [
          { label: "区切り", text: "電話番号台帳の「契約時期」の年。空欄は「（契約時期なし）」" },
          { label: "購入先で絞る", text: "2 つ以上選ぶと、選んだ購入先すべてに購入履歴がある番号だけを数えます" },
          { label: "受注率", text: "受注顧客数 ÷ 有効（件数 − 無効）。受注案件数は別列で並べます" },
        ],
      };
    }
    return ANALYSIS_HELP.vendor;
  }

  function renderAnalysisBlock(
    title: string,
    block: AnalysisBlockKey,
    segments: AnalysisSegment[],
    selectedSegment: string,
    onSelectSegment: (segment: string) => void,
    controls?: ReactNode,
    help?: { title: string; rows: readonly HelpRow[] },
    emptyText = "対象データがありません",
  ) {
    const sort = analysisSorts[block];
    const detailBlock: AnalysisBlockKey = block === "vendor" ? analysisAxis : block;
    const selected = segments.find((segment) => segment.segment === selectedSegment) ?? segments[0];
    const showAll = showAllSegments[block];
    const sortedSegments = sortAnalysisSegments(segments, sort);
    const hasLimitedRows = block === "vendor" && analysisVendorFilter.length > 0 ? false : segments.length > ANALYSIS_ROW_LIMIT;
    const visibleSegments = showAll || !hasLimitedRows ? sortedSegments : sortedSegments.slice(0, ANALYSIS_ROW_LIMIT);
    const segmentColumnLabel = block === "vendor" ? analysisAxisLabel(analysisAxis) : block === "contract" ? "既契約情報" : "リスト名";
    const tableColumns = ANALYSIS_TABLE_COLUMNS.map((column) => (column.key === "segment" ? { ...column, label: segmentColumnLabel } : column));
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
        legend: { display: false },
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
        if (selected && result) void openAnalysisDetail(detailBlock, selected.segment, result);
      },
    };

    return (
      <section className={styles.analysisBlock}>
        <div className={styles.analysisBlockHeader}>
          <h3>{title}{help && <HelpTip help={help} />}</h3>
          {block === "vendor" ? (
            <div className={styles.analysisHeaderControls}>
              <div className={styles.analysisAxisControls} aria-label="切り口">
                <span>切り口</span>
                {([
                  ["vendor", "購入先"],
                  ["line_type", "元回線"],
                  ["contract_year", "契約時期（年）"],
                ] as const).map(([axis, label]) => (
                  <label key={axis}>
                    <input
                      type="radio"
                      name="analysis-axis"
                      value={axis}
                      checked={analysisAxis === axis}
                      onChange={() => {
                        setAnalysisAxis(axis);
                        setAnalysisSelections((current) => ({ ...current, vendor: "合計" }));
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <MultiSelectFilter
                label="購入先で絞る"
                value={analysisVendorFilter}
                groups={vendorFilterGroups}
                onChange={setAnalysisVendorFilter}
                searchable
                initialLimit={100}
              />
              <small className={styles.analysisFilterNote}>2 つ以上選ぶと、選んだ購入先すべてに購入履歴がある番号だけを数えます（かつ）</small>
            </div>
          ) : controls}
        </div>
        {block === "vendor" && vendorAndBusy ? (
          <div className={styles.loading}><span />読み込んでいます</div>
        ) : segments.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <>
            <div className={styles.analysisGrid}>
              <div className={styles.chartPane}>
                <div className={styles.chartCanvas}>
                  <Doughnut data={chartData} options={chartOptions} />
                </div>
                <div className={styles.analysisLegend}>
                  {(selected?.results ?? []).map((item) => (
                    <button
                      key={item.result}
                      type="button"
                      className={styles.analysisLegendButton}
                      aria-label={`${item.result} ${formatCount(item.rowCount)} 件`}
                      onClick={() => void openAnalysisDetail(detailBlock, selected.segment, item.result)}
                    >
                      <span className={styles.analysisLegendDot} style={{ background: resultColor(item.result) }} />
                      <span className={styles.analysisLegendName}>{item.result}</span>
                      <span className={styles.analysisLegendCount}>{formatCount(item.rowCount)} 件</span>
                    </button>
                  ))}
                  {selected && (
                    <div className={styles.analysisOrderSummary}>
                      <span className={styles.analysisLegendName}>うち受注顧客 {formatCount(selected.orderCount)} 人・受注案件 {formatCount(selected.orderCaseCount ?? 0)} 件</span>
                      <span className={styles.analysisLegendCount} />
                      <small> Kintone の受注履歴から数えた数。コール結果とは別の数え方です。</small>
                    </div>
                  )}
                </div>
              </div>
              <div className={`${styles.tableWrap} ${styles.analysisTableWrap}`}>
                <table className={styles.analysisTable}>
                  <thead>
                    <tr>
                      {tableColumns.map((column) => (
                        <th key={column.key}>
                          <button type="button" className={styles.sortHeaderButton} onClick={() => handleAnalysisSortChange(block, column.key)}>
                            <span className={styles.analysisHeaderLabel}>
                              <span>
                                {column.label}
                                {sort?.key === column.key && (
                                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                                    {sort.direction === "asc" ? <path d="M6 2 2 8h8z" /> : <path d="M6 10 2 4h8z" />}
                                  </svg>
                                )}
                              </span>
                              {column.sub && <span>{column.sub}</span>}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSegments.map((segment) => (
                      <tr
                        key={segment.segment}
                        className={segment.segment === selected.segment ? styles.analysisSelectedRow : undefined}
                        onClick={() => onSelectSegment(segment.segment)}
                      >
                        <td>
                          <span className={styles.analysisSegmentName} title={analysisSegmentLabel(block, segment)}>
                            {analysisSegmentLabel(block, segment)}
                          </span>
                        </td>
                        <td>{formatCount(segment.rowCount)}</td>
                        <td>{formatCount(segment.calledCount)}</td>
                        <td>{formatCount(segment.callTotal)}</td>
                        <td>{formatRotation(segment.rotation)}</td>
                        <td>{formatCount(segment.validCount)}</td>
                        <td className={valueClassName(segment.orderCount)}>{formatCount(segment.orderCount)}</td>
                        <td className={valueClassName(segment.orderCaseCount ?? 0)}>{formatCount(segment.orderCaseCount ?? 0)}</td>
                        <td className={valueClassName(segment.acquiredCount)}>{formatCount(segment.acquiredCount)}</td>
                        <td>{formatRate(segment.orderRateValid)}</td>
                        <td>{formatRate(segment.orderRateTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasLimitedRows && (
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
                  <th>受注顧客数</th>
                  <th>受注案件数</th>
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
                  <td className={valueClassName(row.orderCaseCount ?? 0)}>{formatCount(row.orderCaseCount ?? 0)}</td>
                  <td className={valueClassName(row.acquiredCount)}>{formatCount(row.acquiredCount)}</td>
                  <td>{row.lastCalledOn ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9}>対象データがありません</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  const visibleHistoryRows = historyRows.filter((row) => historyTypes.includes(row.type));

  return (
    <div className={styles.pageShell}>
      <div className={styles.header}>
        <SystemBreadcrumb items={[{ label: "リストマスタ" }]} />
        <h1>リストマスタ</h1>
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
        onDelete={(id) => {
          const target = savedConditions.find((item) => item.id === id) ?? null;
          setConditionDeleteTarget(target);
        }}
      />
      <ConfirmActionModal
        open={conditionDeleteTarget !== null}
        title="条件を削除する"
        busy={busy}
        confirmLabel="削除する"
        onClose={() => setConditionDeleteTarget(null)}
        onConfirm={() => conditionDeleteTarget && void handleDeleteCondition(conditionDeleteTarget.id)}
      >
        <p className={styles.conditionSummary}>{conditionDeleteTarget?.name ?? ""} を削除します。</p>
      </ConfirmActionModal>
      <ConfirmActionModal
        open={exportConfirm !== null}
        title="書き出しを始める"
        busy={busy}
        confirmLabel="書き出す"
        onClose={() => setExportConfirm(null)}
        onConfirm={() => void executeExport()}
      >
        <p className={styles.conditionSummary}>
          約 {exportConfirm?.count.toLocaleString("ja-JP")} 件を書き出します。目安は {exportConfirm?.minutes.toLocaleString("ja-JP")} 分です。
        </p>
      </ConfirmActionModal>
      <InternalBlockReleaseModal
        row={internalBlockReleaseTarget}
        reason={internalBlockReleaseReason}
        busy={internalBlockBusy}
        error={internalBlockReleaseError}
        onReasonChange={setInternalBlockReleaseReason}
        onClose={closeInternalBlockRelease}
        onSubmit={() => void handleInternalBlockRelease()}
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
              <MultiSelectFilter label="元回線" value={filters.lineType} groups={buildOptionGroups("lineType", options.lineType)} onChange={(value) => setFilter("lineType", value)} />
              <MultiSelectFilter label="区分" value={filters.category} groups={buildOptionGroups("category", options.category)} onChange={(value) => setFilter("category", value)} />
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
                  {SOIL_LIST_FILTER_DEFINITIONS.find((definition) => definition.key === "purchaseHistoryExists")?.options?.map((option) => (
                    <option key={option} value={option}>
                      {option || "指定なし"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                自社アポ禁
                <select value={filters.internalBlock} onChange={(event) => setFilter("internalBlock", event.target.value)}>
                  {SOIL_LIST_FILTER_DEFINITIONS.find((definition) => definition.key === "internalBlocked")?.options?.map((option) => (
                    <option key={option} value={option}>
                      {option || "指定なし"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                経過（年）
                <span className={styles.range}>
                  <input type="number" min="0" value={filters.elapsedYearsFrom} onChange={(event) => setFilter("elapsedYearsFrom", event.target.value)} aria-label="年以上" placeholder="年以上" />
                  <input type="number" min="0" value={filters.elapsedYearsTo} onChange={(event) => setFilter("elapsedYearsTo", event.target.value)} aria-label="年以下" placeholder="年以下" />
                </span>
              </label>
              {/* 「検索」は購入履歴の右隣の枠（購入履歴と同じ幅・下ぞろえ）。購入履歴の枠に同居させると購入履歴が細くなる */}
              <div className={styles.searchCell}>
                <button type="submit" disabled={busy}>
                  検索
                </button>
              </div>
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
        <div className={`${styles.tableWrap} ${styles.resultsTableWrap}`}>
          <table>
            <thead>
              <tr>
                {SEARCH_TABLE_COLUMNS.map((column) => (
                  <th key={column.key}>
                    {column.sortable === false ? (
                      <span className={styles.staticHeaderLabel}>{column.label}</span>
                    ) : (
                      <button type="button" className={styles.sortHeaderButton} onClick={() => void handleSortChange(column.key as SortableListSearchKey)}>
                        {column.label}
                        {listSort?.key === column.key && (
                          <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                            {listSort.direction === "asc" ? <path d="M6 2 2 8h8z" /> : <path d="M6 10 2 4h8z" />}
                          </svg>
                        )}
                      </button>
                      )}
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
                  <td>{row.lineType}</td>
                  <td>{row.contractMonth}</td>
                  <td>{row.contractElapsed}</td>
                  <td>
                    <select
                      className={styles.inlineSelect}
                      value={row.category}
                      onChange={(event) => void handleCategoryChange(index, row.phoneNumberKey, event.target.value)}
                      disabled={categoryBusyPhone === row.phoneNumberKey}
                      aria-label="区分"
                    >
                      <option value="">（空欄）</option>
                      <option value="個人">個人</option>
                      <option value="屋号">屋号</option>
                      <option value="法人">法人</option>
                    </select>
                  </td>
                  <td>{row.internalBlocked && <span className={styles.internalBlockBadge}>自社アポ禁</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="export-heading">
        <h2 id="export-heading">書き出し</h2>
        {/* 左＝列のチェック（詰めて並べる）、右＝形式と書き出しボタン（データ出所の右側）。東海林さん 2026-09-13 */}
        <div className={styles.exportLayout}>
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
        <div className={`${styles.actions} ${styles.exportActions}`}>
          <label>
            形式
            <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ExportFormat)}>
              {EXPORT_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={handleExport} disabled={busy || count === null || excelOverLimit}>
            {count === null ? "検索後に書き出す" : `${count.toLocaleString("ja-JP")} 件を書き出す`}
          </button>
        </div>
        </div>
        {/* 並びはリスト投入日が古い順で固定（東海林さん 2026-09-13：書き出しで並びは選ばない）。上限の注意は Excel を選んで超えているときだけ赤字 */}
        {excelOverLimit && (
          <p className={styles.errorLine}>Excel は 1,048,576 行までです（Excel の上限）。この件数は超えているので、CSV か .mer を選んでください</p>
        )}
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
              accept={uploadMode === "raw" ? ".csv,.xlsx,.xls" : ".csv,.xlsx,.mer"}
              onChange={(event) => void previewFile(event.target.files?.[0] ?? null)}
            />
            <div className={styles.uploadChoiceBox}>
              <label>
                <input
                  type="radio"
                  checked={uploadMode === "raw"}
                  onChange={() => { setUploadMode("raw"); void previewFile(null); }}
                />
                営業の元 Excel（光回線／クレカ）
              </label>
              <label>
                <input
                  type="radio"
                  checked={uploadMode === "import"}
                  onChange={() => { setUploadMode("import"); void previewFile(null); }}
                />
                取込ファイル（8 列／10 列／19 列）
              </label>
              <div className={styles.templateActions}>
                <a href="/api/soil/list/uploads/template?kind=hikari">光回線（8 列）をダウンロード</a>
                <a href="/api/soil/list/uploads/template?kind=kureka">クレカ（19 列）をダウンロード</a>
              </div>
            </div>
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
              aria-label={uploadMode === "raw" ? "営業の元 Excel をアップロード" : "リストの取込ファイルをアップロード"}
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
                    <span>{uploadMode === "raw" ? "ここに営業の元 Excel をドラッグ＆ドロップ（CSV／Excel）" : "ここに取込ファイルをドラッグ＆ドロップ（CSV／Excel／.mer）"}</span>
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

          {rawUploadPreview && (
            <section className={styles.panel} aria-labelledby="upload-step-2">
              <div className={styles.stepHeading}>
                <span><small>STEP</small><strong>2</strong></span>
                <h2 id="upload-step-2">チェック結果</h2>
              </div>
              <p className={styles.result}>
                読み込んだ行 {rawUploadPreview.summary.readRows.toLocaleString("ja-JP")} ／ 取込ファイルに出す行 {rawUploadPreview.summary.importRows.toLocaleString("ja-JP")} ／ 除外 {rawUploadPreview.summary.excludedRows.toLocaleString("ja-JP")} ／ 要確認 {rawUploadPreview.summary.needsReviewRows.toLocaleString("ja-JP")}
              </p>
              <div className={styles.summaryList}>
                {rawUploadPreview.listNames.slice(0, 8).map((item) => (
                  <span key={item.name}>{item.name} {item.count.toLocaleString("ja-JP")} 行（除外 {item.excluded.toLocaleString("ja-JP")}・要確認 {item.needsReview.toLocaleString("ja-JP")}）</span>
                ))}
              </div>
              {rawUploadPreview.needsReview.length > 0 && (
                <div className={styles.tableWrap}>
                  <table>
                    <thead><tr><th>行</th><th>リスト名</th><th>氏名</th><th>電話番号</th><th>指摘</th></tr></thead>
                    <tbody>
                      {rawUploadPreview.needsReview.map((row) => (
                        <tr key={`${row.rowNumber}-${row.phone}`}><td>{row.rowNumber}</td><td>{row.listName ?? ""}</td><td>{row.name}</td><td>{row.phone}</td><td>{row.reasons.join("／")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className={styles.warningLine}>
                除外：過去に配った番号 {rawUploadPreview.summary.excludedAssignment.toLocaleString("ja-JP")} 件／案件あり {rawUploadPreview.summary.excludedOrder.toLocaleString("ja-JP")} 件
              </p>
              <div className={styles.actions}>
                <button type="button" onClick={handleRawDownload} disabled={uploadBusy !== null}>
                  {uploadBusy === "download" ? "作っています…" : "取込ファイルをダウンロード（19 列）"}
                </button>
                <button type="button" onClick={handleRawImport} disabled={uploadBusy !== null || !purchaseVendor || (purchaseVendor === "__other__" && !purchaseVendorOther.trim())}>
                  {uploadBusy === "import" ? "登録しています…" : "Garden に登録する"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => void previewFile(null)} disabled={uploadBusy !== null}>やり直す</button>
              </div>
            </section>
          )}

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
              <div className={styles.summaryList}>
                {uploadPreview.lineTypes.length === 0 ? (
                  <span>元回線：該当なし</span>
                ) : uploadPreview.lineTypes.map((item) => (
                  <span key={item.value}>元回線：{item.value} {item.count.toLocaleString("ja-JP")} 件</span>
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
              <p>{derivedResultLine(uploadResult)}</p>
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
                vendorSegments,
                analysisSelections.vendor,
                (segment) => setAnalysisSelections((current) => ({ ...current, vendor: segment })),
                undefined,
                analysisAxisHelp(analysisAxis),
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
                <p>有効＝件数 − 最終コール結果が「無効」の番号数。受注顧客数＝受注件数が 1 以上の番号数。受注案件数＝受注履歴の案件数。獲得（コール）＝最終コール結果が「獲得」の番号数。</p>
                <p>受注率は受注顧客数で計算しています。獲得（コール）は件数だけ並べています。</p>
              </details>
            </div>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className={styles.panel} aria-labelledby="history-heading">
          <h2 id="history-heading">履歴検索</h2>
          <form className={styles.actions} onSubmit={handleHistorySearch}>
            <label>
              電話番号
              <input value={historyPhone} onChange={(event) => setHistoryPhone(event.target.value)} placeholder="0285720215" />
            </label>
            <button type="submit" disabled={historyBusy}>{historyBusy ? "検索しています…" : "検索"}</button>
          </form>
          {historyMessage && <p className={styles.message}>{historyMessage}</p>}
          {historyCurrent && (
            <div className={styles.historyCurrent}>
              <h3>今の値（電話番号台帳）</h3>
              <p>
                {historyCurrent.name || "氏名なし"} ｜ {historyCurrent.address || "住所なし"} ｜ リスト名 {historyCurrent.listName || "（空欄）"} ｜ 元回線 {historyCurrent.lineType || "（空欄）"}
              </p>
              <p>
                AU光架電可否 {historyCurrent.auCallAvailability || "（空欄）"} ｜ アポ禁 {historyCurrent.appointmentBlocked || "（空欄）"} ｜ 自社アポ禁 {historyCurrent.internalBlocked ? "あり" : "なし"} ｜ 購入状態 {historyCurrent.purchaseStatus || "（空欄）"} ｜ コール回数 {historyCurrent.callCount} ｜ 最終結果 {historyCurrent.lastCallResult || "（結果なし）"}
              </p>
            </div>
          )}
          {historyRows.length > 0 && (
            <>
              <div className={styles.historyTypeFilters}>
                {[...new Set(historyRows.map((row) => row.type))].map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={historyTypes.includes(type)}
                      onChange={(event) =>
                        setHistoryTypes((current) => event.target.checked ? [...current, type] : current.filter((item) => item !== type))
                      }
                    />
                    {type}
                  </label>
                ))}
              </div>
              <div className={styles.historyList}>
                {visibleHistoryRows.map((row, index) => (
                  <div className={styles.historyItem} data-kind={row.type} key={`${row.type}-${row.occurred_on}-${index}`}>
                    <span>{row.occurred_on ? formatJstWithWeekday(row.occurred_on) : "日付なし"}</span>
                    <strong>{row.type}</strong>
                    <p>{row.title}{row.detail ? ` ｜ ${row.detail}` : ""}</p>
                  </div>
                ))}
              </div>
              {historyOmitted && <p className={styles.empty}>古い分は省略しました</p>}
            </>
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
          <section className={styles.internalBlockPanel} aria-labelledby="internal-block-heading">
            <h3 id="internal-block-heading">自社アポ禁</h3>
            <p className={styles.empty}>ヒュアラン社内だけの架電禁止。購入元のアポ禁とは別です</p>
            <div className={styles.internalBlockForm}>
              <label>
                電話番号
                <input value={internalBlockPhone} onChange={(event) => setInternalBlockPhone(event.target.value)} />
              </label>
              <label>
                理由
                <input value={internalBlockReason} onChange={(event) => setInternalBlockReason(event.target.value)} />
              </label>
              <button type="button" onClick={handleInternalBlockRegister} disabled={internalBlockBusy || !internalBlockPhone.trim() || !internalBlockReason.trim()}>
                登録
              </button>
            </div>
            <input
              ref={internalBlockFileRef}
              className={styles.hiddenFileInput}
              type="file"
              accept=".csv,.xlsx,.mer"
              onChange={(event) => void previewInternalBlockFile(event.target.files?.[0] ?? null)}
            />
            <div className={styles.internalBlockFileRow}>
              <button type="button" className={styles.secondaryButton} onClick={() => internalBlockFileRef.current?.click()} disabled={internalBlockBusy}>
                CSV／Excel を選ぶ
              </button>
              <span>列＝電話番号・理由（1 行目は見出し）</span>
              {internalBlockFile && <strong>{internalBlockFile.name}</strong>}
            </div>
            {internalBlockPreview && (
              <div className={styles.summaryList}>
                <span>中身の確認：{internalBlockPreview.rowCount.toLocaleString("ja-JP")} 件</span>
                <span>重複 {internalBlockPreview.duplicateRows.toLocaleString("ja-JP")}</span>
                <span>すでに登録済み {internalBlockPreview.alreadyBlockedRows.toLocaleString("ja-JP")}</span>
                <span>番号の形が違う {internalBlockPreview.invalidPhoneRows.toLocaleString("ja-JP")}</span>
                <span>理由なし {internalBlockPreview.missingReasonRows.toLocaleString("ja-JP")}</span>
                <button type="button" onClick={handleInternalBlockBulk} disabled={internalBlockBusy || internalBlockPreview.validRows === 0}>
                  登録する
                </button>
              </div>
            )}
            <div className={styles.internalBlockListHeader}>
              <label>
                番号で探す
                <input value={internalBlockQuery} onChange={(event) => setInternalBlockQuery(event.target.value)} />
              </label>
              <button type="button" className={styles.secondaryButton} onClick={() => void loadInternalBlocks()} disabled={internalBlockBusy}>
                検索
              </button>
              <label>
                <input type="checkbox" checked={internalBlockIncludeReleased} onChange={(event) => setInternalBlockIncludeReleased(event.target.checked)} />
                解除済みも見る
              </label>
            </div>
            {internalBlockMessage && <p className={styles.message}>{internalBlockMessage}</p>}
            <div className={`${styles.tableWrap} ${styles.guideTableWrap}`}>
              <table className={styles.internalBlockTable}>
                <thead>
                  <tr>
                    <th>電話番号</th>
                    <th>登録日</th>
                    <th>理由</th>
                    <th>登録者</th>
                    <th>出所</th>
                    <th>解除</th>
                  </tr>
                </thead>
                <tbody>
                  {internalBlockRows.length === 0 && (
                    <tr><td colSpan={6} className={styles.empty}>登録済み一覧はありません</td></tr>
                  )}
                  {internalBlockRows.map((row) => (
                    <tr key={row.id} className={row.解除日 ? styles.releasedRow : undefined}>
                      <td>{row.電話番号}</td>
                      <td>{formatJstWithWeekday(row.登録日)}</td>
                      <td>{row.理由}</td>
                      <td>{row.登録者 ?? ""}</td>
                      <td>{row.出所}</td>
                      <td>
                        {row.解除日 ? `${formatJstWithWeekday(row.解除日)} ${row.解除者 ?? ""}` : (
                          <button type="button" className={styles.secondaryButton} onClick={() => openInternalBlockRelease(row)} disabled={internalBlockBusy}>
                            解除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
