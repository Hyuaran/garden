import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { isValidChatworkApiToken } from "@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server";
import { getChatworkMe } from "@/app/system/_lib/chatwork";
import { encryptToken } from "@/app/rill/mail/_lib/token-crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ employeeId: string }>;
};

const FORMAT_ERROR = "Chatwork の API トークンの形ではありません（半角 32 文字）";
const CHATWORK_REJECTED_ERROR = "Chatwork が受け付けませんでした。トークンを確認してください";

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "責任者以上の権限が必要です" },
    { status: 403 },
  );
}

function tokenStatus(row: {
  chatwork_api_token_enc?: string | null;
  chatwork_account_name?: string | null;
  chatwork_token_updated_at?: string | null;
} | null) {
  return {
    registered: Boolean(row?.chatwork_api_token_enc),
    accountName: row?.chatwork_account_name ?? null,
    updatedAt: row?.chatwork_token_updated_at ?? null,
  };
}

async function writeTokenAudit({
  actor,
  employeeId,
  action,
}: {
  actor: Awaited<ReturnType<typeof requireManager>>;
  employeeId: string;
  action: "Chatwork トークン登録" | "Chatwork トークン削除";
}) {
  try {
    await getSupabaseAdmin().from("root_audit_log").insert({
      actor_user_id: actor?.userId ?? null,
      actor_emp_num: actor?.employee_number ?? null,
      action: "master_update",
      target_type: "root_employees",
      target_id: employeeId,
      payload: { action },
    });
  } catch (error) {
    console.error("[root employee chatwork token audit]", error);
  }
}

export async function GET(_request: Request, context: Context) {
  const manager = await requireManager();
  if (!manager) return forbidden();

  const { employeeId } = await context.params;
  const { data, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("chatwork_api_token_enc,chatwork_account_name,chatwork_token_updated_at")
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json(tokenStatus(data));
}

export async function PUT(request: Request, context: Context) {
  const manager = await requireManager();
  if (!manager) return forbidden();

  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!isValidChatworkApiToken(token)) {
    return NextResponse.json({ ok: false, error: FORMAT_ERROR }, { status: 400 });
  }

  let accountName: string;
  try {
    accountName = (await getChatworkMe(token)).name;
  } catch {
    return NextResponse.json({ ok: false, error: CHATWORK_REJECTED_ERROR }, { status: 400 });
  }

  const { employeeId } = await context.params;
  const updatedAt = new Date().toISOString();
  const { error } = await getSupabaseAdmin()
    .from("root_employees")
    .update({
      chatwork_api_token_enc: encryptToken(token),
      chatwork_account_name: accountName,
      chatwork_token_updated_at: updatedAt,
    })
    .eq("employee_id", employeeId);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  await writeTokenAudit({ actor: manager, employeeId, action: "Chatwork トークン登録" });
  return NextResponse.json({ ok: true, accountName, updatedAt });
}

export async function DELETE(_request: Request, context: Context) {
  const manager = await requireManager();
  if (!manager) return forbidden();

  const { employeeId } = await context.params;
  const { error } = await getSupabaseAdmin()
    .from("root_employees")
    .update({
      chatwork_api_token_enc: null,
      chatwork_account_name: null,
      chatwork_token_updated_at: null,
    })
    .eq("employee_id", employeeId);

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  await writeTokenAudit({ actor: manager, employeeId, action: "Chatwork トークン削除" });
  return NextResponse.json({ ok: true });
}
