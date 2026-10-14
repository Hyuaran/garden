import { syncChatworkTokens } from "@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const TOKEN_MISSING_MESSAGE = "Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください";

export type OwnChatworkTokenEmployee = {
  employee_id: string;
  kot_employee_id: string | null;
};

async function readOwnToken(employeeId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("chatwork_api_token_enc,chatwork_account_name")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error("Chatwork 登録状況を読めませんでした");
  return {
    tokenEnc: data?.chatwork_api_token_enc ? String(data.chatwork_api_token_enc) : null,
    accountName: data?.chatwork_account_name ? String(data.chatwork_account_name) : null,
  };
}

export async function ensureOwnChatworkToken(employee: OwnChatworkTokenEmployee) {
  let token = await readOwnToken(employee.employee_id);
  if (token.tokenEnc || !employee.kot_employee_id) return token;
  await syncChatworkTokens({ kotEmployeeId: employee.kot_employee_id });
  token = await readOwnToken(employee.employee_id);
  return token;
}
