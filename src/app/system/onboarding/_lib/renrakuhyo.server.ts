import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { databaseError, OnboardingError } from "./onboarding.server";
import { readAdminOnboardingDetailForFuyou, type AdminContext } from "./onboarding-admin.server";
import { buildRenrakuhyoValues, RENRAKUHYO_EXCEL_CELLS, RENRAKUHYO_PDF_FIELDS, renrakuhyoBaseName, renrakuhyoPdfText, type RenrakuhyoCompany, type RenrakuhyoValues } from "./renrakuhyo";
import { saveRenrakuhyoToDrive } from "./renrakuhyo-drive.server";

const TEMPLATE_BUCKET = "system-docs";
const EXCEL_TEMPLATE_PATH = "forms/tlcc-nyusha-renrakuhyo.xlsx";
const PDF_TEMPLATE_PATH = "forms/tlcc-nyusha-renrakuhyo.pdf";
const PDF_PAGE_HEIGHT = 841.9;
const PDF_FONT_SIZE = 9;

type SaveResult = Awaited<ReturnType<typeof saveRenrakuhyoToDrive>>;

type RenrakuhyoDeps = {
  buildExcel?: typeof buildRenrakuhyoExcel;
  buildPdf?: typeof buildRenrakuhyoPdf;
  saveFiles?: (files: { xlsx: { filename: string; content: Buffer }; pdf: { filename: string; content: Buffer } }) => Promise<SaveResult>;
};

async function readCompany(context: AdminContext, companyId: string | null): Promise<RenrakuhyoCompany> {
  if (!companyId) throw new OnboardingError("入社連絡表を作るための情報が不足しています。入力内容を確認してください。", 409);
  const { data, error } = await context.supabase
    .from("root_companies")
    .select("company_name")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new OnboardingError("入社連絡表を作るための情報が不足しています。入力内容を確認してください。", 409);
  return { company_name: String((data as Record<string, unknown>).company_name ?? "") };
}

async function readTemplate(pathname: string) {
  const { data, error } = await getSupabaseAdmin().storage.from(TEMPLATE_BUCKET).download(pathname);
  if (error || !data) throw new OnboardingError("保存先のフォルダに書き込めませんでした。", 503);
  return new Uint8Array(await data.arrayBuffer());
}

export async function buildRenrakuhyoExcel(template: Uint8Array, values: RenrakuhyoValues) {
  const workbook = new ExcelJS.Workbook();
  const data = Buffer.from(template) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(data);
  const worksheet = workbook.getWorksheet("記入用");
  if (!worksheet) throw new OnboardingError("入社連絡表を作るための情報が不足しています。入力内容を確認してください。", 409);
  for (const [key, cell] of Object.entries(RENRAKUHYO_EXCEL_CELLS) as Array<[keyof RenrakuhyoValues, string]>) {
    worksheet.getCell(cell).value = values[key];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function drawText(page: ReturnType<PDFDocument["getPages"]>[number], font: PDFFont, item: (typeof RENRAKUHYO_PDF_FIELDS)[number], text: string) {
  if (!text) return;
  const size = item.size ?? PDF_FONT_SIZE;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: item.align === "center" ? item.x - width / 2 : item.x,
    y: PDF_PAGE_HEIGHT - item.y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function buildRenrakuhyoPdf(template: Uint8Array, values: RenrakuhyoValues) {
  const pdf = await PDFDocument.load(template);
  pdf.registerFontkit((fontkit as unknown as { default?: typeof fontkit }).default ?? fontkit);
  const font = await pdf.embedFont(
    new Uint8Array(await readFile(path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf"))),
    { subset: false },
  );
  const page = pdf.getPages()[0];
  if (!page) throw new OnboardingError("入社連絡表を作るための情報が不足しています。入力内容を確認してください。", 409);
  for (const item of RENRAKUHYO_PDF_FIELDS) drawText(page, font, item, renrakuhyoPdfText(item.key, values[item.key]));
  return Buffer.from(await pdf.save());
}

export async function createAndSaveRenrakuhyo(context: AdminContext, employeeId: string, deps: RenrakuhyoDeps = {}) {
  const record = await readAdminOnboardingDetailForFuyou(context, employeeId);
  if (!record) throw new OnboardingError("入社手続きの入力が見つかりませんでした。", 404);
  const company = await readCompany(context, record.employee.company_id);
  const values = buildRenrakuhyoValues(record, company);
  const baseName = renrakuhyoBaseName(record);
  const [excelTemplate, pdfTemplate] = await Promise.all([readTemplate(EXCEL_TEMPLATE_PATH), readTemplate(PDF_TEMPLATE_PATH)]);
  const [xlsx, pdf] = await Promise.all([
    (deps.buildExcel ?? buildRenrakuhyoExcel)(excelTemplate, values),
    (deps.buildPdf ?? buildRenrakuhyoPdf)(pdfTemplate, values),
  ]);
  return (deps.saveFiles ?? saveRenrakuhyoToDrive)({
    xlsx: { filename: `${baseName}.xlsx`, content: xlsx },
    pdf: { filename: `${baseName}.pdf`, content: pdf },
  });
}
