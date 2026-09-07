import { NextResponse } from "next/server";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { getSingleTokenSyncReason, syncChatworkTokens } from "@/app/system/payroll-notice/_lib/chatwork-token-sync.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function readTokenStatus(employeeId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("chatwork_api_token_enc,chatwork_account_name")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) throw new Error("Chatwork 登録状況を読めませんでした");
  return {
    registered: Boolean(data?.chatwork_api_token_enc),
    accountName: data?.chatwork_account_name ? String(data.chatwork_account_name) : null,
  };
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });

  const current = await readTokenStatus(String(staff.employee_id));
  if (current.registered) return NextResponse.json({ ok: true, ...current });

  if (!staff.kot_employee_id) {
    return NextResponse.json({ ok: true, registered: false, reason: "Root に打刻 ID なし" });
  }

  const syncResult = await syncChatworkTokens({ kotEmployeeId: String(staff.kot_employee_id) });
  const next = await readTokenStatus(String(staff.employee_id));
  if (next.registered) return NextResponse.json({ ok: true, ...next });

  return NextResponse.json({
    ok: true,
    registered: false,
    reason: getSingleTokenSyncReason(syncResult),
  });
}
