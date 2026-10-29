import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { SUBMISSION_LABELS, validateSubmission, type SubmissionRow, type SubmissionType } from "./submission-types";
import { generateSubmissionPdf } from "./todoke-generation.server";
export async function createSubmission(employee: {employee_id: string; name: string; employee_number: string; company_id?: string | null}, body: {type?: SubmissionType; payload?: Record<string, unknown>} | null) {
 if (!body) return NextResponse.json({ok:false, error:"入力内容を確認してください。"}, {status:400});
  if (!body.type || !(Object.hasOwn(SUBMISSION_LABELS, body.type)) || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload))
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
        ["emergency_contact", "nda"].includes(body.type) ? "skipped" : "not_applicable",
    })
    .select("*")
    .single();
  if (dbError)
    return NextResponse.json(
      { ok: false, error: "送信できませんでした。" },
      { status: 500 },
    );
  if (["emergency_contact", "nda"].includes(body.type)) {
    const pdf = await generateSubmissionPdf(
      data as SubmissionRow,
      {
        name: String(employee.name),
        employee_number: String(employee.employee_number),
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
  return NextResponse.json({ ok: true, id: data.id, row: { id: data.id, submission_type: data.submission_type, status: data.status, created_at: data.created_at } }, { status: 201 });
}
