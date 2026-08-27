import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { syncSubmissionToKintone } from "@/app/system/mypage/_lib/submission-kintone.server";
import { generateEmergencyContactPdf } from "@/app/system/mypage/_lib/todoke-generation.server";
import type { SubmissionRow } from "@/app/system/mypage/_lib/submission-types";

const EMPLOYEE_FIELDS =
  "*,root_employees(employee_number,name,kot_employee_id,commute_monthly_cap,company_id)";
export async function GET(request: Request) {
  if (!(await requireManager()))
    return NextResponse.json({ ok: false }, { status: 403 });
  const url = new URL(request.url),
    type = url.searchParams.get("type"),
    status = url.searchParams.get("status");
  let query = getSupabaseAdmin()
    .from("system_mypage_submissions")
    .select(EMPLOYEE_FIELDS)
    .order("created_at", { ascending: false });
  if (type) query = query.eq("submission_type", type);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.limit(200);
  return error
    ? NextResponse.json({ ok: false }, { status: 500 })
    : NextResponse.json({ ok: true, rows: data });
}

export async function PATCH(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  let body: { id?: string; action?: string; oneWay?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("system_mypage_submissions")
    .select(EMPLOYEE_FIELDS)
    .eq("id", body.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  if (
    body.action === "propose" &&
    data.submission_type === "commute_route" &&
    Number.isInteger(body.oneWay) &&
    Number(body.oneWay) >= 0
  ) {
    await admin
      .from("system_mypage_submissions")
      .update({
        status: "awaiting_employee",
        proposed_one_way: body.oneWay,
        handled_by: manager.userId,
      })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "retry_kintone") {
    const sync = await syncSubmissionToKintone(
      data as SubmissionRow,
      data.root_employees,
    );
    await admin
      .from("system_mypage_submissions")
      .update({ kintone_status: sync.status, kintone_note: sync.note })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  if (
    body.action === "retry_pdf" &&
    data.submission_type === "emergency_contact"
  ) {
    const pdf = await generateEmergencyContactPdf(
      data as SubmissionRow,
      {
        name: String(data.root_employees?.name || ""),
        employee_number: String(data.root_employees?.employee_number || ""),
        company_id: data.root_employees?.company_id
          ? String(data.root_employees.company_id)
          : null,
      },
      new Date(data.created_at),
    );
    await admin
      .from("system_mypage_submissions")
      .update({
        pdf_status: pdf.status,
        pdf_drive_file_id: pdf.fileId,
        pdf_drive_url: pdf.url,
        pdf_note: pdf.note,
      })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "advance") {
    const next =
      data.status === "received"
        ? data.submission_type === "commute_route"
          ? "amount_proposing"
          : "in_progress"
        : "completed";
    if (next === "completed" && data.submission_type === "bank_account") {
      const p = data.payload;
      await admin
        .from("bud_employee_bank_accounts")
        .update({
          is_active: false,
          effective_to: new Date().toISOString().slice(0, 10),
        })
        .eq("employee_id", data.employee_id)
        .eq("is_active", true);
      await admin
        .from("bud_employee_bank_accounts")
        .insert({
          employee_id: data.employee_id,
          bank_code: p.bankCode,
          bank_name: p.bankName,
          branch_code: p.branchCode,
          branch_name: p.branchName,
          account_type: "普通",
          account_number: p.accountNumber,
          account_holder_kana: p.holderKana,
          is_active: true,
          effective_from: new Date().toISOString().slice(0, 10),
        });
      const sync = await syncSubmissionToKintone(
        data as SubmissionRow,
        data.root_employees,
      );
      await admin
        .from("system_mypage_submissions")
        .update({
          status: next,
          handled_by: manager.userId,
          handled_at: new Date().toISOString(),
          kintone_status: sync.status,
          kintone_note: sync.note,
        })
        .eq("id", body.id);
      return NextResponse.json({ ok: true });
    }
    await admin
      .from("system_mypage_submissions")
      .update({
        status: next,
        handled_by: manager.userId,
        handled_at: next === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
