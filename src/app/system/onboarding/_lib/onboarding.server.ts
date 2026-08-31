import "server-only";
import { createServerClient } from "@/app/_lib/supabase/server";
import { initialInput, parseInput, PREPARING_MESSAGE, TEXT_FIELDS, type OnboardingRecord } from "./onboarding";

type OnboardingEmployee = { employee_id: string; name: string | null; name_kana: string | null; birthday: string | null };

export class OnboardingError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
export function databaseError(error: { code?: string } | null) {
  return new OnboardingError(error?.code === "PGRST205" || error?.code === "42P01" ? PREPARING_MESSAGE : "入社手続きを読み込めませんでした。時間をおいて、もう一度お試しください。", 503);
}
export async function onboardingEmployee() {
  const supabase = await createServerClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) throw new OnboardingError("ログインし直してください。", 401);
  const employeeResult = await supabase.from("root_employees").select("employee_id,name,name_kana,birthday")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (employeeResult.error || !employeeResult.data || typeof employeeResult.data.employee_id !== "string" || !employeeResult.data.employee_id) throw new OnboardingError("ログインし直してください。", 401);
  const employee: OnboardingEmployee = employeeResult.data;
  return { supabase, employee };
}
export const ONBOARDING_COLUMNS = [...TEXT_FIELDS, "dependents", "status", "nda_agreed_at", "submitted_at"].join(",");
type Context = Awaited<ReturnType<typeof onboardingEmployee>>;
export async function readOnboarding({ supabase, employee }: Context): Promise<OnboardingRecord> {
  const { data, error } = await supabase.from("system_onboarding").select(ONBOARDING_COLUMNS).eq("employee_id", employee.employee_id).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return { values: initialInput(employee), status: "draft", ndaAgreedAt: null, submittedAt: null };
  const row = data as unknown as Record<string, unknown>;
  return { values: parseInput({ ...row, nda_agreed: Boolean(row.nda_agreed_at) }), status: row.status === "submitted" ? "submitted" : "draft", ndaAgreedAt: typeof row.nda_agreed_at === "string" ? row.nda_agreed_at : null, submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null };
}

function dateOrNull(value: string) {
  // 空欄はdate型へnullで渡す。UIはdate入力を使い、不正なAPI入力もDBエラーにしない。
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export async function saveOnboarding(context: Context, input: unknown, submit: boolean) {
  let values;
  try { values = parseInput(input); } catch { throw new OnboardingError("入力内容を読み取れませんでした。ページを開き直してください。", 400); }
  const previous = await readOnboarding(context);
  // 提出済みは見返すだけ。二重送信も同じ結果を返し、提出時刻を更新しない。
  if (previous.status === "submitted") return previous;
  const now = new Date().toISOString();
  const { nda_agreed, ...fields } = values;
  const { data, error } = await context.supabase.from("system_onboarding").upsert({
    ...fields, employee_id: context.employee.employee_id, status: submit ? "submitted" : "draft",
    birth_date: dateOrNull(values.birth_date), previous_employer_from: dateOrNull(values.previous_employer_from), previous_employer_to: dateOrNull(values.previous_employer_to),
    nda_agreed_at: nda_agreed ? previous.ndaAgreedAt ?? now : null, submitted_at: submit ? now : null,
  }, { onConflict: "employee_id" }).select("status,nda_agreed_at,submitted_at").single();
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") throw databaseError(error);
    throw new OnboardingError("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。", 503);
  }
  return { values, status: data.status as "draft" | "submitted", ndaAgreedAt: data.nda_agreed_at as string | null, submittedAt: data.submitted_at as string | null };
}

export async function needsOnboarding(supabase: Context["supabase"], employeeId: string) {
  const { data, error } = await supabase.from("system_onboarding").select("status").eq("employee_id", employeeId).maybeSingle();
  // 準備前も入口は案内する。他の画面・ホーム自体は止めない。
  if (error) return error.code === "PGRST205" || error.code === "42P01";
  return !data || data.status === "draft";
}
