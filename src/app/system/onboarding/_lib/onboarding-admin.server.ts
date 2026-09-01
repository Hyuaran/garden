import "server-only";
import { createServerClient } from "@/app/_lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MANAGER_ROLES } from "@/app/system/_lib/attendance";
import { databaseError, OnboardingError, ONBOARDING_COLUMNS } from "./onboarding.server";
import { maskMyNumber, parseInput, parseNullableAmount } from "./onboarding";
import { adminInputFromRow, buildAdminList, initialAdminRecord, parseAdminEmailInput, parseAdminInput, type AdminInput, type AdminListItem, type AdminOnboardingRecord } from "./onboarding-admin";

const ADMIN_ONBOARDING_COLUMNS = `employee_id,${ONBOARDING_COLUMNS},office,weekly_hours,health_insurance,pension_insurance,employment_insurance,tax_class,salary_kind,base_salary,allowances,commute_fixed_monthly,commute_cap_monthly,admin_updated_at`;
const EMPLOYEE_COLUMNS = "employee_id,name,hire_date,birthday,company_id";

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;
export type AdminContext = { supabase: SupabaseClient; managerEmployeeId: string };

export async function onboardingAdminContext(): Promise<AdminContext> {
  const supabase = await createServerClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) throw new OnboardingError("ログインし直してください。", 401);
  const { data: employee, error: employeeError } = await supabase.from("root_employees").select("employee_id,garden_role")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (employeeError || !employee || !MANAGER_ROLES.has(String(employee.garden_role))) throw new OnboardingError("閲覧権限がありません", 403);
  return { supabase, managerEmployeeId: String(employee.employee_id) };
}

async function readEmployees(employeeIds: string[]) {
  if (!employeeIds.length) return new Map<string, { employee_id: string; name: string | null; hire_date: string | null; birthday: string | null; company_id: string | null }>();
  const { data, error } = await getSupabaseAdmin().from("root_employees").select(EMPLOYEE_COLUMNS).in("employee_id", employeeIds).is("deleted_at", null);
  if (error) throw databaseError(error);
  return new Map(((data ?? []) as Array<{ employee_id: string; name: string | null; hire_date: string | null; birthday: string | null; company_id: string | null }>).map(employee => [employee.employee_id, employee]));
}

function maskDependentMyNumbers(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const row = item as Record<string, unknown>;
    return { ...row, my_number: maskMyNumber(String(row.my_number ?? "")) };
  });
}

function recordFromRow(row: Record<string, unknown>, employee: { employee_id: string; name: string | null; hire_date: string | null; birthday: string | null; company_id: string | null }, options: { maskMyNumbers?: boolean } = {}): AdminOnboardingRecord {
  const shouldMask = options.maskMyNumbers !== false;
  const values = parseInput({
    ...row,
    my_number: shouldMask ? maskMyNumber(String(row.my_number ?? "")) : row.my_number,
    dependents: shouldMask ? maskDependentMyNumbers(row.dependents) : row.dependents,
    nda_agreed: Boolean(row.nda_agreed_at),
  });
  const status = row.status === "submitted" ? "submitted" : "draft";
  const adminUpdatedAt = typeof row.admin_updated_at === "string" ? row.admin_updated_at : null;
  return {
    employee,
    values,
    status,
    submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
    admin: adminInputFromRow({ ...row, admin_updated_at: adminUpdatedAt }, values),
    adminUpdatedAt,
  };
}

export async function readAdminOnboardingList(context: AdminContext): Promise<AdminListItem[]> {
  const { data, error } = await context.supabase.from("system_onboarding").select(ADMIN_ONBOARDING_COLUMNS);
  if (error) throw databaseError(error);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const employees = await readEmployees(rows.map(row => String(row.employee_id ?? "")).filter(Boolean));
  const records = rows.map(row => {
    const employeeId = String(row.employee_id ?? "");
    return recordFromRow(row, employees.get(employeeId) ?? { employee_id: employeeId, name: null, hire_date: null, birthday: null, company_id: null });
  });
  return buildAdminList(records);
}

export async function readAdminOnboardingDetail(context: AdminContext, employeeId: string): Promise<AdminOnboardingRecord | null> {
  const { data, error } = await context.supabase.from("system_onboarding").select(ADMIN_ONBOARDING_COLUMNS).eq("employee_id", employeeId).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return null;
  const employees = await readEmployees([employeeId]);
  return recordFromRow(data as unknown as Record<string, unknown>, employees.get(employeeId) ?? { employee_id: employeeId, name: null, hire_date: null, birthday: null, company_id: null });
}

export async function readAdminOnboardingDetailForFuyou(context: AdminContext, employeeId: string): Promise<AdminOnboardingRecord | null> {
  const { data, error } = await context.supabase.from("system_onboarding").select(ADMIN_ONBOARDING_COLUMNS).eq("employee_id", employeeId).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) return null;
  const employees = await readEmployees([employeeId]);
  return recordFromRow(data as unknown as Record<string, unknown>, employees.get(employeeId) ?? { employee_id: employeeId, name: null, hire_date: null, birthday: null, company_id: null }, { maskMyNumbers: false });
}

export async function saveAdminOnboarding(context: AdminContext, employeeId: string, input: unknown): Promise<AdminInput> {
  let admin;
  try { admin = parseAdminInput(input); } catch { throw new OnboardingError("入力内容を読み取れませんでした。ページを開き直してください。", 400); }
  const payload = { ...admin, employee_id: employeeId, admin_updated_at: new Date().toISOString() };
  const { error } = await context.supabase.from("system_onboarding").update(payload).eq("employee_id", employeeId);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") throw databaseError(error);
    throw new OnboardingError("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。", 503);
  }
  return admin;
}

export async function saveAdminOnboardingEmail(context: AdminContext, employeeId: string, input: unknown) {
  let parsed;
  try { parsed = parseAdminEmailInput(input); } catch { throw new OnboardingError("入力内容を読み取れませんでした。ページを開き直してください。", 400); }
  const { error } = await context.supabase.from("system_onboarding").update({ email: parsed.email }).eq("employee_id", employeeId);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") throw databaseError(error);
    throw new OnboardingError("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。", 503);
  }
  return parsed;
}

function numericText(value: string) {
  return parseNullableAmount(value);
}

function insuranceType(admin: AdminInput) {
  const entries = [admin.health_insurance, admin.pension_insurance, admin.employment_insurance].filter(Boolean);
  if (!entries.length) return null;
  if (entries.every(value => value === "加入")) return "加入";
  if (entries.every(value => value === "未加入")) return "未加入";
  return "一部加入";
}

export async function applyAdminOnboarding(context: AdminContext, employeeId: string, input: unknown) {
  const admin = await saveAdminOnboarding(context, employeeId, input);
  const record = await readAdminOnboardingDetail(context, employeeId);
  if (!record) throw new OnboardingError("入社手続きの入力が見つかりませんでした。", 404);
  const update: Record<string, unknown> = {};
  if (record.values.birth_date) update.birthday = record.values.birth_date;
  update.dependents_count = record.values.dependents.length;
  if (admin.tax_class) update.kou_otsu = admin.tax_class === "甲" ? "kou" : "otsu";
  const insurance = insuranceType(admin);
  if (insurance) update.insurance_type = insurance;
  const cap = numericText(admin.commute_cap_monthly);
  if (cap != null) update.commute_monthly_cap = cap;
  const fixed = numericText(admin.commute_fixed_monthly);
  if (fixed != null) update.commute_daily_allowance = Math.round(fixed / 20);
  if (!Object.keys(update).length) return;
  const { error } = await context.supabase.from("root_employees").update(update).eq("employee_id", employeeId);
  if (error) throw new OnboardingError("従業員台帳に反映できませんでした。時間をおいて、もう一度お試しください。", 503);
}

export async function readMyNumberForAdmin(context: AdminContext, employeeId: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OnboardingError("表示する項目を確認してください。", 400);
  const body = input as Record<string, unknown>;
  const kind = body.kind === "dependent" ? "dependent" : body.kind === "self" ? "self" : "";
  if (!kind) throw new OnboardingError("表示する項目を確認してください。", 400);
  const { data, error } = await context.supabase.from("system_onboarding").select("my_number,dependents").eq("employee_id", employeeId).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new OnboardingError("入社手続きの入力が見つかりませんでした。", 404);
  const row = data as Record<string, unknown>;
  const payload: Record<string, unknown> = { kind };
  let value = "";
  if (kind === "self") {
    value = typeof row.my_number === "string" ? row.my_number : "";
  } else {
    const index = typeof body.index === "number" && Number.isInteger(body.index) ? body.index : -1;
    const dependents = Array.isArray(row.dependents) ? row.dependents : [];
    const dependent = dependents[index];
    if (!dependent || typeof dependent !== "object" || Array.isArray(dependent)) throw new OnboardingError("表示する項目を確認してください。", 400);
    value = typeof (dependent as Record<string, unknown>).my_number === "string" ? String((dependent as Record<string, unknown>).my_number) : "";
    payload.index = index + 1;
  }
  try {
    const { error: auditError } = await context.supabase.from("root_audit_log").insert({
      actor_emp_num: context.managerEmployeeId,
      action: "my_number_view",
      target_type: "system_onboarding",
      target_id: employeeId,
      payload,
    });
    if (auditError) console.error("[my_number_view audit]", auditError.message);
  } catch (error) {
    console.error("[my_number_view audit] unexpected", error);
  }
  return { myNumber: /^[0-9]{12}$/.test(value) ? value : "" };
}

export function missingAdminRecord(employeeId: string) {
  return initialAdminRecord(employeeId);
}
