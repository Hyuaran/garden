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
  storage_path: string | null;
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

export type MobileExpenseAction = "resubmitted" | "not_reimbursable";
export type MobileExpenseFolderKey = "pending" | "approved" | "completed" | "returned" | "not_reimbursable";

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
    .select("id,status,expense_kind,storage_path,drive_file_id,receipt_date,store_name,amount,return_reason,submitted_at,description")
    .eq("applicant_employee_id", employeeId)
    .in("status", RETURNED_STATUSES)
    .order("submitted_at", { ascending: false });

  return (data as MobileExpenseRequest[] | null) ?? [];
}

export async function getMyExpenseRequests(supabase: SupabaseClient, employeeId: string) {
  const { data } = await supabase
    .from("bud_expense_requests")
    .select("id,status,expense_kind,storage_path,drive_file_id,receipt_date,store_name,amount,return_reason,submitted_at,description")
    .eq("applicant_employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(150);

  return (data as MobileExpenseRequest[] | null) ?? [];
}

export async function searchMyExpenseRequests(supabase: SupabaseClient, employeeId: string) {
  const { data } = await supabase
    .from("bud_expense_requests")
    .select("id,status,expense_kind,storage_path,drive_file_id,receipt_date,store_name,amount,submitted_at,description")
    .eq("applicant_employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (data as MobileExpenseRequest[] | null) ?? [];
}

export async function updateReturnedExpenseRequest(
  supabase: SupabaseClient,
  requestId: string,
  employeeId: string,
  action: MobileExpenseAction,
) {
  const nextStatus = action === "resubmitted" ? "submitted" : "not_reimbursable";
  const { error } = await supabase
    .from("bud_expense_requests")
    .update({ status: nextStatus })
    .eq("id", requestId)
    .eq("applicant_employee_id", employeeId)
    .in("status", RETURNED_STATUSES);
  if (error) throw error;

  const moveRes = await fetch("/api/bud/expense-drive/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, action }),
  });
  const moveJson = (await moveRes.json()) as { ok?: boolean; error?: string };
  if (!moveRes.ok || !moveJson.ok) throw new Error(moveJson.error ?? "Drive移動に失敗しました");
}

export function formatYen(value: number | null) {
  if (value == null) return "金額未入力";
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function statusLabel(status: string) {
  if (status === "keiri_returned") return "経理差戻し";
  if (status === "final_returned") return "最終差戻し";
  if (status === "submitted") return "確認待ち";
  if (status === "final_pending") return "1_承認";
  if (status === "journalize_pending") return "2_完了待ち";
  if (status === "journalized") return "2_完了";
  if (status === "not_reimbursable") return "0_精算不可";
  return status;
}

export function folderOfStatus(status: string): MobileExpenseFolderKey {
  if (status === "submitted") return "pending";
  if (status === "final_pending") return "approved";
  if (status === "journalize_pending" || status === "journalized") return "completed";
  if (status === "keiri_returned" || status === "final_returned") return "returned";
  if (status === "not_reimbursable") return "not_reimbursable";
  return "pending";
}
