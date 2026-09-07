import { NextResponse } from "next/server";
import { decryptToken } from "@/app/rill/mail/_lib/token-crypto";
import { sendChatworkMessageWithToken } from "@/app/system/_lib/chatwork";
import { requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { syncChatworkTokens } from "@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server";
import {
  buildPayrollNoticeMessage,
  normalizePayrollNoticeInput,
  summarizeFlag,
  validatePayrollNotice,
  type PayrollNoticeInput,
} from "@/app/system/forms/payroll-notice/_lib/payroll-notice";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN_MISSING_MESSAGE = "Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください";
const CHATWORK_FAILED_MESSAGE = "Chatwork に送れませんでした。記録は残っています。管理者へ問い合わせてください";

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

async function ensureOwnToken(employee: { employee_id: string; kot_employee_id: string | null }) {
  let token = await readOwnToken(employee.employee_id);
  if (token.tokenEnc || !employee.kot_employee_id) return token;
  await syncChatworkTokens({ kotEmployeeId: employee.kot_employee_id });
  token = await readOwnToken(employee.employee_id);
  return token;
}

function roomId() {
  return process.env.PAYROLL_NOTICE_CHATWORK_ROOM_ID || process.env.CHATWORK_DEV_ROOM_ID || "";
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const { data, error } = await getSupabaseAdmin()
    .from("root_payroll_notice")
    .select("id,submitted_at,submitter_name,team,commute_flag,commute_people,training_flag,training_people,referral_flag,referral_people,chatwork_message,chatwork_room_id,chatwork_sent_at,chatwork_message_id,chatwork_error")
    .order("submitted_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: "送信履歴を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, notices: data ?? [] });
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => null) as Partial<PayrollNoticeInput> | null;
  const input = normalizePayrollNoticeInput(body ?? {});
  const errors = validatePayrollNotice(input);
  if (errors.length > 0) return NextResponse.json({ ok: false, errors }, { status: 400 });

  const token = await ensureOwnToken({
    employee_id: String(staff.employee_id),
    kot_employee_id: staff.kot_employee_id ? String(staff.kot_employee_id) : null,
  });
  if (!token.tokenEnc) {
    return NextResponse.json({ ok: false, error: TOKEN_MISSING_MESSAGE }, { status: 400 });
  }

  const submittedAt = new Date();
  const message = buildPayrollNoticeMessage({
    ...input,
    submitterName: String(staff.name),
    submittedAt,
  });

  const admin = getSupabaseAdmin();
  const { data: inserted, error: insertError } = await admin
    .from("root_payroll_notice")
    .insert({
      submitted_by: staff.userId,
      submitter_name: String(staff.name),
      team: input.team,
      commute_flag: input.commuteFlag,
      commute_people: input.commutePeople,
      training_flag: input.trainingFlag,
      training_people: input.trainingPeople,
      referral_flag: input.referralFlag,
      referral_people: input.referralPeople,
      other_notes: input.otherNotes,
      chatwork_message: message,
    })
    .select("id,submitted_at")
    .single();
  if (insertError || !inserted) return NextResponse.json({ ok: false, error: "記録を保存できませんでした" }, { status: 500 });

  const targetRoomId = roomId();
  try {
    const sendResult = await sendChatworkMessageWithToken({
      token: decryptToken(token.tokenEnc),
      roomId: targetRoomId,
      text: message,
    });
    await admin
      .from("root_payroll_notice")
      .update({
        chatwork_sent_at: new Date().toISOString(),
        chatwork_message_id: sendResult.messageId,
        chatwork_room_id: sendResult.roomId,
        chatwork_error: null,
      })
      .eq("id", inserted.id);
    return NextResponse.json({
      ok: true,
      notice: {
        id: inserted.id,
        submittedAt: inserted.submitted_at,
        team: input.team,
        submitterName: String(staff.name),
        accountName: token.accountName,
        commute: summarizeFlag(input.commuteFlag, input.commutePeople.length),
        training: summarizeFlag(input.trainingFlag, input.trainingPeople.length),
        referral: summarizeFlag(input.referralFlag, input.referralPeople.length),
      },
    });
  } catch (error) {
    console.error("[payroll-notice.chatwork]", error instanceof Error ? error.message : String(error));
    await admin
      .from("root_payroll_notice")
      .update({
        chatwork_room_id: targetRoomId || null,
        chatwork_error: "Chatwork API request failed",
      })
      .eq("id", inserted.id);
    return NextResponse.json({ ok: false, error: CHATWORK_FAILED_MESSAGE }, { status: 502 });
  }
}
