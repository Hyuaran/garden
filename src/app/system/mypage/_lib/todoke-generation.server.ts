import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  renderEmergencyContactPdf,
  renderNdaPdf,
  type EmergencyContactPdfData,
  type NdaPdfData,
} from "./todoke-pdf.server";
import { saveTodokePdf } from "./todoke-drive.server";
import type { SubmissionRow } from "./submission-types";

export async function generateSubmissionPdf(
  row: SubmissionRow,
  employee: {
    name: string;
    employee_number: string;
    company_id: string | null;
  },
  now = new Date(),
) {
  if (!["emergency_contact", "nda"].includes(row.submission_type))
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
    let buffer: Buffer;
    let documentName: "緊急連絡先届" | "秘密保持誓約書";
    if (row.submission_type === "emergency_contact") {
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
      buffer = Buffer.from(await renderEmergencyContactPdf(pdfData));
      documentName = "緊急連絡先届";
    } else {
      const pdfData: NdaPdfData = {
        companyName: String(company.company_name),
        representative: String(company.representative),
        kind: p.kind === "resubmit" ? "resubmit" : "new",
        employeeName: employee.name,
        pledgeDate: String(p.pledgeDate),
        address: String(p.address),
      };
      buffer = Buffer.from(await renderNdaPdf(pdfData));
      documentName = "秘密保持誓約書";
    }
    return saveTodokePdf(
      buffer,
      employee.employee_number,
      employee.name,
      documentName,
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

export const generateEmergencyContactPdf = generateSubmissionPdf;
