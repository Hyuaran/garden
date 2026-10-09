import { getAllRecords, getFormFields, getRecords, updateRecord, type KintoneRecord } from "@/lib/kintone/records";

import { effectivePaymentDate, monthFromDate } from "./business-day";
import type { PlPaymentRecord } from "./types";

const PL_FIELDS = [
  "$id",
  "$revision",
  "カテゴリー",
  "ドロップダウン_1",
  "ドロップダウン_5",
  "ドロップダウン_2",
  "ドロップダウン_6",
  "ドロップダウン_4",
  "ドロップダウン_0",
  "数値_9",
  "数値_1",
  "日付_5",
  "日付_0",
  "リンク",
] as const;

export type PlKintoneConfig = {
  subdomain: string;
  appId: string;
  token: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
}

export function getPlKintoneConfig(): PlKintoneConfig {
  return {
    subdomain: env("KINTONE_SUBDOMAIN"),
    appId: env("KINTONE_PL_CENTERRISE_APP_ID"),
    token: env("KINTONE_PL_CENTERRISE_TOKEN"),
  };
}

function field(record: KintoneRecord, code: string): unknown {
  const raw = record[code];
  if (raw && typeof raw === "object" && "value" in raw) return (raw as { value?: unknown }).value;
  return raw;
}

function text(record: KintoneRecord, code: string): string {
  const value = field(record, code);
  return value == null ? "" : String(value);
}

function textArray(record: KintoneRecord, code: string): string[] {
  const value = field(record, code);
  return Array.isArray(value) ? value.map(String) : value == null || value === "" ? [] : [String(value)];
}

function numberValue(record: KintoneRecord, code: string): number {
  const value = field(record, code);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function plRecordUrl(recordId: string, config = getPlKintoneConfig()): string {
  return `https://${config.subdomain}.cybozu.com/k/${config.appId}/show#record=${recordId}`;
}

export function mapPlRecord(record: KintoneRecord, config = getPlKintoneConfig()): PlPaymentRecord {
  const id = text(record, "$id");
  return {
    id,
    revision: text(record, "$revision"),
    category: textArray(record, "カテゴリー"),
    status: text(record, "ドロップダウン_1"),
    kind: text(record, "ドロップダウン_5"),
    vendor: text(record, "ドロップダウン_2"),
    taskName: text(record, "ドロップダウン_6"),
    mfCompany: text(record, "ドロップダウン_4"),
    owner: text(record, "ドロップダウン_0"),
    amount: numberValue(record, "数値_9"),
    fee: text(record, "数値_1"),
    dueDate: text(record, "日付_5"),
    periodDate: text(record, "日付_0"),
    driveUrl: text(record, "リンク"),
    recordUrl: plRecordUrl(id, config),
  };
}

export async function fetchWaitingPlRecords(config = getPlKintoneConfig()): Promise<PlPaymentRecord[]> {
  const conditions = [
    'カテゴリー in ("支払待ち") and ドロップダウン_1 in ("支払待ち")',
    'カテゴリー in ("入金待ち") and ドロップダウン_1 in ("入金待ち")',
  ];
  const pages = await Promise.all(
    conditions.map((condition) => getAllRecords(config.appId, config.token, condition, PL_FIELDS)),
  );
  return pages.flat().map((record) => mapPlRecord(record, config));
}

export async function updatePlDriveUrl(recordId: string, driveUrl: string, config = getPlKintoneConfig()): Promise<void> {
  await updateRecord(config.appId, config.token, recordId, { リンク: { value: driveUrl } });
}

export async function updatePlTransferId(recordId: string, transferId: string, config = getPlKintoneConfig()): Promise<boolean> {
  const fields = await getFormFields(config.appId, config.token);
  const transferField = fields.find((fieldDef) => fieldDef.label === "振込ID" && fieldDef.type === "SINGLE_LINE_TEXT");
  if (!transferField) return false;
  await updateRecord(config.appId, config.token, recordId, { [transferField.code]: { value: transferId } });
  return true;
}

export async function fetchExecuteStatus(executeId: string): Promise<string> {
  const appId = env("KINTONE_TRANSFER_EXECUTE_APP_ID");
  const token = env("KINTONE_TRANSFER_EXECUTE_TOKEN");
  const records = await getRecords(appId, token, `$id = ${executeId} limit 1`, ["ドロップダウン_6"]);
  return records.length ? text(records[0], "ドロップダウン_6") : "";
}

export function taskSnapshot(record: PlPaymentRecord) {
  const baseDate = record.dueDate || record.periodDate;
  const dueDate = record.dueDate || "";
  return {
    pl_record_id: record.id,
    pl_revision: record.revision,
    category: record.category.join(","),
    status: record.status,
    vendor: record.vendor,
    mf_company: record.mfCompany,
    amount: record.amount,
    due_date: dueDate || null,
    effective_due_date: dueDate ? effectivePaymentDate(dueDate) : null,
    period_month: record.periodDate ? monthFromDate(record.periodDate) : baseDate ? monthFromDate(baseDate) : null,
    drive_url: record.driveUrl || null,
  };
}

export { field as kintoneField, text as kintoneText };
