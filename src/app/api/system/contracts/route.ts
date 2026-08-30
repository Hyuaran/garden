import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import {
  downloadFile,
  findOrCreateSubfolder,
  getDriveFileMetadata,
  listDriveFolderEntries,
} from "@/app/api/bud/expense-drive/_lib/drive";
import { extractContract } from "@/app/system/contracts/_lib/contract-extraction.server";
import {
  getContractDriveBreadcrumbs,
  saveOriginalContract,
  savePartnerTemplate,
} from "@/app/system/contracts/_lib/contract-drive.server";
import { generatePartnerTemplate } from "@/app/system/contracts/_lib/contract-template.server";
import {
  MAX_CONTRACT_SIZE,
  type ContractCompany,
} from "@/app/system/contracts/_lib/contract-types";
export const runtime = "nodejs";
// PDF解析とひな形生成に時間がかかるため長めに許容する
export const maxDuration = 60;
async function context() {
  const manager = await requireManager();
  if (!manager) return null;
  const admin = getSupabaseAdmin();
  const { data: companies } = await admin
    .from("root_companies")
    .select("company_id,company_name,representative,address")
    .eq("is_active", true)
    .order("company_id");
  return { manager, admin, companies: (companies ?? []) as ContractCompany[] };
}
function extractedPages(value: FormDataEntryValue | null): string[] | null {
  try {
    const parsed: unknown = JSON.parse(String(value ?? ""));
    return Array.isArray(parsed) && parsed.every((page) => typeof page === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}
const PDF_MIME_TYPE = "application/pdf";
const ALREADY_REGISTERED = "この契約書はすでに登録されています。";

function registrationFields(form: FormData) {
  return {
    counterparty: String(form.get("counterparty") ?? "").trim(),
    companyId: String(form.get("companyId") ?? ""),
    contractType: String(form.get("contractType") ?? "").trim(),
    concludedOn: String(form.get("concludedOn") ?? ""),
    note: String(form.get("note") ?? "") || null,
    pages: extractedPages(form.get("extractedText")),
  };
}

async function resolveContractDrivePdf(fileId: string) {
  const root = process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID;
  if (!root || !fileId) return null;
  const file = await getDriveFileMetadata(fileId);
  if (file.mimeType !== PDF_MIME_TYPE || !file.parents[0]) return null;
  const breadcrumbs = await getContractDriveBreadcrumbs(file.parents[0], root);
  return { file, folderName: breadcrumbs.at(-1)?.name ?? "契約書" };
}
export async function GET(request: Request) {
  const c = await context();
  if (!c) return NextResponse.json({ ok: false }, { status: 403 });
  const url = new URL(request.url);
  if (url.searchParams.has("browse")) {
    const root = process.env.GARDEN_CONTRACTS_DRIVE_ROOT_FOLDER_ID;
    if (!root)
      return NextResponse.json({ ok: false, error: "Driveを表示できません。管理者へ連絡してください。" }, { status: 503 });
    const folderId = url.searchParams.get("folderId");
    if (folderId) {
      const [entries, breadcrumbs] = await Promise.all([
        listDriveFolderEntries(folderId),
        getContractDriveBreadcrumbs(folderId, root),
      ]);
      return NextResponse.json({ ok: true, entries, breadcrumbs });
    }
    const entries = await Promise.all(
      ["01_契約書　上位店", "05_パートナー配布用ひな形"].map(async (name) => ({
        id: await findOrCreateSubfolder(root, name),
        name,
        mimeType: "application/vnd.google-apps.folder",
        webViewLink: null,
        modifiedTime: null,
      })),
    );
    return NextResponse.json({
      ok: true,
      entries,
      breadcrumbs: [{ id: null, name: "契約書" }],
    });
  }
  const { data: rows, error } = await c.admin
    .from("system_contracts")
    // company_id は "ALL"（全社）を取りうるため root_companies へのFKを張っていない。
    // FKが無いと PostgREST の埋め込み取得はできないので、会社名は companies から画面側で引く。
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return error
    ? NextResponse.json(
        { ok: false, error: "読み込めませんでした。" },
        { status: 500 },
      )
    : NextResponse.json({ ok: true, companies: c.companies, rows });
}
export async function POST(request: Request) {
  const c = await context();
  if (!c) return NextResponse.json({ ok: false }, { status: 403 });
  const form = await request.formData(),
    action = String(form.get("action") ?? "");
  if (action === "read-drive-file") {
    const driveFile = await resolveContractDrivePdf(String(form.get("driveFileId") ?? ""));
    if (!driveFile)
      return NextResponse.json(
        { ok: false, error: "この契約書を読み取れませんでした。管理者へ連絡してください。" },
        { status: 400 },
      );
    const buffer = await downloadFile(driveFile.file.id);
    if (buffer.byteLength > MAX_CONTRACT_SIZE)
      return NextResponse.json(
        { ok: false, error: "PDFは20MBまでです。ファイルサイズを確認してください。" },
        { status: 400 },
      );
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": PDF_MIME_TYPE, "Cache-Control": "private, no-store" },
    });
  }
  if (action === "analyze") {
    const pages = extractedPages(form.get("extractedText"));
    if (!pages)
      return NextResponse.json(
        { ok: false, error: "契約書の読み取り結果を確認できませんでした。" },
        { status: 400 },
      );
    return NextResponse.json({
      ok: true,
      draft: extractContract(pages, c.companies),
    });
  }
  if (action === "register-drive") {
    const driveFileId = String(form.get("driveFileId") ?? ""),
      fields = registrationFields(form);
    if (
      !driveFileId ||
      !fields.counterparty ||
      !fields.companyId ||
      !fields.contractType ||
      !fields.concludedOn ||
      !fields.pages
    )
      return NextResponse.json(
        { ok: false, error: "必須項目を入力してください。" },
        { status: 400 },
      );
    const { data: existing, error: existingError } = await c.admin
      .from("system_contracts")
      .select("id")
      .eq("drive_file_id", driveFileId)
      .maybeSingle();
    if (existingError)
      return NextResponse.json(
        { ok: false, error: "登録状況を確認できませんでした。時間をおいて再度お試しください。" },
        { status: 500 },
      );
    if (existing)
      return NextResponse.json({ ok: false, error: ALREADY_REGISTERED }, { status: 409 });
    const driveFile = await resolveContractDrivePdf(driveFileId);
    if (!driveFile)
      return NextResponse.json(
        { ok: false, error: "この契約書を読み取れませんでした。管理者へ連絡してください。" },
        { status: 400 },
      );
    const { data, error } = await c.admin
      .from("system_contracts")
      .insert({
        counterparty: fields.counterparty,
        company_id: fields.companyId,
        contract_type: fields.contractType,
        concluded_on: fields.concludedOn,
        note: fields.note,
        drive_file_id: driveFile.file.id,
        drive_url: driveFile.file.webViewLink ?? `https://drive.google.com/open?id=${driveFile.file.id}`,
        drive_folder_name: driveFile.folderName,
        extracted_text: JSON.stringify(fields.pages),
        created_by: c.manager.userId,
      })
      .select("*")
      .single();
    if (error)
      return NextResponse.json(
        {
          ok: false,
          error: "code" in error && error.code === "23505" ? ALREADY_REGISTERED : "登録できませんでした。",
        },
        { status: "code" in error && error.code === "23505" ? 409 : 500 },
      );
    return NextResponse.json({ ok: true, row: data, driveStatus: "existing" }, { status: 201 });
  }
  if (action === "register") {
    const file = form.get("file"),
      fields = registrationFields(form);
    if (
      !(file instanceof File) ||
      !fields.counterparty ||
      !fields.companyId ||
      !fields.contractType ||
      !fields.concludedOn ||
      !fields.pages
    )
      return NextResponse.json(
        { ok: false, error: "必須項目を入力してください。" },
        { status: 400 },
      );
    if (file.type !== "application/pdf" || file.size > MAX_CONTRACT_SIZE)
      return NextResponse.json(
        {
          ok: false,
          error:
            file.size > MAX_CONTRACT_SIZE
              ? "PDFは20MB以下にしてください。"
              : "PDFファイルを選択してください。",
        },
        { status: 400 },
      );
    const saved = await saveOriginalContract(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      fields.counterparty,
      fields.companyId,
    );
    const { data, error } = await c.admin
      .from("system_contracts")
      .insert({
        counterparty: fields.counterparty,
        company_id: fields.companyId,
        contract_type: fields.contractType,
        concluded_on: fields.concludedOn,
        note: fields.note,
        drive_file_id: saved.fileId,
        drive_url: saved.url,
        drive_folder_name: saved.folderName,
        extracted_text: JSON.stringify(fields.pages),
        created_by: c.manager.userId,
      })
      .select("*")
      .single();
    return error
      ? NextResponse.json(
          { ok: false, error: "登録できませんでした。" },
          { status: 500 },
        )
      : NextResponse.json(
          { ok: true, row: data, driveStatus: saved.status },
          { status: 201 },
        );
  }
  if (action === "template") {
    const id = String(form.get("id") ?? ""),
      issuerId = String(form.get("issuerId") ?? ""),
      product = String(form.get("product") ?? "").trim();
    const { data: row } = await c.admin
      .from("system_contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    const issuer = c.companies.find((x) => x.company_id === issuerId);
    if (!row || !issuer || !product)
      return NextResponse.json(
        { ok: false, error: "ひな形を生成する条件が不足しています。" },
        { status: 400 },
      );
    const pages = (() => {
      try {
        const parsed: unknown = JSON.parse(String(row.extracted_text ?? ""));
        return Array.isArray(parsed) && parsed.every((page) => typeof page === "string") ? parsed : null;
      } catch { return null; }
    })();
    if (!pages || !pages.join("").trim())
      return NextResponse.json(
        { ok: false, error: "元の契約書を読み取れていないため、ひな形を作成できません。登録し直してください。" },
        { status: 400 },
      );
    const generated = await generatePartnerTemplate(pages, {
        issuer,
        title: row.contract_type,
        excludedTerms: [row.counterparty, ...c.companies.map((company) => company.company_name)],
      }),
      base = `${row.contract_type}_ひな形_DRAFT`,
      filenames = { pdf: `${base}.pdf`, docx: `${base}.docx` },
      saved = await savePartnerTemplate(
        { pdf: generated.pdf, docx: generated.docx },
        filenames,
        product,
        row.counterparty,
      );
    await c.admin
      .from("system_contracts")
      .update({
        product,
        template_file_id: saved.pdf?.fileId ?? null,
        template_url: saved.pdf?.url ?? null,
        template_docx_file_id: saved.docx?.fileId ?? null,
        template_docx_url: saved.docx?.url ?? null,
        template_generated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ ok: true, files: saved, filenames });
  }
  return NextResponse.json(
    { ok: false, error: "操作を確認してください。" },
    { status: 400 },
  );
}
