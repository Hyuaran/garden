import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import {
  SUBMISSION_LABELS,
  validateSubmission,
  type SubmissionRow,
  type SubmissionType,
} from "@/app/system/mypage/_lib/submission-types";
import { generateEmergencyContactPdf } from "@/app/system/mypage/_lib/todoke-generation.server";

export async function GET() {
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_mypage_submissions")
    .select("id,submission_type,payload,status,proposed_one_way,created_at")
    .eq("employee_id", employee.employee_id)
    .order("created_at", { ascending: false })
    .limit(30);
  return error
    ? NextResponse.json({ ok: false }, { status: 500 })
    : NextResponse.json({ ok: true, rows: data });
}

export async function POST(request: Request) {
  const employee = await requireEmployee();
  if (!employee) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { type?: SubmissionType; payload?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "入力内容を確認してください。" },
      { status: 400 },
    );
  }
  if (!body.type || !(body.type in SUBMISSION_LABELS) || !body.payload)
    return NextResponse.json(
      { ok: false, error: "届出の種類を確認してください。" },
      { status: 400 },
    );
  const error = validateSubmission(body.type, body.payload);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  const payload = {
    ...body.payload,
    ...(body.type === "nda" ? { signedAt: new Date().toISOString() } : {}),
  };
  const admin = getSupabaseAdmin();
  const { data, error: dbError } = await admin
    .from("system_mypage_submissions")
    .insert({
      employee_id: employee.employee_id,
      submission_type: body.type,
      payload,
      status: "received",
      kintone_status: ["commute_route", "bank_account"].includes(body.type)
        ? "pending"
        : "not_applicable",
      pdf_status:
        body.type === "emergency_contact" ? "skipped" : "not_applicable",
    })
    .select("*")
    .single();
  if (dbError)
    return NextResponse.json(
      { ok: false, error: "送信できませんでした。" },
      { status: 500 },
    );
  if (body.type === "emergency_contact") {
    const pdf = await generateEmergencyContactPdf(
      data as SubmissionRow,
      {
        name: String(employee.name),
        company_id: employee.company_id ? String(employee.company_id) : null,
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
      .eq("id", data.id);
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
