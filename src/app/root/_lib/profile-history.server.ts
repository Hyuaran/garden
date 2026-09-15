type LooseSupabase = {
  from: (table: string) => {
    select?: (columns?: string) => unknown;
    insert?: (row: unknown) => Promise<{ error?: unknown }> | { then?: unknown };
  };
};

export const PROFILE_CATEGORIES = [
  "address",
  "contact",
  "emergency_contact",
  "bank_account",
  "commute",
  "dependents",
] as const;

export type ProfileCategory = (typeof PROFILE_CATEGORIES)[number];

export type ProfileHistoryRow = {
  id?: string;
  employee_id: string;
  category: string;
  payload: Record<string, unknown>;
  source: string;
  source_ref: string | null;
  source_document_url?: string | null;
  effective_from: string | null;
  recorded_at?: string | null;
  recorded_by: string | null;
  confirmed_by_employee_at?: string | null;
  note?: string | null;
};

export type ProfileCurrentMap = Record<string, ProfileHistoryRow>;
export type ProfileConfirmationMap = Record<string, string>;

function asQuery(value: unknown): Record<string, (...args: unknown[]) => unknown> {
  return value && typeof value === "object" ? value as Record<string, (...args: unknown[]) => unknown> : {};
}

async function maybeThen<T = { data?: unknown; error?: unknown }>(value: unknown): Promise<T> {
  if (value && typeof value === "object" && "then" in value && typeof (value as Promise<T>).then === "function") return await value as T;
  return value as T;
}

export function normalizePayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!payload) return null;
  const entries = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export function payloadEquals(a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined) {
  return JSON.stringify(normalizePayload(a)) === JSON.stringify(normalizePayload(b));
}

export function maskAccountNumber(value: unknown, revealAll = false): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  if (!raw) return null;
  return revealAll ? raw : `****${raw.slice(-4)}`;
}

export function maskBankPayload(payload: Record<string, unknown>, revealAll = false) {
  return { ...payload, account_number: maskAccountNumber(payload.account_number, revealAll) };
}

export async function getCurrentProfile(admin: LooseSupabase, employeeId: string, revealBankAccount = false): Promise<ProfileCurrentMap> {
  const query = asQuery(admin.from("root_employee_profile_current").select?.("*"));
  const filtered = query.eq?.("employee_id", employeeId);
  const { data, error } = await maybeThen<{ data?: ProfileHistoryRow[]; error?: unknown }>(filtered);
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return Object.fromEntries(rows.map((row) => [
    row.category,
    {
      ...row,
      payload: row.category === "bank_account" ? maskBankPayload(row.payload ?? {}, revealBankAccount) : row.payload,
    },
  ]));
}

export async function getProfileHistory(admin: LooseSupabase, employeeId: string, revealBankAccount = false): Promise<ProfileHistoryRow[]> {
  const query = asQuery(admin.from("root_employee_profile_history").select?.("*"));
  const filtered = asQuery(query.eq?.("employee_id", employeeId));
  const ordered = asQuery(filtered.order?.("recorded_at", { ascending: false }));
  const limited = ordered.limit?.(500);
  const { data, error } = await maybeThen<{ data?: ProfileHistoryRow[]; error?: unknown }>(limited);
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) => ({
    ...row,
    payload: row.category === "bank_account" ? maskBankPayload(row.payload ?? {}, revealBankAccount) : row.payload,
  }));
}

export async function getLatestConfirmations(admin: LooseSupabase, employeeId: string): Promise<ProfileConfirmationMap> {
  const query = asQuery(admin.from("root_employee_profile_history").select?.("category,confirmed_by_employee_at"));
  const first = asQuery(query.eq?.("employee_id", employeeId));
  const second = asQuery(first.eq?.("source", "employee_confirm"));
  const ordered = asQuery(second.order?.("confirmed_by_employee_at", { ascending: false }));
  const { data, error } = await maybeThen<{ data?: Array<{ category?: string; confirmed_by_employee_at?: string | null }>; error?: unknown }>(ordered);
  if (error) throw error;
  const out: ProfileConfirmationMap = {};
  for (const row of Array.isArray(data) ? data : []) {
    if (row.category && row.confirmed_by_employee_at && !out[row.category]) out[row.category] = row.confirmed_by_employee_at;
  }
  return out;
}

export async function latestProfilePayload(admin: LooseSupabase, employeeId: string, category: string, source: string): Promise<Record<string, unknown> | null> {
  const query = asQuery(admin.from("root_employee_profile_history").select?.("payload"));
  const first = asQuery(query.eq?.("employee_id", employeeId));
  const second = asQuery(first.eq?.("category", category));
  const third = asQuery(second.eq?.("source", source));
  const ordered = asQuery(third.order?.("recorded_at", { ascending: false }));
  const limited = asQuery(ordered.limit?.(1));
  const single = limited.maybeSingle?.();
  const { data, error } = await maybeThen<{ data?: { payload?: Record<string, unknown> } | null; error?: unknown }>(single);
  if (error) throw error;
  return data?.payload ?? null;
}

export async function insertProfileHistoryIfChanged(admin: LooseSupabase, row: ProfileHistoryRow): Promise<number> {
  const latest = await latestProfilePayload(admin, row.employee_id, row.category, row.source);
  if (payloadEquals(latest, row.payload)) return 0;
  const { error } = await maybeThen<{ error?: unknown }>(admin.from("root_employee_profile_history").insert?.(row));
  if (error) throw error;
  return 1;
}

export function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function sourceLabel(source: string) {
  return ({
    roster: "従業員名簿",
    bank_list: "口座一覧",
    transfer_group: "振込グループ",
    mf_contract: "電子契約の書類",
    employee_confirm: "本人確認",
    submission: "届出",
    onboarding: "入社手続き",
    admin: "事務の入力",
  } as Record<string, string>)[source] ?? source;
}
