import { getAllRecords, getRecords, type KintoneRecord } from "@/lib/kintone/records";

export type LpScopeBusiness = {
  bizCode: string;
  bizName: string;
  customerApp: number;
  circuitIds: number[];
  recordOrder: number;
};

export type LpCustomerApp = 226 | 235 | 251;

export type LpCustomerRecord = {
  id: string;
  createdAt: string | null;
  status: string | null;
  assignee: string | null;
  source: unknown;
  slot: unknown;
  phones: Record<string, unknown>;
};

const LP_BIZ_MASTER_APP_ID = Number(process.env.KINTONE_LP_BIZ_MASTER_APP_ID || 239);
const CUSTOMER_APP_CONFIG: Record<number, { tokenEnv: string; statusField: string }> = {
  226: { tokenEnv: "KINTONE_HIKARI_PRO_TOKEN", statusField: "対応状況" },
  235: { tokenEnv: "KINTONE_DENKI_START_TOKEN", statusField: "status" },
  251: { tokenEnv: "KINTONE_FLETS_TOKEN", statusField: "対応状況" },
};

// 回線 ID は 239 の子テーブル「回線番号」（コード lines・子 circuit_id）の中にある
const BIZ_FIELDS = ["$id", "biz_code", "biz_name", "customer_app", "lines"] as const;
const PHONE_FIELDS = ["phone", "電話番号_ハイフンなし", "携帯番号_ハイフンなし", "架電連絡先"] as const;

function value(record: KintoneRecord, field: string): unknown {
  const raw = record[field];
  return raw && typeof raw === "object" && "value" in raw ? (raw as { value: unknown }).value : raw;
}

function text(record: KintoneRecord, field: string): string | null {
  const raw = value(record, field);
  if (raw == null) return null;
  const normalized = String(raw).trim();
  return normalized || null;
}

function numberValue(record: KintoneRecord, field: string): number | null {
  const raw = text(record, field);
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function tableCircuitIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  for (const row of raw) {
    const rowValue = row && typeof row === "object" && "value" in row ? (row as { value: KintoneRecord }).value : null;
    const cell = rowValue ? numberValue(rowValue, "circuit_id") : null;
    if (cell != null) ids.push(cell);
  }
  return ids;
}

// 対応担当者の「-」・空は担当者未設定（§5.5.3）
function normalizeName(value: string | null | undefined) {
  const normalized = value?.replace(/[\s\u3000]+/g, "").trim() ?? "";
  return !normalized || normalized === "-" ? "担当者未設定" : normalized;
}

function jstDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function lpCustomerAppConfig(app: number) {
  return CUSTOMER_APP_CONFIG[app] ?? null;
}

export function lpCustomerAppTokenEnv(app: number) {
  return CUSTOMER_APP_CONFIG[app]?.tokenEnv ?? null;
}

export async function loadLpScope(): Promise<LpScopeBusiness[] | null> {
  const token = process.env.KINTONE_LP_BIZ_MASTER_TOKEN;
  if (!token) return null;
  const records = await getRecords(LP_BIZ_MASTER_APP_ID, token, 'status in ("稼働中") order by $id asc', BIZ_FIELDS);
  return records.map((record, index) => ({
    bizCode: text(record, "biz_code") ?? String(numberValue(record, "$id") ?? index + 1),
    bizName: text(record, "biz_name") ?? "事業名未設定",
    customerApp: numberValue(record, "customer_app") ?? 0,
    circuitIds: tableCircuitIds(value(record, "lines")),
    recordOrder: numberValue(record, "$id") ?? index + 1,
  }));
}

export async function loadLpCustomerRecords(app: number): Promise<LpCustomerRecord[] | null> {
  const config = CUSTOMER_APP_CONFIG[app];
  if (!config) return null;
  const token = process.env[config.tokenEnv];
  if (typeof token !== "string" || !token) return null;
  const apiToken: string = token;
  const fields = ["$id", "作成日時", config.statusField, "対応担当者", "source", "slot", ...PHONE_FIELDS] as const;
  async function read() {
    const rows = await getAllRecords(app, apiToken, "", fields);
    return rows.map((record) => ({
      id: text(record, "$id") ?? "",
      createdAt: text(record, "作成日時"),
      status: text(record, config.statusField),
      assignee: text(record, "対応担当者"),
      source: value(record, "source"),
      slot: value(record, "slot"),
      phones: Object.fromEntries(PHONE_FIELDS.map((field) => [field, value(record, field)])),
    }));
  }
  try {
    return await read();
  } catch {
    await delay(3000);
    try { return await read(); }
    catch { return null; }
  }
}

// 顧客アプリの「申込み」は、ヒカリのプロ・電気開始受付センターでは「前確OK」という名前に変わった（2026-10-20 確認）。フレッツは「申込み」のまま
export function isLpWonStatus(status: string | null | undefined) {
  return status === "申込み" || status === "前確OK";
}

export function countLpApplications(records: LpCustomerRecord[] | null, from: string, to: string) {
  if (!records) return null;
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!isLpWonStatus(record.status)) continue;
    const date = jstDate(record.createdAt);
    if (!date || date < from || date > to) continue;
    const assignee = normalizeName(record.assignee);
    counts.set(assignee, (counts.get(assignee) ?? 0) + 1);
  }
  return counts;
}

export function normalizeLpAssigneeName(value: string | null | undefined) {
  return normalizeName(value);
}

// 配信本文専用。流れ図とは独立して登録日（JST）で数える。
export type LpRegisteredCounts = {
  denominator: number;
  preconfirmNg?: number;
  preconfirmWaiting: number;
  applications: number;
  won: number;
  excluded: number;
};

export function countLpRegisteredRecords(records: LpCustomerRecord[] | null, from: string, to: string): LpRegisteredCounts | null {
  if (records === null) return null;
  const counts: LpRegisteredCounts = { denominator: 0, preconfirmNg: 0, preconfirmWaiting: 0, applications: 0, won: 0, excluded: 0 };
  for (const record of records) {
    const day = jstDate(record.createdAt);
    if (!day || day < from || day > to || record.status === "重複") continue;
    counts.denominator++;
    if (record.status === "前確NG") counts.preconfirmNg!++;
    if (record.status === "前確待ち") counts.preconfirmWaiting++;
    if (isLpWonStatus(record.status)) counts.applications++;
    if (["対象外（現アナ等）", "対象外（契約不可）", "対象外（連絡つかず）"].includes(record.status ?? "")) counts.excluded++;
  }
  counts.won = counts.preconfirmWaiting + counts.applications;
  return counts;
}

// 配信本文の受注は顧客一覧 app10 の受注日で数える。
// 事業に結びつかなかった受注（リスト名が WEB_〇〇 で〇〇が事業マスタの名前と違う）。本文の最後に知らせる
export const unmatchedLpOrders = new WeakMap<Map<string, number>, Map<string, number>>();

export async function loadLpCustomerOrderCounts(scope: LpScopeBusiness[], from: string, to: string): Promise<Map<string, number> | null> {
  const token = process.env.KINTONE_KANRI_CUSTOMER_TOKEN?.trim();
  if (!token) return null;
  try {
    const records = await getAllRecords(10, token,
      `B_リスト名 like "WEB_" and 受注日 >= "${from}" and 受注日 <= "${to}"`,
      ["$id", "B_リスト名", "受注日"]);
    const counts = new Map(scope.map(biz => [biz.bizCode, 0]));
    const unmatched = new Map<string, number>();
    for (const record of records) {
      const day = text(record, "受注日");
      const listName = text(record, "B_リスト名")?.trim() ?? "";
      if (!day || day < from || day > to || !listName.startsWith("WEB_")) continue;
      const biz = scope.find(b => listName === `WEB_${b.bizName}`);
      if (biz) counts.set(biz.bizCode, (counts.get(biz.bizCode) ?? 0) + 1);
      else unmatched.set(listName, (unmatched.get(listName) ?? 0) + 1);
    }
    unmatchedLpOrders.set(counts, unmatched);
    return counts;
  } catch {
    return null;
  }
}
