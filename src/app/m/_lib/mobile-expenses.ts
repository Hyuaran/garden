import type { SupabaseClient } from "@supabase/supabase-js";

export type MobileEmployee = {
  employee_id: string;
  employee_number: string | null;
  name: string | null;
  garden_role: string | null;
};

export type MobileExpenseRequest = {
  id: string;
  status: string;
  expense_kind: string;
  drive_file_id: string | null;
  receipt_date: string | null;
  store_name: string | null;
  amount: number | null;
  return_reason: string | null;
  submitted_at: string;
  description: string | null;
};

export type MobileTodoCounts = {
  returned: number;
  submitted: number;
  finalPending: number;
  budAccess: boolean;
};

const RETURNED_STATUSES = ["keiri_returned", "final_returned"];

export async function getMyEmployee(supabase: SupabaseClient): Promise<MobileEmployee | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { data } = await supabase
    .from("root_employees")
    .select("employee_id,employee_number,name,garden_role")
    .eq("user_id", uid)
    .maybeSingle<MobileEmployee>();

  return data ?? null;
}

export async function getMobileTodoCounts(supabase: SupabaseClient): Promise<MobileTodoCounts> {
  const employee = await getMyEmployee(supabase);
  const { data: budAccessData } = await supabase.rpc("bud_has_access");
  const budAccess = Boolean(budAccessData);

  const returnedPromise = employee
    ? supabase
        .from("bud_expense_requests")
        .select("id", { count: "exact", head: true })
        .eq("applicant_employee_id", employee.employee_id)
        .in("status", RETURNED_STATUSES)
    : Promise.resolve({ count: 0 });

  const submittedPromise = budAccess
    ? supabase.from("bud_expense_requests").select("id", { count: "exact", head: true }).eq("status", "submitted")
    : Promise.resolve({ count: 0 });

  const finalPromise = budAccess
    ? supabase.from("bud_expense_requests").select("id", { count: "exact", head: true }).eq("status", "final_pending")
    : Promise.resolve({ count: 0 });

  const [returned, submitted, finalPending] = await Promise.all([returnedPromise, submittedPromise, finalPromise]);

  return {
    returned: returned.count ?? 0,
    submitted: submitted.count ?? 0,
    finalPending: finalPending.count ?? 0,
    budAccess,
  };
}

export async function getReturnedExpenseRequests(supabase: SupabaseClient, employeeId: string) {
  const { data } = await supabase
    .from("bud_expense_requests")
    .select("id,status,expense_kind,drive_file_id,receipt_date,store_name,amount,return_reason,submitted_at,description")
    .eq("applicant_employee_id", employeeId)
    .in("status", RETURNED_STATUSES)
    .order("submitted_at", { ascending: false });

  return (data as MobileExpenseRequest[] | null) ?? [];
}

export async function searchMyExpenseRequests(supabase: SupabaseClient, employeeId: string) {
  const { data } = await supabase
    .from("bud_expense_requests")
    .select("id,status,expense_kind,receipt_date,store_name,amount,submitted_at,description")
    .eq("applicant_employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (data as MobileExpenseRequest[] | null) ?? [];
}

export function formatYen(value: number | null) {
  if (value == null) return "金額未入力";
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function statusLabel(status: string) {
  if (status === "keiri_returned") return "経理差戻し";
  if (status === "final_returned") return "最終差戻し";
  if (status === "submitted") return "承認待ち";
  if (status === "final_pending") return "完了待ち";
  if (status === "journalize_pending") return "仕訳化待ち";
  if (status === "journalized") return "完了";
  if (status === "not_reimbursable") return "精算不可";
  return status;
}
