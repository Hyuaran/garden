import "server-only";
import { encryptOnboardingNumbers } from '@/lib/my-number/crypto.server';
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { initialInput, parseInput, STEPS, type OnboardingRecord } from "./onboarding";
import { databaseError, OnboardingError, readOnboarding } from "./onboarding.server";
import { hasProxyPrivateInput, proxyPayload } from "./onboarding-proxy";

export async function onboardingProxyContext(employeeId: string) {
  const actor = await viewPermissionContext();
  if (!(await canView("system-onboarding", "all", actor.viewer))) throw new OnboardingError("閲覧権限がありません", 403);
  const supabase = getSupabaseAdmin();
  const { data: employee, error } = await supabase.from("root_employees").select("employee_id,name,name_kana,birthday")
    .eq("employee_id", employeeId).is("deleted_at", null).maybeSingle();
  if (error) throw databaseError(error);
  if (!employee) throw new OnboardingError("従業員が見つかりませんでした。", 404);
  return { supabase, employee, actor, sensitive: actor.viewer.role === "super_admin" };
}
type Context = Awaited<ReturnType<typeof onboardingProxyContext>>;

export async function readProxyOnboarding(context: Context): Promise<OnboardingRecord> {
  // 制限される列はDBからも取得しない。扶養家族の番号は返却前に取り除く。
  const columns = Object.keys(proxyPayload(initialInput(context.employee), context.sensitive))
    .filter(key => key !== "nda_agreed").join(",");
  const { data, error } = await context.supabase.from("system_onboarding").select(`${columns},status,nda_agreed_at,submitted_at`)
    .eq("employee_id", context.employee.employee_id).maybeSingle();
  if (error) throw databaseError(error);
  const row = data as unknown as Record<string, unknown> | null;
  if (row?.status === "submitted") throw new OnboardingError("提出ずみの入社手続きは代行入力できません。", 409);
  if (context.sensitive) {
    const record = await readOnboarding(context);
    if (record.status === "submitted") throw new OnboardingError("提出ずみの入社手続きは代行入力できません。", 409);
    return record;
  }
  const values = row ? parseInput({ ...row, nda_agreed: Boolean(row.nda_agreed_at) }) : initialInput(context.employee);
  return { values: parseInput(proxyPayload(values, false)), status: "draft", ndaAgreedAt: typeof row?.nda_agreed_at === "string" ? row.nda_agreed_at : null, submittedAt: null };
}

export async function saveProxyOnboarding(context: Context, input: unknown, submit: boolean, step: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OnboardingError("入力内容を確認してください。", 400);
  if (!context.sensitive && hasProxyPrivateInput(input as Record<string, unknown>)) throw new OnboardingError("この項目は全権管理者だけが代わりに入力できます。", 403);
  if (!Number.isInteger(step) || Number(step) < 0 || Number(step) >= STEPS.length) throw new OnboardingError("画面を確認してください。", 400);
  if (!context.sensitive && [6, 7].includes(Number(step))) throw new OnboardingError("この画面は全権管理者だけが代わりに入力できます", 403);
  let values;
  try { values = parseInput(input); } catch { throw new OnboardingError("入力内容を確認してください。", 400); }
  const payload = proxyPayload(values, context.sensitive);
  // 本人用と同様、空の日付はnullにする。
  for (const key of ["birth_date", "previous_employer_from", "previous_employer_to"] as const) {
    const date = values[key];
    payload[key] = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null;
  }
  const {data:previous,error:previousError} = context.sensitive ? await context.supabase.from('system_onboarding').select('my_number,my_number_secret,dependents').eq('employee_id',context.employee.employee_id).maybeSingle() : {data:null,error:null};
  if(previousError) throw databaseError(previousError);
  const protectedPayload = context.sensitive ? encryptOnboardingNumbers(payload, previous ?? {}) : payload;
  const { error } = await context.supabase.rpc("save_onboarding_proxy", {
    p_employee_id: context.employee.employee_id, p_actor: context.actor.viewer.employeeId,
    p_actor_name: context.actor.name, p_step: Number(step), p_submit: submit, p_sensitive: context.sensitive, p_values: protectedPayload,
  });
  if (error) {
    if (error.code === "P0001") throw new OnboardingError("提出ずみの入社手続きは代行入力できません。", 409);
    throw databaseError(error);
  }
  return { status: submit ? "submitted" : "draft" };
}
