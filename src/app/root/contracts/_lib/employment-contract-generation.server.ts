import { loadCompanySeal, MISSING_COMPANY_SEAL } from "@/lib/company-seal.server";
import { validateMinimumWage } from "@/lib/minimum-wages.server";
import { saveTodokePdf } from "@/app/system/mypage/_lib/todoke-drive.server";
import { renderEmploymentContractPdf } from "./employment-contract-pdf.server";
import type { ContractEmployee, ContractRow } from "./employment-contract";

export async function generateEmploymentContractPdf(
  row: ContractRow,
  employee: ContractEmployee,
  now = new Date(),
) {
  if (!process.env.GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID)
    return {
      status: "skipped" as const,
      fileId: null,
      url: null,
      note: "届出PDF保存先が未設定のためスキップ",
    };
  try {
    const invalid = await validateMinimumWage(row.payload);
    if (invalid) throw new Error(invalid);
    const company = Array.isArray(employee.root_companies)
      ? employee.root_companies[0]
      : employee.root_companies;
    if (!company?.address?.trim())
      throw new Error(
        "会社マスタに住所が未登録です。Root＞会社 で住所を登録してください",
      );
    const companySeal = await loadCompanySeal(employee.company_id);
    const buffer = await renderEmploymentContractPdf({
      ...row.payload,
      companySeal,
      employeeName: employee.name,
      companyName: company.company_name,
      representative: company.representative,
      companyAddress: company.address,
    });
    const result = await saveTodokePdf(
      Buffer.from(buffer),
      employee.employee_number,
      employee.name,
      "雇用契約書",
      now,
    );
    return {...result, note: [result.note, !companySeal ? MISSING_COMPANY_SEAL : null].filter(Boolean).join(" / ") || null};
  } catch (error) {
    return {
      status: "failed" as const,
      fileId: null,
      url: null,
      note: `雇用契約書PDF生成・保存失敗: ${error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)}`,
    };
  }
}
