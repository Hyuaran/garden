import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fuyouPdfFilename } from "./fuyou-pdf";
import { buildFuyouPdf, type FuyouCompany } from "./fuyou-pdf.server";
import { saveFuyouPdfToDrive } from "./fuyou-drive.server";
import { databaseError, OnboardingError } from "./onboarding.server";
import { readAdminOnboardingDetailForFuyou, type AdminContext } from "./onboarding-admin.server";

const FUYOU_TEMPLATE_BUCKET = "system-docs";
const FUYOU_TEMPLATE_PATH = "forms/reiwa8-fuyou.pdf";

type SaveResult = Awaited<ReturnType<typeof saveFuyouPdfToDrive>>;

type FuyouDeps = {
  buildPdf?: typeof buildFuyouPdf;
  savePdf?: (filename: string, content: Buffer) => Promise<SaveResult>;
};

async function readFuyouCompany(context: AdminContext, companyId: string | null): Promise<FuyouCompany> {
  if (!companyId) throw new OnboardingError("扶養控除申告書を作るための情報が不足しています。入力内容を確認してください。", 409);
  const { data, error } = await context.supabase
    .from("root_companies")
    .select("company_name,corporate_number,address")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new OnboardingError("扶養控除申告書を作るための情報が不足しています。入力内容を確認してください。", 409);
  return {
    company_name: String(data.company_name ?? ""),
    corporate_number: data.corporate_number == null ? null : String(data.corporate_number),
    address: data.address == null ? null : String(data.address),
  };
}

async function readFuyouTemplate() {
  // 用紙は非公開の保管庫にあるため、写真や動画と同じく管理者側の接続で読む。
  const { data, error } = await getSupabaseAdmin().storage.from(FUYOU_TEMPLATE_BUCKET).download(FUYOU_TEMPLATE_PATH);
  if (error || !data) throw new OnboardingError("扶養控除申告書の用紙を読み込めませんでした。管理者へお問い合わせください。", 503);
  return new Uint8Array(await data.arrayBuffer());
}

export async function createAndSaveFuyouPdf(context: AdminContext, employeeId: string, deps: FuyouDeps = {}) {
  const record = await readAdminOnboardingDetailForFuyou(context, employeeId);
  if (!record) throw new OnboardingError("入社手続きの入力が見つかりませんでした。", 404);
  const company = await readFuyouCompany(context, record.employee.company_id);
  const filename = fuyouPdfFilename(record.values.name || record.employee.name || employeeId);
  const pdf = await (deps.buildPdf ?? buildFuyouPdf)(await readFuyouTemplate(), { company, values: record.values });
  return (deps.savePdf ?? saveFuyouPdfToDrive)(filename, pdf);
}
