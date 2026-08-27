import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  renderEmergencyContactPdf,
  type EmergencyContactPdfData,
} from "./todoke-pdf.server";
import { saveTodokePdf } from "./todoke-drive.server";
import type { SubmissionRow } from "./submission-types";

export async function generateEmergencyContactPdf(
  row: SubmissionRow,
  employee: { name: string; employee_number: string; company_id: string | null },
  now = new Date(),
) {
  if (row.submission_type !== "emergency_contact")
    return {
      status: "not_applicable" as const,
      fileId: null,
      url: null,
      note: null,
    };
  if (!process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID)
    return {
      status: "skipped" as const,
      fileId: null,
      url: null,
      note: "届出PDF保存先が未設定のためスキップ",
    };
  try {
    const { data: company, error } = await getSupabaseAdmin()
      .from("root_companies")
      .select("company_name,representative,address")
      .eq("company_id", employee.company_id)
      .maybeSingle();
    if (error || !company) throw new Error("所属会社を取得できませんでした");
    const p = row.payload;
    const pdfData: EmergencyContactPdfData = {
      companyName: String(company.company_name),
      representative: String(company.representative),
      kind: p.kind === "change" ? "change" : "new",
      employeeName: employee.name,
      selfAddress: String(p.selfAddress),
      selfPhone: String(p.selfPhone),
      ecName: String(p.ecName),
      ecRelationship: String(p.ecRelationship),
      ecAddress: String(p.ecAddress),
      ecPhone: String(p.ecPhone),
      submittedAt: now,
    };
    const buffer = await renderEmergencyContactPdf(pdfData);
    return saveTodokePdf(
      Buffer.from(buffer),
      employee.employee_number,
      employee.name,
      now,
    );
  } catch (error) {
    return {
      status: "failed" as const,
      fileId: null,
      url: null,
      note: `届出PDF生成・保存失敗: ${error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)}`,
    };
  }
}
