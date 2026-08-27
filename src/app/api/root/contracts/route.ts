import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { generateEmploymentContractPdf } from "@/app/root/contracts/_lib/employment-contract-generation.server";
import {
  validateContract,
  type ContractEmployee,
  type ContractRow,
  type EmploymentContractPayload,
} from "@/app/root/contracts/_lib/employment-contract";
const EMPLOYEE_SELECT =
  "employee_id,employee_number,name,company_id,employment_type,is_active,root_companies(company_name,representative,address)";
export async function GET() {
  if (!(await requireManager()))
    return NextResponse.json({ ok: false }, { status: 403 });
  const admin = getSupabaseAdmin();
  const [{ data: employees, error: e1 }, { data: rows, error: e2 }] =
    await Promise.all([
      admin
        .from("root_employees")
        .select(EMPLOYEE_SELECT)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("employee_number"),
      admin
        .from("system_employment_contracts")
        .select(
          `*,root_employees(${EMPLOYEE_SELECT.replace("root_companies(company_name,representative,address)", "root_companies(company_name)")})`,
        )
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
  return e1 || e2
    ? NextResponse.json(
        { ok: false, error: "読み込めませんでした。" },
        { status: 500 },
      )
    : NextResponse.json({ ok: true, employees, rows });
}
export async function POST(request: Request) {
  if (!(await requireManager()))
    return NextResponse.json({ ok: false }, { status: 403 });
  let body: { employee_id?: string; payload?: EmploymentContractPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "入力内容を確認してください。" },
      { status: 400 },
    );
  }
  const validation = validateContract(
    String(body.employee_id ?? ""),
    body.payload ?? {},
  );
  if (validation)
    return NextResponse.json({ ok: false, error: validation }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: employee } = await admin
    .from("root_employees")
    .select(EMPLOYEE_SELECT)
    .eq("employee_id", body.employee_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee)
    return NextResponse.json(
      { ok: false, error: "在籍従業員を選択してください。" },
      { status: 400 },
    );
  const company = Array.isArray(employee.root_companies)
    ? employee.root_companies[0]
    : employee.root_companies;
  if (!String(company?.address ?? "").trim())
    return NextResponse.json(
      {
        ok: false,
        error:
          "会社マスタに住所が未登録です。Root＞会社 で住所を登録してください",
      },
      { status: 400 },
    );
  const { data, error } = await admin
    .from("system_employment_contracts")
    .insert({
      employee_id: body.employee_id,
      payload: body.payload,
      pdf_status: "skipped",
    })
    .select("*")
    .single();
  if (error)
    return NextResponse.json(
      { ok: false, error: "発行できませんでした。" },
      { status: 500 },
    );
  const pdf = await generateEmploymentContractPdf(
    data as ContractRow,
    { ...employee, root_companies: company } as unknown as ContractEmployee,
    new Date(data.created_at),
  );
  await admin
    .from("system_employment_contracts")
    .update({
      pdf_status: pdf.status,
      pdf_drive_file_id: pdf.fileId,
      pdf_drive_url: pdf.url,
      pdf_note: pdf.note,
    })
    .eq("id", data.id);
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
export async function PATCH(request: Request) {
  if (!(await requireManager()))
    return NextResponse.json({ ok: false }, { status: 403 });
  const { id } = (await request.json()) as { id?: string };
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("system_employment_contracts")
    .select(`*,root_employees(${EMPLOYEE_SELECT})`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false }, { status: 404 });
  const pdf = await generateEmploymentContractPdf(
    data as ContractRow,
    data.root_employees as ContractEmployee,
    new Date(data.created_at),
  );
  await admin
    .from("system_employment_contracts")
    .update({
      pdf_status: pdf.status,
      pdf_drive_file_id: pdf.fileId,
      pdf_drive_url: pdf.url,
      pdf_note: pdf.note,
    })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
