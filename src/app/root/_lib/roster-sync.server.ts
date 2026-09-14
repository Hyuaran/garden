import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getAllRecords, getFormFields, type KintoneRecord } from "@/lib/kintone/records";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRetiredByDate, shouldEmployeeBeActive, tokyoDateString } from "@/lib/auth/employee-access";
import type { GardenRole } from "../_constants/types";

export const ROSTER_SYNC_FIELDS = [
  "$id",
  "レコード番号",
  "社員番号",
  "APID",
  "新社員番号",
  "従業員名_姓名",
  "従業員名_姓名カナ",
  "従業員名_姓",
  "従業員名_名",
  "生年月日",
  "入社日",
  "退職日",
  "従業員ステータス",
  "雇用形態",
  "ドロップダウン_15",
  "基準時給",
  "打刻ID",
  "交通費_片道",
  "メールアドレス",
  "連絡先",
  "チーム名",
] as const;

export const ROSTER_BIRTHDAY_FIELD = "生年月日";
export const ROSTER_EMPLOYMENT_TYPE_FIELD = "雇用形態";

type RootEmployeeRow = {
  employee_id: string;
  employee_number: string | null;
  name: string;
  name_kana: string | null;
  company_id: string;
  employment_type: string;
  salary_system_id: string;
  hire_date: string;
  termination_date: string | null;
  email: string | null;
  kot_employee_id: string | null;
  commute_daily_allowance?: number | null;
  garden_role: GardenRole | null;
  garden_role_manual?: boolean | null;
  user_id: string | null;
  is_active: boolean;
  birthday?: string | null;
};

export type RosterSyncSummary = {
  ok: true;
  dryRun: boolean;
  syncedAt: string;
  rosterRecords: number;
  created: number;
  updated: number;
  unchanged: number;
  accountsCreated: number;
  accountsReused: number;
  authBanned: number;
  authUnbanned: number;
  snapshotRows: number;
  historyRows: number;
  myNumberRows: number;
  bankListRows: number;
  bankListSkipped: number;
  errors: string[];
};

type SyncOptions = {
  dryRun?: boolean;
  now?: Date;
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
};

function value(record: KintoneRecord, code: string): unknown {
  const field = record[code];
  if (field && typeof field === "object" && "value" in field) return (field as { value?: unknown }).value;
  return field;
}

function text(record: KintoneRecord, code: string): string {
  return String(value(record, code) ?? "").trim();
}

function nullableText(record: KintoneRecord, code: string): string | null {
  const current = text(record, code);
  return current ? current : null;
}

function dateText(record: KintoneRecord, code: string): string | null {
  const current = nullableText(record, code);
  return current && /^\d{4}-\d{2}-\d{2}$/.test(current) ? current : null;
}

function numberValue(record: KintoneRecord, code: string): number | null {
  const raw = String(value(record, code) ?? "").replace(/[^\d.-]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function digits(value: string | null): string | null {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized ? normalized : null;
}

function postalCode(value: string | null): string | null {
  const normalized = digits(value);
  return normalized && normalized.length === 7 ? normalized : normalized;
}

function dateOrNull(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function compactPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(Object.entries(payload).map(([key, current]) => [key, current === "" ? null : current])) as T;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, current]) => [key, stable(current)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stable(value));
}

function payloadEquals(a: unknown, b: unknown): boolean {
  return stableJson(a ?? null) === stableJson(b ?? null);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function buildRosterSnapshot(record: KintoneRecord): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([code, field]) => {
    const current = field && typeof field === "object" && "value" in field ? (field as { value?: unknown }).value : field;
    return [code, code === "マイナンバー" && String(current ?? "").trim() ? "***" : current ?? null];
  }));
}

export function mapRosterRecordToProfilePayloads(record: KintoneRecord, importedAt: string) {
  const address = compactPayload({
    postal_code: postalCode(nullableText(record, "郵便番号")),
    prefecture: nullableText(record, "文字列__1行_"),
    city: nullableText(record, "文字列__1行__0"),
    town: nullableText(record, "文字列__1行__2"),
    building: nullableText(record, "文字列__1行__3"),
    room: nullableText(record, "文字列__1行__4"),
    full: nullableText(record, "住所"),
  });
  const contact = compactPayload({
    phone: digits(nullableText(record, "連絡先")),
    phone_1: digits(nullableText(record, "文字列__1行__15")),
    phone_2: digits(nullableText(record, "文字列__1行__16")),
    phone_3: digits(nullableText(record, "文字列__1行__17")),
    email: nullableText(record, "メールアドレス"),
  });
  const bank1 = compactPayload({
    bank_name: nullableText(record, "銀行名_1"),
    bank_code: nullableText(record, "金融機関コード_1"),
    branch_name: nullableText(record, "文字列__1行__18"),
    branch_code: nullableText(record, "支店コード_1"),
    account_type: normalizeAccountType(nullableText(record, "種別")),
    account_number: digits(nullableText(record, "口座番号_1")),
    holder_kana: nullableText(record, "文字列__1行__9"),
    slot: 1,
  });
  const bank2 = compactPayload({
    bank_name: nullableText(record, "銀行名_2"),
    bank_code: nullableText(record, "金融機関コード_2"),
    branch_name: nullableText(record, "文字列__1行__19"),
    branch_code: nullableText(record, "支店コード_2"),
    account_type: normalizeAccountType(nullableText(record, "種別_1")),
    account_number: digits(nullableText(record, "口座番号_2")),
    holder_kana: nullableText(record, "文字列__1行__10"),
    slot: 2,
  });
  const commute = compactPayload({
    one_way: numberValue(record, "交通費_片道"),
    round_trip: numberValue(record, "交通費_往復"),
    monthly_cap: numberValue(record, "交通費上限"),
    nearest_station: nullableText(record, "ドロップダウン_3"),
    route: nullableText(record, "文字列__1行__6"),
    paid: nullableText(record, "ドロップダウン_1"),
  });
  const employment = compactPayload({
    employment_type: nullableText(record, "雇用形態"),
    hire_date: dateText(record, "入社日"),
    business: nullableText(record, "ドロップダウン"),
    department: nullableText(record, "ドロップダウン_0"),
    affiliation: nullableText(record, "ドロップダウン_15"),
    team: nullableText(record, "チーム名"),
    salary_system: nullableText(record, "配属・異動_1"),
    base_hourly: numberValue(record, "基準時給"),
    training_hourly: numberValue(record, "数値_0"),
    training_cap: numberValue(record, "数値"),
    year_end_adjustment: nullableText(record, "ドロップダウン_8"),
    social_insurance: nullableText(record, "ドロップダウン_5"),
    employment_insurance: nullableText(record, "ドロップダウン_4"),
    employment_insurance_no: nullableText(record, "雇用保険番号"),
    pension_no: nullableText(record, "文字列__1行__8"),
    advance_pay: nullableText(record, "ドロップダウン_6"),
    call_type: nullableText(record, "ドロップダウン_16"),
  });
  const result: Array<{ category: string; payload: Record<string, unknown> }> = [
    { category: "address", payload: address },
    { category: "contact", payload: contact },
    { category: "bank_account", payload: hasMeaningfulBankPayload(bank2) ? { ...bank1, sub_account: bank2 } : bank1 },
    { category: "commute", payload: commute },
    { category: "employment", payload: employment },
  ];
  if (nullableText(record, "マイナンバー")) {
    result.push({ category: "my_number_status", payload: { submitted: true, source: "roster", imported_at: importedAt } });
  }
  return result;
}

function hasMeaningfulBankPayload(payload: Record<string, unknown>): boolean {
  return ["bank_name", "branch_name", "account_number", "holder_kana"].some((key) => Boolean(payload[key]));
}

function normalizeAccountType(current: string | null): string | null {
  if (!current) return null;
  if (current.includes("当座")) return "current";
  if (current.includes("普通")) return "ordinary";
  return current;
}

function shouldCollectProfileHistory(record: KintoneRecord, today: string): boolean {
  if (text(record, "従業員ステータス") === "在籍中") return true;
  const terminationDate = dateText(record, "退職日");
  if (!terminationDate) return false;
  const until = new Date(`${terminationDate}T00:00:00+09:00`);
  until.setDate(until.getDate() + 90);
  return new Date(`${today}T00:00:00+09:00`) <= until;
}

// Root の社員番号（employee_number）は KOT の打刻 ID と同じ採番。名簿の「社員番号（APID）」は別の採番なので照合には使わない（2026-09-09 本番で判明：宮永＝名簿 0091／Root・KOT 1165）
// 打刻 ID が無い名簿の行（古い退職者）は履歴として R{名簿レコード番号} で登録する（ログインは作らない）
/**
 * Root に入っている社員番号を、名簿から作る番号（normalizeEmployeeNumber）と同じ形にそろえる。
 * 数字だけの番号は 4 桁に左ゼロ詰め。打刻 ID の無い人の「R1」「R10」のような番号は**そのまま**。
 * （2026-09-10：ここで R 番号まで 4 桁詰めしていたため「R1」が「00R1」となり、
 *   毎朝の同期で 84 人が毎回「新規」と判定され、同じ社員番号を作ろうとして同期全体が止まっていた）
 */
export function existingNumberKey(employeeNumber: string): string {
  return /^\d+$/.test(employeeNumber) ? employeeNumber.padStart(4, "0") : employeeNumber;
}

export function normalizeEmployeeNumber(record: KintoneRecord): string {
  const kot = text(record, "打刻ID").replace(/\D/g, "");
  if (kot) return kot.padStart(4, "0");
  const recordId = text(record, "$id") || text(record, "レコード番号");
  return recordId ? `R${recordId}` : "";
}

export function hasKotId(record: KintoneRecord): boolean {
  return Boolean(text(record, "打刻ID").replace(/\D/g, ""));
}

function teamNames(record: KintoneRecord): string[] {
  const raw = value(record, "チーム名");
  if (Array.isArray(raw)) {
    return raw.flatMap((row) => {
      const rowValue = row && typeof row === "object" && "value" in row ? (row as { value?: Record<string, unknown> }).value : null;
      if (!rowValue) return [];
      return Object.values(rowValue).map((item) => {
        if (item && typeof item === "object" && "value" in item) return String((item as { value?: unknown }).value ?? "").trim();
        return String(item ?? "").trim();
      });
    }).filter(Boolean);
  }
  return text(record, "チーム名").split(/[,\s、]+/).map((item) => item.trim()).filter(Boolean);
}

function isBackOffice(record: KintoneRecord): boolean {
  return teamNames(record).some((team) => ["バックヤード", "所属なし", "ヒュアラングループ"].includes(team));
}

export function roleFromRoster(record: KintoneRecord, existing?: Pick<RootEmployeeRow, "garden_role" | "garden_role_manual"> | null): GardenRole {
  if (existing?.garden_role_manual && existing.garden_role) return existing.garden_role;
  const employmentType = text(record, ROSTER_EMPLOYMENT_TYPE_FIELD) || text(record, "ドロップダウン_15");
  if (!/アルバイト|パート/.test(employmentType)) return existing?.garden_role ?? "staff";
  if (isBackOffice(record)) return "staff";
  const hourly = numberValue(record, "基準時給");
  if (hourly === 1500) return "toss";
  if (hourly !== null && hourly >= 1400) return "closer";
  return "toss";
}

export function mapRosterRecordToRoot(record: KintoneRecord, existing?: RootEmployeeRow | null, today = tokyoDateString()) {
  const employeeNumber = normalizeEmployeeNumber(record);
  const oneWay = numberValue(record, "交通費_片道");
  const terminationDate = dateText(record, "退職日");
  const status = text(record, "従業員ステータス");
  return {
    employee_id: existing?.employee_id ?? `EMP-${employeeNumber}`,
    employee_number: employeeNumber,
    name: text(record, "従業員名_姓名"),
    name_kana: nullableText(record, "従業員名_姓名カナ") ?? existing?.name_kana ?? "",
    birthday: dateText(record, ROSTER_BIRTHDAY_FIELD) ?? existing?.birthday ?? null,
    hire_date: dateText(record, "入社日") ?? existing?.hire_date ?? today,
    termination_date: terminationDate,
    employment_type: normalizeEmploymentType(text(record, ROSTER_EMPLOYMENT_TYPE_FIELD) || text(record, "ドロップダウン_15") || existing?.employment_type),
    kot_employee_id: nullableText(record, "打刻ID") ?? existing?.kot_employee_id ?? null,
    email: nullableText(record, "メールアドレス") ?? existing?.email ?? "",
    commute_daily_allowance: existing?.commute_daily_allowance ?? (oneWay === null ? null : oneWay * 2),
    garden_role: roleFromRoster(record, existing),
    is_active: shouldEmployeeBeActive(status, terminationDate, today),
  };
}

function normalizeEmploymentType(value: string | null | undefined): string {
  const source = value ?? "";
  if (/アルバイト|パート/.test(source)) return "アルバイト";
  if (/外注|業務委託|outsource/i.test(source)) return "outsource";
  return "正社員";
}

function initialPassword(birthday: string | null | undefined) {
  if (!birthday) return null;
  const [, month, day] = birthday.split("-");
  return month && day ? `gd${month}${day}` : null;
}

function syntheticEmail(employeeNumber: string) {
  return `emp${employeeNumber.padStart(4, "0")}@garden.internal`;
}

async function createOrReuseAuthUser(admin: SupabaseClient, mapped: ReturnType<typeof mapRosterRecordToRoot>, dryRun: boolean, summary: RosterSyncSummary) {
  if (!mapped.is_active) return null;
  if (mapped.employee_number.startsWith("R")) {
    summary.errors.push(`${mapped.name}: 打刻 ID が無いためアカウントを作らない（在籍中）`);
    return null;
  }
  const email = syntheticEmail(mapped.employee_number);
  const password = initialPassword(mapped.birthday);
  if (!password) {
    summary.errors.push(`${mapped.employee_number} ${mapped.name}: 生年月日が空のためアカウント作成をスキップ`);
    return null;
  }
  if (dryRun) {
    summary.accountsCreated += 1;
    return "dry-run-user-id";
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { employee_number: mapped.employee_number, name: mapped.name },
  });
  if (!error && data.user) {
    summary.accountsCreated += 1;
    return data.user.id;
  }
  const alreadyExists = error?.message.includes("already") || (error as unknown as { code?: string } | null)?.code === "email_exists";
  if (!alreadyExists) throw error;
  // listUsers は 1 ページ 50 人が既定。全員（500 人規模）を見る
  let found: { id: string; email?: string } | undefined;
  for (let page = 1; page <= 20 && !found; page += 1) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw listError;
    found = list.users.find((user) => user.email === email);
    if (list.users.length < 1000) break;
  }
  if (!found) throw new Error(`auth user exists but not found: ${email}`);
  summary.accountsReused += 1;
  await admin.auth.admin.updateUserById(found.id, { ban_duration: "none" });
  summary.authUnbanned += 1;
  return found.id;
}

async function banAuthUser(admin: SupabaseClient, userId: string | null, dryRun: boolean, summary: RosterSyncSummary) {
  if (!userId) return;
  summary.authBanned += 1;
  if (!dryRun) await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
}

type LooseSupabase = {
  from: (table: string) => {
    select?: (...args: unknown[]) => unknown;
    insert?: (...args: unknown[]) => Promise<{ error?: unknown }> | { error?: unknown };
    upsert?: (...args: unknown[]) => Promise<{ error?: unknown }> | { error?: unknown };
    update?: (...args: unknown[]) => unknown;
  };
};

async function maybeThen<T>(value: T | Promise<T>): Promise<T> {
  return await value;
}

async function syncRosterFieldLabels(admin: SupabaseClient, app: string, token: string, dryRun: boolean): Promise<number> {
  const fields = await getFormFields(app, token).catch(() => []);
  if (!fields.length || dryRun) return fields.length;
  const table = (admin as unknown as LooseSupabase).from("root_employee_roster_field_labels");
  if (typeof table.upsert !== "function") return fields.length;
  const { error } = await maybeThen(table.upsert(fields.map((field) => ({
    field_code: field.code,
    label: field.label,
    field_type: field.type,
    updated_at: new Date().toISOString(),
  })), { onConflict: "field_code" }));
  if (error) throw error;
  return fields.length;
}

async function latestSnapshotHash(admin: SupabaseClient, employeeId: string): Promise<string | null> {
  const query = (admin as unknown as LooseSupabase).from("root_employee_roster_snapshot").select?.("snapshot_hash");
  if (!query || typeof query !== "object") return null;
  const chain = query as { eq?: (...args: unknown[]) => unknown };
  const eq = chain.eq?.("employee_id", employeeId);
  const ordered = eq && typeof eq === "object" && "order" in eq ? (eq as { order: (...args: unknown[]) => unknown }).order("taken_at", { ascending: false }) : null;
  const limited = ordered && typeof ordered === "object" && "limit" in ordered ? (ordered as { limit: (...args: unknown[]) => unknown }).limit(1) : null;
  const single = limited && typeof limited === "object" && "maybeSingle" in limited ? await (limited as { maybeSingle: () => Promise<{ data?: { snapshot_hash?: string | null } | null; error?: unknown }> }).maybeSingle() : null;
  if (single?.error) throw single.error;
  return single?.data?.snapshot_hash ?? null;
}

async function insertSnapshotIfChanged(admin: SupabaseClient, employeeId: string, record: KintoneRecord, today: string, dryRun: boolean): Promise<number> {
  const snapshot = buildRosterSnapshot(record);
  const snapshotHash = sha256(snapshot);
  if (await latestSnapshotHash(admin, employeeId) === snapshotHash) return 0;
  if (dryRun) return 1;
  const table = (admin as unknown as LooseSupabase).from("root_employee_roster_snapshot");
  if (typeof table.insert !== "function") return 1;
  const { error } = await maybeThen(table.insert({
    employee_id: employeeId,
    roster_record_id: text(record, "$id") || text(record, "レコード番号") || null,
    snapshot,
    snapshot_hash: snapshotHash,
    taken_at: `${today}T00:00:00+09:00`,
  }));
  if (error) throw error;
  return 1;
}

// 「同じ値なら足さない」の比較相手は、同じ人・同じ区分・**同じ出どころ**の最新行。
// 全体の最新行と比べると、事務入力（admin）や口座一覧（bank_list）が最新のときに名簿（roster）の行を毎朝足し直してしまい、
// 東海林さんが決めた口座を上書きする（2026-09-14 本番で発生）。出どころごとに比べれば、名簿の値が実際に変わったときだけ足す
async function latestProfilePayload(admin: SupabaseClient, employeeId: string, category: string, source: string): Promise<Record<string, unknown> | null> {
  const query = (admin as unknown as LooseSupabase).from("root_employee_profile_history").select?.("payload");
  if (!query || typeof query !== "object") return null;
  const first = (query as { eq?: (...args: unknown[]) => unknown }).eq?.("employee_id", employeeId);
  const second = first && typeof first === "object" && "eq" in first ? (first as { eq: (...args: unknown[]) => unknown }).eq("category", category) : null;
  const third = second && typeof second === "object" && "eq" in second ? (second as { eq: (...args: unknown[]) => unknown }).eq("source", source) : null;
  const ordered = third && typeof third === "object" && "order" in third ? (third as { order: (...args: unknown[]) => unknown }).order("recorded_at", { ascending: false }) : null;
  const limited = ordered && typeof ordered === "object" && "limit" in ordered ? (ordered as { limit: (...args: unknown[]) => unknown }).limit(1) : null;
  const single = limited && typeof limited === "object" && "maybeSingle" in limited ? await (limited as { maybeSingle: () => Promise<{ data?: { payload?: Record<string, unknown> } | null; error?: unknown }> }).maybeSingle() : null;
  if (single?.error) throw single.error;
  return single?.data?.payload ?? null;
}

async function insertProfileHistoryIfChanged(
  admin: SupabaseClient,
  row: { employee_id: string; category: string; payload: Record<string, unknown>; source: string; source_ref: string | null; effective_from: string; recorded_by: string },
  dryRun: boolean,
): Promise<number> {
  const latest = await latestProfilePayload(admin, row.employee_id, row.category, row.source);
  if (payloadEquals(latest, row.payload)) return 0;
  if (dryRun) return 1;
  const table = (admin as unknown as LooseSupabase).from("root_employee_profile_history");
  if (typeof table.insert !== "function") return 1;
  const { error } = await maybeThen(table.insert(row));
  if (error) throw error;
  return 1;
}

async function upsertMyNumberIfChanged(admin: SupabaseClient, employeeId: string, myNumber: string | null, today: string, dryRun: boolean): Promise<number> {
  if (!myNumber) return 0;
  const table = (admin as unknown as LooseSupabase).from("root_employee_my_numbers");
  const query = table.select?.("my_number");
  let current: string | null = null;
  if (query && typeof query === "object" && "eq" in query) {
    const eq = (query as { eq: (...args: unknown[]) => unknown }).eq("employee_id", employeeId);
    const single = eq && typeof eq === "object" && "maybeSingle" in eq ? await (eq as { maybeSingle: () => Promise<{ data?: { my_number?: string | null } | null; error?: unknown }> }).maybeSingle() : null;
    if (single?.error) throw single.error;
    current = single?.data?.my_number ?? null;
  }
  if (current === myNumber) return 0;
  if (dryRun || typeof table.upsert !== "function") return 1;
  const { error } = await maybeThen(table.upsert({ employee_id: employeeId, my_number: myNumber, submitted_at: `${today}T00:00:00+09:00` }, { onConflict: "employee_id" }));
  if (error) throw error;
  return 1;
}

function timestampForSort(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapBankListPayload(record: KintoneRecord) {
  return compactPayload({
    bank_name: nullableText(record, "銀行名"),
    bank_code: null,
    branch_name: nullableText(record, "支店名"),
    branch_code: nullableText(record, "支店コード"),
    account_type: normalizeAccountType(nullableText(record, "種別")),
    account_number: digits(nullableText(record, "口座番号")),
    holder_kana: nullableText(record, "口座名義カナ"),
    slot: 1,
    paid_on: dateOrNull(nullableText(record, "支払日")),
    kintone_record: nullableText(record, "レコード番号") ?? nullableText(record, "$id"),
  });
}

// 口座一覧（app92）の突合は氏名で行う。KOTID（ルックアップ_0）は 297 行中 216 行が空・66 行が r 付きで、在籍者の打刻IDと一致しない（2026-09-14 実測）。氏名が無いときだけ KOTID を試す
export function normalizeEmployeeName(value: string | null | undefined): string {
  return String(value ?? "").normalize("NFKC").replace(/[\s　]+/g, "").replace(/惠/g, "恵");
}

async function syncBankListHistory(
  admin: SupabaseClient,
  employeesByKot: Map<string, Pick<RootEmployeeRow, "employee_id" | "kot_employee_id">>,
  employeesByName: Map<string, Pick<RootEmployeeRow, "employee_id" | "kot_employee_id">>,
  today: string,
  dryRun: boolean,
): Promise<{ rows: number; skipped: number }> {
  const app = process.env.KINTONE_BANK_ACCOUNTS_APP_ID;
  const token = process.env.KINTONE_BANK_ACCOUNTS_TOKEN;
  if (!app || !token) return { rows: 0, skipped: 0 };
  const records = await getAllRecords(app, token, "", null);
  const latestByEmployee = new Map<string, KintoneRecord>();
  let skipped = 0;
  for (const record of records) {
    const nameKey = normalizeEmployeeName(nullableText(record, "文字列__1行__0"));
    const kot = digits(nullableText(record, "ルックアップ_0"));
    const employee = (nameKey ? employeesByName.get(nameKey) : undefined)
      ?? (kot ? (employeesByKot.get(kot.padStart(4, "0")) ?? employeesByKot.get(kot)) : undefined);
    if (!employee) { skipped += 1; continue; }
    const current = latestByEmployee.get(employee.employee_id);
    if (!current) {
      latestByEmployee.set(employee.employee_id, record);
      continue;
    }
    const currentUpdated = timestampForSort(nullableText(current, "更新日時"));
    const nextUpdated = timestampForSort(nullableText(record, "更新日時"));
    const currentPaid = timestampForSort(nullableText(current, "支払日"));
    const nextPaid = timestampForSort(nullableText(record, "支払日"));
    if (nextUpdated > currentUpdated || (nextUpdated === currentUpdated && nextPaid > currentPaid)) {
      latestByEmployee.set(employee.employee_id, record);
    }
  }
  let rows = 0;
  for (const [employeeId, record] of latestByEmployee) {
    rows += await insertProfileHistoryIfChanged(admin, {
      employee_id: employeeId,
      category: "bank_account",
      payload: mapBankListPayload(record),
      source: "bank_list",
      source_ref: nullableText(record, "レコード番号") ?? nullableText(record, "$id"),
      effective_from: dateOrNull(nullableText(record, "支払日")) ?? dateOrNull(nullableText(record, "更新日時")) ?? today,
      recorded_by: "system:roster-sync",
    }, dryRun);
  }
  return { rows, skipped };
}

export async function writeRetirementToRoster(employee: { kot_employee_id?: string | null; termination_date?: string | null }, fetchImpl: typeof fetch = fetch) {
  if (!employee.kot_employee_id || !employee.termination_date) return { status: "skipped" as const, note: "KOTIDまたは退職日が空のため名簿更新をスキップ" };
  const subdomain = process.env.KINTONE_SUBDOMAIN;
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN;
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
  if (!subdomain || !token) return { status: "skipped" as const, note: "Kintone環境変数未設定" };
  const query = `打刻ID = "${employee.kot_employee_id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" order by 作成日時 desc limit 1`;
  const found = await fetchImpl(`https://${subdomain}.cybozu.com/k/v1/records.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Cybozu-API-Token": token, "X-HTTP-Method-Override": "GET" },
    body: JSON.stringify({ app, query, fields: ["$id"] }),
    cache: "no-store",
  });
  if (!found.ok) return { status: "failed" as const, note: `名簿検索失敗: ${found.status}` };
  const json = await found.json() as { records?: Array<{ $id?: { value?: string } }> };
  const id = json.records?.[0]?.$id?.value;
  if (!id) return { status: "skipped" as const, note: "KOTIDが名簿にありません" };
  const updated = await fetchImpl(`https://${subdomain}.cybozu.com/k/v1/record.json`, {
    method: "PUT",
    headers: { "content-type": "application/json", "X-Cybozu-API-Token": token },
    body: JSON.stringify({ app, id, record: { 退職日: { value: employee.termination_date }, 従業員ステータス: { value: "退職済み" } } }),
    cache: "no-store",
  });
  return updated.ok ? { status: "synced" as const, note: null } : { status: "failed" as const, note: `名簿更新失敗: ${updated.status}` };
}

export async function syncRootRoster(options: SyncOptions = {}): Promise<RosterSyncSummary> {
  const dryRun = options.dryRun ?? true;
  const admin = options.supabase ?? getSupabaseAdmin();
  const today = tokyoDateString(options.now);
  const summary: RosterSyncSummary = {
    ok: true,
    dryRun,
    syncedAt: new Date().toISOString(),
    rosterRecords: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    accountsCreated: 0,
    accountsReused: 0,
    authBanned: 0,
    authUnbanned: 0,
    snapshotRows: 0,
    historyRows: 0,
    myNumberRows: 0,
    bankListRows: 0,
    bankListSkipped: 0,
    errors: [],
  };
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN ?? "";
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
  await syncRosterFieldLabels(admin, app, token, dryRun);
  const records = await getAllRecords(app, token, "", null);
  summary.rosterRecords = records.length;

  const { data: existingRows, error } = await admin.from("root_employees").select("employee_id,employee_number,name,name_kana,company_id,employment_type,salary_system_id,hire_date,termination_date,email,kot_employee_id,commute_daily_allowance,garden_role,garden_role_manual,user_id,is_active,birthday");
  if (error) throw error;
  const existingByNumber = new Map(((existingRows ?? []) as RootEmployeeRow[]).map((row) => [existingNumberKey(String(row.employee_number ?? "")), row]));
  const employeesByKot = new Map<string, Pick<RootEmployeeRow, "employee_id" | "kot_employee_id">>();
  const employeesByName = new Map<string, Pick<RootEmployeeRow, "employee_id" | "kot_employee_id">>();
  for (const row of (existingRows ?? []) as RootEmployeeRow[]) {
    const kot = digits(row.kot_employee_id);
    if (kot) employeesByKot.set(kot.padStart(4, "0"), row);
    const nameKey = normalizeEmployeeName(row.name);
    if (nameKey && (row.is_active || !employeesByName.has(nameKey))) employeesByName.set(nameKey, row);
  }

  // 同じ打刻 ID が名簿に複数ある（再入社・業務委託での再加入＝新規レコード）ときは、在籍中の行 → 入社日が新しい行 の順に 1 行だけ採用する
  const chosen = new Map<string, KintoneRecord>();
  const duplicates: string[] = [];
  for (const record of records) {
    const employeeNumber = normalizeEmployeeNumber(record);
    if (!employeeNumber) continue;
    const current = chosen.get(employeeNumber);
    if (!current) { chosen.set(employeeNumber, record); continue; }
    duplicates.push(`${text(record, "従業員名_姓名")}: 打刻 ID ${employeeNumber} が名簿で重複（在籍中・入社日が新しい行を採用）`);
    const rank = (r: KintoneRecord) => `${text(r, "従業員ステータス") === "在籍中" ? "1" : "0"}${dateText(r, "入社日") ?? "0000-00-00"}`;
    if (rank(record) > rank(current)) chosen.set(employeeNumber, record);
  }
  summary.errors.push(...duplicates);

  for (const [employeeNumber, record] of chosen) {
    const existing = existingByNumber.get(employeeNumber) ?? null;
    const mapped = mapRosterRecordToRoot(record, existing, today);
    const userId = existing?.user_id ?? await createOrReuseAuthUser(admin, mapped, dryRun, summary);
    if (!mapped.is_active) await banAuthUser(admin, existing?.user_id ?? null, dryRun, summary);

    const row = {
      ...mapped,
      user_id: userId,
      company_id: existing?.company_id ?? "COMP-001",
      salary_system_id: existing?.salary_system_id ?? "SAL-SYS-001",
      bank_name: "",
      bank_code: "",
      branch_name: "",
      branch_code: "",
      account_type: "普通",
      account_number: "",
      account_holder: "",
      account_holder_kana: "",
      insurance_type: "未加入",
      roster_record_id: text(record, "$id") || text(record, "レコード番号") || null,
    };
    if (existing) {
      summary.updated += 1;
      if (!dryRun) {
        const { error: updateError } = await admin.from("root_employees").update({
          name: row.name,
          name_kana: row.name_kana,
          birthday: row.birthday,
          hire_date: row.hire_date,
          termination_date: row.termination_date,
          employment_type: row.employment_type,
          kot_employee_id: row.kot_employee_id,
          email: row.email,
          commute_daily_allowance: existing.commute_daily_allowance ?? row.commute_daily_allowance,
          // 役職は既存行では変えない（DB のトリガーが全権管理者以外の役職変更を止める。役職は営業部のトス／クローザー区分から Root で決める）
          user_id: row.user_id,
          is_active: row.is_active,
          roster_record_id: row.roster_record_id,
        }).eq("employee_id", existing.employee_id);
        if (updateError) throw updateError;
      }
    } else {
      summary.created += 1;
      if (!dryRun) {
        const { error: insertError } = await admin.from("root_employees").insert(row);
        if (insertError) throw insertError;
      }
    }
    const mappedKot = digits(mapped.kot_employee_id);
    if (mappedKot) employeesByKot.set(mappedKot.padStart(4, "0"), { employee_id: mapped.employee_id, kot_employee_id: mapped.kot_employee_id });
    const mappedName = normalizeEmployeeName(mapped.name);
    if (mappedName) employeesByName.set(mappedName, { employee_id: mapped.employee_id, kot_employee_id: mapped.kot_employee_id });

    if (shouldCollectProfileHistory(record, today)) {
      summary.snapshotRows += await insertSnapshotIfChanged(admin, mapped.employee_id, record, today, dryRun);
      const sourceRef = text(record, "$id") || text(record, "レコード番号") || null;
      for (const item of mapRosterRecordToProfilePayloads(record, today)) {
        summary.historyRows += await insertProfileHistoryIfChanged(admin, {
          employee_id: mapped.employee_id,
          category: item.category,
          payload: item.payload,
          source: "roster",
          source_ref: sourceRef,
          effective_from: today,
          recorded_by: "system:roster-sync",
        }, dryRun);
      }
      summary.myNumberRows += await upsertMyNumberIfChanged(admin, mapped.employee_id, nullableText(record, "マイナンバー"), today, dryRun);
    }
  }

  const bankSummary = await syncBankListHistory(admin, employeesByKot, employeesByName, today, dryRun);
  summary.bankListRows = bankSummary.rows;
  summary.bankListSkipped = bankSummary.skipped;
  summary.historyRows += bankSummary.rows;

  if (!dryRun) {
    await admin.from("root_roster_sync_log").insert({
      synced_at: summary.syncedAt,
      dry_run: false,
      roster_records: summary.rosterRecords,
      created_count: summary.created,
      updated_count: summary.updated,
      accounts_created_count: summary.accountsCreated,
      auth_banned_count: summary.authBanned,
      auth_unbanned_count: summary.authUnbanned,
      snapshot_rows: summary.snapshotRows,
      history_rows: summary.historyRows,
      my_number_rows: summary.myNumberRows,
      bank_list_rows: summary.bankListRows,
      bank_list_skipped: summary.bankListSkipped,
      errors: summary.errors,
    });
  }
  return summary;
}

export async function getLatestRosterSyncLog(admin: SupabaseClient = getSupabaseAdmin()) {
  const { data, error } = await admin.from("root_roster_sync_log").select("*").order("synced_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function retireAuthIfNeeded(admin: SupabaseClient, employee: { user_id?: string | null; termination_date?: string | null; is_active?: boolean | null }) {
  const retired = isRetiredByDate(employee.termination_date);
  if (!employee.user_id) return retired;
  await admin.auth.admin.updateUserById(employee.user_id, { ban_duration: retired || employee.is_active === false ? "876000h" : "none" });
  return retired;
}
