import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import {
  findOrCreateSubfolder,
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
  if (action === "register") {
    const file = form.get("file"),
      counterparty = String(form.get("counterparty") ?? "").trim(),
      companyId = String(form.get("companyId") ?? ""),
      contractType = String(form.get("contractType") ?? "").trim(),
      concludedOn = String(form.get("concludedOn") ?? ""),
      pages = extractedPages(form.get("extractedText"));
    if (
      !(file instanceof File) ||
      !counterparty ||
      !companyId ||
      !contractType ||
      !concludedOn ||
      !pages
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
      counterparty,
      companyId,
    );
    const { data, error } = await c.admin
      .from("system_contracts")
      .insert({
        counterparty,
        company_id: companyId,
        contract_type: contractType,
        concluded_on: concludedOn,
        note: String(form.get("note") ?? "") || null,
        drive_file_id: saved.fileId,
        drive_url: saved.url,
        drive_folder_name: saved.folderName,
        extracted_text: JSON.stringify(pages),
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
