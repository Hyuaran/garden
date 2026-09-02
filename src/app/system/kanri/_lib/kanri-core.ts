import type { KintoneRecord } from "@/lib/kintone/records";

export type KanriMode = "daily" | "closing";
export type KanriSource = "kintone_customer" | "kanden_report" | "credit_card" | "roster";
export type KanriWarningCode = "staff_not_in_roster" | "source_empty" | "duplicate_record" | "source_failed";

export type KanriWarning = {
  code: KanriWarningCode;
  message: string;
  source?: KanriSource;
  sourceApp?: string;
  detail?: string;
};

export type KanriSourceSummary = {
  label: string;
  count: number;
  unit: string;
  apps?: Record<string, number>;
};

export type KanriSummary = Record<KanriSource, KanriSourceSummary> & {
  total: number;
};

export type KanriSourceRow = {
  source: KanriSource;
  sourceApp: string | null;
  recordId: string;
  payload: KintoneRecord;
};

export const SOURCE_LABELS: Record<KanriSource, string> = {
  kintone_customer: "光回線",
  kanden_report: "訪販",
  credit_card: "クレジットカード",
  roster: "従業員名簿",
};

export const SOURCE_DETAIL_LABELS: Record<KanriSource, string> = {
  kintone_customer: "顧客一覧",
  kanden_report: "関電件数報告",
  credit_card: "8アプリ",
  roster: "在籍者",
};

export const CUSTOMER_FIELDS = [
  "レコード番号", "更新日時", "顧客番号", "申込者名_姓名", "申込者名_姓名カナ", "商材名区分1", "商材名区分2",
  "商材ステータス", "商材詳細ステータス", "キャリアステータス", "実績可否", "受注日", "実績日", "ET日",
  "後確OK日", "開通予定日", "開通日", "入金日", "事業名", "部署名", "チーム名", "文字列__1行__46",
  "AP名", "前確者名", "付与件数", "トス付与件数", "AP付与件数",
] as const;

export const KANDEN_FIELDS = [
  "staff_name", "work_date", "report_time", "hp", "奪還_なっとくプラン_なっとく電気",
  "奪還_なっとくプラン_なっとく電気BIZ", "奪還_なっとく電気", "奪還_なっとく電気BIZ",
  "奪還_ビジネス電灯", "奪還_ビジネス動力_1", "奪還_eおとく", "囲込_なっとくプラン",
  "囲込_なっとくプラン_なっとく電気", "囲込_なっとくプラン_なっとく電気BIZ", "囲込_Eスマート",
  "囲込_Eおとく_なっとく_なっとくBIZ", "travel_allowance",
] as const;

export const CREDIT_FIELDS = [
  "レコード番号", "文字列__1行__3", "文字列__1行__6", "文字列__1行__36", "文字列__1行__14",
  "文字列__1行__18", "ドロップダウン_19", "ドロップダウン_12", "文字列__1行__70", "文字列__1行__80",
  "文字列__1行__79", "文字列__1行__62", "文字列__1行__44", "文字列__1行__78", "文字列__1行__20",
  "日付_11", "日付_4", "文字列__1行__26",
] as const;

export const ROSTER_FIELDS = [
  "レコード番号", "社員番号", "打刻ID", "従業員名_姓名", "従業員名_姓名カナ", "雇用形態", "チーム名",
  "従業員ステータス", "入社日", "退職日", "基準時給", "ドロップダウン_15",
] as const;

export function tokyoToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function monthRange(targetDate: string) {
  const [year, month] = targetDate.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const paddedMonth = String(month).padStart(2, "0");
  return {
    yearMonth: `${year}-${paddedMonth}`,
    start: `${year}-${paddedMonth}-01`,
    end: `${year}-${paddedMonth}-${String(endDay).padStart(2, "0")}`,
  };
}

export function isMonthEnd(targetDate: string) {
  return targetDate === monthRange(targetDate).end;
}

export function weekdayJa(targetDate: string) {
  const date = new Date(`${targetDate}T00:00:00+09:00`);
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

export function buildCustomerCondition(targetDate: string) {
  const { start, end } = monthRange(targetDate);
  return `実績日 >= "${start}" and 実績日 <= "${end}" and 事業名 = "自社" and 実績可否 in ("可")`;
}

export function buildKandenCondition(targetDate: string) {
  const { start, end } = monthRange(targetDate);
  return `report_time in ("最終") and work_date >= "${start}" and work_date <= "${end}"`;
}

export function buildCreditCondition(targetDate: string) {
  const { start, end } = monthRange(targetDate);
  return `文字列__1行__14 = "自社" and 日付_4 >= "${start}" and 日付_4 <= "${end}" and ドロップダウン_17 in ("OK")`;
}

export function buildRosterCondition(targetDate: string) {
  const { start, end } = monthRange(targetDate);
  return `従業員ステータス in ("在籍中") or (退職日 >= "${start}" and 退職日 <= "${end}")`;
}

export function fieldValue(record: KintoneRecord, field: string) {
  const value = record[field];
  if (value && typeof value === "object" && "value" in value) return (value as { value: unknown }).value;
  return value;
}

export function recordId(record: KintoneRecord) {
  const value = fieldValue(record, "レコード番号") ?? fieldValue(record, "$id");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function normalizeName(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function sourceEmptyWarning(source: KanriSource, sourceApp?: string): KanriWarning {
  const subject = sourceApp ? `${SOURCE_LABELS[source]}（${sourceApp}）` : `${SOURCE_LABELS[source]}（${SOURCE_DETAIL_LABELS[source]}）`;
  return {
    code: "source_empty",
    source,
    sourceApp,
    message: `${subject}が 0件でした`,
  };
}

export function sourceFailedWarning(source: KanriSource, sourceApp?: string): KanriWarning {
  const subject = sourceApp ? `${SOURCE_LABELS[source]}（${sourceApp}）` : SOURCE_LABELS[source];
  return {
    code: "source_failed",
    source,
    sourceApp,
    message: `${subject}を取得できませんでした。翌日に確認してください`,
  };
}

export function buildWarnings(rows: KanriSourceRow[], existing: KanriWarning[] = []) {
  const warnings = [...existing];
  const rosterNames = new Set(
    rows
      .filter((row) => row.source === "roster")
      .map((row) => normalizeName(fieldValue(row.payload, "従業員名_姓名")))
      .filter(Boolean),
  );
  const missingStaff = new Set<string>();
  rows.filter((row) => row.source === "kanden_report").forEach((row) => {
    const staff = String(fieldValue(row.payload, "staff_name") ?? "").trim();
    if (staff && !rosterNames.has(normalizeName(staff))) missingStaff.add(staff);
  });
  missingStaff.forEach((staff) => warnings.push({
    code: "staff_not_in_roster",
    source: "kanden_report",
    detail: staff,
    message: `訪販の担当者「${staff}」が従業員名簿にいません`,
  }));

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  rows.forEach((row) => {
    const key = `${row.source}:${row.sourceApp ?? ""}:${row.recordId}`;
    if (!row.recordId) return;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  });
  duplicates.forEach((key) => {
    const [source, sourceApp, id] = key.split(":") as [KanriSource, string, string];
    warnings.push({
      code: "duplicate_record",
      source,
      sourceApp: sourceApp || undefined,
      detail: id,
      message: `${SOURCE_LABELS[source]}に同じレコード番号が2回ありました（${id}）`,
    });
  });
  return warnings;
}

export function dedupeRows(rows: KanriSourceRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.source}:${row.sourceApp ?? ""}:${row.recordId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeRows(rows: KanriSourceRow[]): KanriSummary {
  const sourceRows = (source: KanriSource) => rows.filter((row) => row.source === source);
  const creditApps: Record<string, number> = {};
  sourceRows("credit_card").forEach((row) => {
    const app = row.sourceApp ?? "";
    creditApps[app] = (creditApps[app] ?? 0) + 1;
  });
  const summary = {
    kintone_customer: { label: "光回線（顧客一覧）", count: sourceRows("kintone_customer").length, unit: "件" },
    kanden_report: { label: "訪販（関電件数報告）", count: sourceRows("kanden_report").length, unit: "件" },
    credit_card: { label: "クレジットカード（8アプリ）", count: sourceRows("credit_card").length, unit: "件", apps: creditApps },
    roster: { label: "従業員名簿（在籍者）", count: sourceRows("roster").length, unit: "名" },
  };
  return { ...summary, total: Object.values(summary).reduce((sum, item) => sum + item.count, 0) };
}
