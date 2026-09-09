import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllRecords, type KintoneRecord } from "@/lib/kintone/records";
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

// Root の社員番号（employee_number）は KOT の打刻 ID と同じ採番。名簿の「社員番号（APID）」は別の採番なので照合には使わない（2026-09-09 本番で判明：宮永＝名簿 0091／Root・KOT 1165）
// 打刻 ID が無い名簿の行（古い退職者）は履歴として R{名簿レコード番号} で登録する（ログインは作らない）
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
  const summary: RosterSyncSummary = { ok: true, dryRun, syncedAt: new Date().toISOString(), rosterRecords: 0, created: 0, updated: 0, unchanged: 0, accountsCreated: 0, accountsReused: 0, authBanned: 0, authUnbanned: 0, errors: [] };
  const token = process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN ?? "";
  const app = process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID || "56";
  const records = await getAllRecords(app, token, "", ROSTER_SYNC_FIELDS);
  summary.rosterRecords = records.length;

  const { data: existingRows, error } = await admin.from("root_employees").select("employee_id,employee_number,name,name_kana,company_id,employment_type,salary_system_id,hire_date,termination_date,email,kot_employee_id,commute_daily_allowance,garden_role,garden_role_manual,user_id,is_active,birthday");
  if (error) throw error;
  const existingByNumber = new Map(((existingRows ?? []) as RootEmployeeRow[]).map((row) => [String(row.employee_number ?? "").padStart(4, "0"), row]));

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
  }

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
